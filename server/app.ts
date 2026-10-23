import 'dotenv/config';
import express, { Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {
  signupUser,
  loginUser,
  refreshSessionToken,
  logoutUser,
  loginOrCreateOAuthUser,
  resetUserPassword
} from './services/auth.service';
import { requireUser, AuthRequest } from './middleware/requireUser';
import {
  getUserCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from './services/category.service';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
  getSpendByCategory,
  getTopMerchants,
  getBiggestTransactions
} from './services/transaction.service';
import {
  getCategoryBudgets,
  upsertCategoryBudget,
  getMonthlyBudget,
  upsertMonthlyBudget
} from './services/budget.service';
import { processSmartSearch } from './services/smartSearch.service';
import { generateSpeech } from './gemini';
import {
  createImportJob,
  processImportJob,
  getImportJob,
  updateImportItem,
  commitImportJob
} from './services/import.service';
import {
  createMonthlyReport,
  getReportStatus,
  getLatestMonthlyReport,
  getAllUserReports
} from './services/report.service';
import {
  getFriends,
  createFriend,
  deleteFriend,
  getFriendGroups,
  createFriendGroup,
  getFriendDebts,
  getDebtSummary,
  createFriendDebt,
  settleFriendDebt
} from './services/friendGroup.service';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications
} from './services/notification.service';
import { db } from './db';

export function createApp() {
  const app = express();

  // Universal CORS handling for cross-origin requests from Amplify and local dev
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Amz-Date, X-Api-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Synchronize distributed serverless instances with DynamoDB
  app.use(async (req: any, res: any, next: any) => {
    if (req.path.startsWith('/api') && req.path !== '/api/health') {
      await db.syncFromDynamo();
    }
    next();
  });

  // Production Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: '10mb' }));

  // API Rate Limiting to prevent brute-force and DDoS
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
  });
  app.use('/api/auth', authLimiter);

  // Simple cookie parser simulation
  app.use((req: any, res: any, next: any) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie: string) => {
        const idx = cookie.indexOf('=');
        if (idx !== -1) {
          const key = cookie.slice(0, idx).trim();
          const val = cookie.slice(idx + 1).trim();
          try {
            req.cookies[key] = decodeURIComponent(val);
          } catch {
            req.cookies[key] = val;
          }
        }
      });
    }
    next();
  });

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      runtime: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'AWS Lambda (Serverless)' : 'Node.js Express',
      timestamp: new Date().toISOString(),
    });
  });

  // Auth Endpoints
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { phone, email, password, confirmPassword } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const result = await signupUser(phone || '', email, password);
      res.setHeader('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Lax; Path=/`);
      res.json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Signup failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await loginUser(email, password);
      res.setHeader('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Lax; Path=/`);
      res.json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Invalid credentials' });
    }
  });

  app.post('/api/auth/google', async (req, res) => {
    try {
      const { idToken, email, name, avatar } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Google authentication payload missing email' });
      }

      const result = await loginOrCreateOAuthUser('google', email, name || 'Google User', avatar);
      res.setHeader('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Lax; Path=/`);
      res.json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Google authentication failed' });
    }
  });

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const token = req.body.refreshToken || (req as any).cookies?.refreshToken;
      if (!token) {
        return res.status(401).json({ error: 'No refresh token provided' });
      }

      const result = await refreshSessionToken(token);
      res.setHeader('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Lax; Path=/`);
      res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err: any) {
      res.status(err.status || 401).json({ error: err.message || 'Invalid refresh token' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = req.body.refreshToken || (req as any).cookies?.refreshToken;
    if (token) {
      await logoutUser(token);
    }
    res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.json({ success: true });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password required' });
      }
      await resetUserPassword(email, newPassword);
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (err: any) {
      res.status(err.status || 400).json({ error: err.message || 'Password reset failed' });
    }
  });

  // User Profile
  app.get('/api/me', requireUser, (req: AuthRequest, res) => {
    res.json(req.user);
  });

  app.patch('/api/me', requireUser, async (req: AuthRequest, res) => {
    try {
      const { spendingCeiling, targetSavings, profileSetupCompleted, name, phone } = req.body;
      const user = req.user!;

      if (spendingCeiling !== undefined) user.spendingCeiling = Number(spendingCeiling);
      if (targetSavings !== undefined) user.targetSavings = Number(targetSavings);
      if (profileSetupCompleted !== undefined) user.profileSetupCompleted = Boolean(profileSetupCompleted);
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;

      // Update in db
      const idx = db.data.users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        db.data.users[idx] = user;
        db.save();
      }

      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  });

  // Category Endpoints
  app.get('/api/categories', requireUser, async (req: AuthRequest, res) => {
    const cats = await getUserCategories(req.user!.id);
    res.json(cats);
  });

  app.post('/api/categories', requireUser, async (req: AuthRequest, res) => {
    try {
      const { name, icon, color } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const cat = await createCategory(req.user!.id, name, icon, color);
      res.json(cat);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create category' });
    }
  });

  app.patch('/api/categories/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const updated = await updateCategory(req.user!.id, req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const removed = await deleteCategory(req.user!.id, req.params.id);
      res.json({ success: true, removed });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to delete category' });
    }
  });

  // Transaction Endpoints
  app.get('/api/transactions', requireUser, async (req: AuthRequest, res) => {
    const { month, categoryId, type, page, limit } = req.query;
    const result = await getTransactions(req.user!.id, {
      month: month ? String(month) : undefined,
      categoryId: categoryId ? String(categoryId) : undefined,
      type: type ? (String(type) as any) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  });

  app.post('/api/transactions', requireUser, async (req: AuthRequest, res) => {
    try {
      const { amount, type, categoryId, merchant, date, note, rawText, receiptBase64, isSalaryCredit, receiptPdfBase64, receiptFileName } = req.body;
      if (!amount || !type || !merchant || !date) {
        return res.status(400).json({ error: 'amount, type, merchant, and date are required' });
      }

      const txn = await createTransaction(req.user!.id, {
        amount: Number(amount),
        type,
        categoryId,
        merchant,
        date,
        note,
        rawText,
        receiptBase64,
        receiptPdfBase64,
        receiptFileName,
        isSalaryCredit: Boolean(isSalaryCredit)
      });
      res.json(txn);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create transaction' });
    }
  });

  app.patch('/api/transactions/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const { amount, type, categoryId, merchant, date, note, isSalaryCredit, receiptPdfBase64, receiptFileName } = req.body;
      const updated = await updateTransaction(req.user!.id, req.params.id, {
        amount: amount !== undefined ? Number(amount) : undefined,
        type,
        categoryId,
        merchant,
        date,
        note,
        isSalaryCredit: isSalaryCredit !== undefined ? Boolean(isSalaryCredit) : undefined,
        receiptPdfBase64,
        receiptFileName
      });
      res.json(updated);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update transaction' });
    }
  });

  app.delete('/api/transactions/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const removed = await deleteTransaction(req.user!.id, req.params.id);
      res.json({ success: true, removed });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to delete transaction' });
    }
  });

  // Analytics & Summary Endpoints
  app.get('/api/transactions/summary', requireUser, async (req: AuthRequest, res) => {
    const month = req.query.month ? String(req.query.month) : undefined;
    const summary = await getMonthlySummary(req.user!.id, month);
    res.json(summary);
  });

  app.get('/api/transactions/by-category', requireUser, async (req: AuthRequest, res) => {
    const month = req.query.month ? String(req.query.month) : undefined;
    const data = await getSpendByCategory(req.user!.id, month);
    res.json(data);
  });

  app.get('/api/transactions/top-merchants', requireUser, async (req: AuthRequest, res) => {
    const month = req.query.month ? String(req.query.month) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const data = await getTopMerchants(req.user!.id, month, limit);
    res.json(data);
  });

  app.get('/api/transactions/biggest', requireUser, async (req: AuthRequest, res) => {
    const month = req.query.month ? String(req.query.month) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const data = await getBiggestTransactions(req.user!.id, month, limit);
    res.json(data);
  });

  // Budget Endpoints
  app.get('/api/budgets/category', requireUser, async (req: AuthRequest, res) => {
    const month = req.query.month ? String(req.query.month) : undefined;
    const budgets = await getCategoryBudgets(req.user!.id, month);
    res.json(budgets);
  });

  app.post('/api/budgets/category', requireUser, async (req: AuthRequest, res) => {
    try {
      const { categoryId, month, limitAmount } = req.body;
      if (!categoryId || !month || limitAmount === undefined) {
        return res.status(400).json({ error: 'categoryId, month, and limitAmount required' });
      }
      const budget = await upsertCategoryBudget(req.user!.id, categoryId, month, Number(limitAmount));
      res.json(budget);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update category budget' });
    }
  });

  app.get('/api/budgets/monthly', requireUser, async (req: AuthRequest, res) => {
    const month = req.query.month ? String(req.query.month) : undefined;
    const budget = await getMonthlyBudget(req.user!.id, month);
    res.json(budget || null);
  });

  app.post('/api/budgets/monthly', requireUser, async (req: AuthRequest, res) => {
    try {
      const { month, limitAmount } = req.body;
      if (!month || limitAmount === undefined) {
        return res.status(400).json({ error: 'month and limitAmount required' });
      }
      const budget = await upsertMonthlyBudget(req.user!.id, month, Number(limitAmount));
      res.json(budget);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update monthly budget' });
    }
  });

  // Notifications Endpoints
  app.get('/api/notifications', requireUser, (req: AuthRequest, res) => {
    const notifs = getUserNotifications(req.user!.id);
    res.json(notifs);
  });

  app.patch('/api/notifications/read-all', requireUser, (req: AuthRequest, res) => {
    const updated = markAllNotificationsRead(req.user!.id);
    res.json({ success: true, count: updated.length });
  });

  app.patch('/api/notifications/:id/read', requireUser, (req: AuthRequest, res) => {
    const updated = markNotificationRead(req.user!.id, req.params.id);
    res.json(updated);
  });

  app.delete('/api/notifications/:id', requireUser, (req: AuthRequest, res) => {
    const success = deleteNotification(req.user!.id, req.params.id);
    res.json({ success });
  });

  app.delete('/api/notifications', requireUser, (req: AuthRequest, res) => {
    const success = clearNotifications(req.user!.id);
    res.json({ success });
  });

  // Smart Search (AI Copilot / Universal NLP Bar)
  app.post('/api/smart-search', requireUser, async (req: AuthRequest, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Query string is required' });
      }
      const result = await processSmartSearch(req.user!.id, query);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Smart search failed' });
    }
  });

  // Text to Speech (Gemini 3.8 Flash TTS)
  app.post('/api/generate-speech', requireUser, async (req: AuthRequest, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text string is required for speech synthesis' });
      }

      const speech = await generateSpeech(text);
      if (!speech) {
        return res.status(503).json({
          error: 'Gemini Speech Generation unavailable. Client should use Web Speech API fallback.',
          useClientFallback: true
        });
      }

      res.json(speech);
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to generate speech with Gemini',
        useClientFallback: true
      });
    }
  });

  // Statement Import
  app.post('/api/imports', requireUser, async (req: AuthRequest, res) => {
    try {
      const { fileName, fileContentBase64, mimeType } = req.body;
      if (!fileName || !fileContentBase64) {
        return res.status(400).json({ error: 'fileName and fileContentBase64 are required' });
      }
      const job = await createImportJob(req.user!.id, fileName, fileContentBase64, mimeType);
      res.json(job);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create import job' });
    }
  });

  app.post('/api/imports/:id/process', requireUser, async (req: AuthRequest, res) => {
    try {
      const result = await processImportJob(req.user!.id, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to process import job' });
    }
  });

  app.get('/api/imports/:id', requireUser, async (req: AuthRequest, res) => {
    const job = await getImportJob(req.user!.id, req.params.id);
    if (!job) return res.status(404).json({ error: 'Import job not found' });
    res.json(job);
  });

  app.patch('/api/imports/:id/items/:itemId', requireUser, async (req: AuthRequest, res) => {
    try {
      const updated = await updateImportItem(req.user!.id, req.params.id, req.params.itemId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update import item' });
    }
  });

  app.post('/api/imports/:id/commit', requireUser, async (req: AuthRequest, res) => {
    try {
      const result = await commitImportJob(req.user!.id, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to commit import job' });
    }
  });

  // Monthly Reports
  app.get('/api/reports/latest', requireUser, async (req: AuthRequest, res) => {
    const report = await getLatestMonthlyReport(req.user!.id);
    if (!report) {
      return res.status(404).json({ error: 'No reports found' });
    }
    res.json(report);
  });

  app.get('/api/reports', requireUser, async (req: AuthRequest, res) => {
    const reports = await getAllUserReports(req.user!.id);
    res.json(reports);
  });

  app.post('/api/reports/monthly', requireUser, async (req: AuthRequest, res) => {
    try {
      const month = req.body?.month || req.query?.month || new Date().toISOString().substring(0, 7);
      const job = await createMonthlyReport(req.user!.id, String(month));
      res.json(job);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create monthly report' });
    }
  });

  app.get('/api/reports/:jobId/status', requireUser, async (req: AuthRequest, res) => {
    const job = await getReportStatus(req.user!.id, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Report job not found' });
    }
    res.json(job);
  });

  app.get('/api/reports/:jobId/download', requireUser, async (req: AuthRequest, res) => {
    const job = await getReportStatus(req.user!.id, req.params.jobId);
    if (!job || !job.pdfDataUri) {
      return res.status(404).json({ error: 'Report not ready for download' });
    }
    const base64Data = job.pdfDataUri.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Splity-Report-${job.month}.pdf`);
    res.send(pdfBuffer);
  });

  // AWS Cloud Integration Status & Sync
  app.get('/api/aws/status', requireUser, (req: AuthRequest, res) => {
    res.json(db.getAwsStatus());
  });

  app.post('/api/aws/sync', requireUser, async (req: AuthRequest, res) => {
    try {
      const result = await db.syncAllToDynamo();
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to trigger AWS DynamoDB sync' });
    }
  });

  // Friends & Shared Expenses / Split Debts
  app.get('/api/friends', requireUser, async (req: AuthRequest, res) => {
    const friends = await getFriends(req.user!.id);
    res.json(friends);
  });

  app.post('/api/friends', requireUser, async (req: AuthRequest, res) => {
    try {
      const { name, phone } = req.body;
      if (!name) return res.status(400).json({ error: 'Friend name required' });
      const friend = await createFriend(req.user!.id, name, phone);
      res.json(friend);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create friend' });
    }
  });

  app.delete('/api/friends/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const removed = await deleteFriend(req.user!.id, req.params.id);
      res.json({ success: true, friend: removed });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to delete friend' });
    }
  });

  app.get('/api/friend-groups', requireUser, async (req: AuthRequest, res) => {
    const groups = await getFriendGroups(req.user!.id);
    res.json(groups);
  });

  app.post('/api/friend-groups', requireUser, async (req: AuthRequest, res) => {
    try {
      const { name, members, description } = req.body;
      if (!name || !members || !Array.isArray(members)) {
        return res.status(400).json({ error: 'Group name and members array required' });
      }
      const group = await createFriendGroup(req.user!.id, name, members, description);
      res.json(group);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create group' });
    }
  });

  app.get('/api/debts', requireUser, async (req: AuthRequest, res) => {
    const debts = await getFriendDebts(req.user!.id);
    res.json(debts);
  });

  app.get('/api/debts/summary', requireUser, async (req: AuthRequest, res) => {
    const summary = await getDebtSummary(req.user!.id);
    res.json(summary);
  });

  app.post('/api/debts', requireUser, async (req: AuthRequest, res) => {
    try {
      const { friendName, amount, type, description, groupId } = req.body;
      if (!friendName || !amount || !type || !description) {
        return res.status(400).json({ error: 'friendName, amount, type, and description required' });
      }
      const debt = await createFriendDebt(req.user!.id, friendName, Number(amount), type, description, groupId);
      res.json(debt);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create debt record' });
    }
  });

  app.post('/api/debts/:id/settle', requireUser, async (req: AuthRequest, res) => {
    try {
      const debt = await settleFriendDebt(req.user!.id, req.params.id);
      res.json(debt);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to settle debt' });
    }
  });

  // Catch-all 404 handler for missing API endpoints
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  return app;
}
