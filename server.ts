import 'dotenv/config';
import express, { Response } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  signupUser,
  loginUser,
  refreshSessionToken,
  logoutUser,
  loginOrCreateOAuthUser,
  resetUserPassword
} from './server/services/auth.service';
import { requireUser, AuthRequest } from './server/middleware/requireUser';
import {
  getUserCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from './server/services/category.service';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
  getSpendByCategory,
  getTopMerchants,
  getBiggestTransactions
} from './server/services/transaction.service';
import {
  getCategoryBudgets,
  upsertCategoryBudget,
  getMonthlyBudget,
  upsertMonthlyBudget
} from './server/services/budget.service';
import { processSmartSearch } from './server/services/smartSearch.service';
import {
  createImportJob,
  processImportJob,
  getImportJob,
  updateImportItem,
  commitImportJob
} from './server/services/import.service';
import {
  createMonthlyReport,
  getReportStatus
} from './server/services/report.service';
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
} from './server/services/friendGroup.service';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications
} from './server/services/notification.service';
import { db } from './server/db';
import { awsRouter } from './server/aws/routes';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  app.use(express.json());

  // Simple cookie parser simulation
  app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
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
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AWS Native Services Router
  app.use('/api/aws', awsRouter);

  // --- AUTH ROUTES ---
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { phone, email, password, confirmPassword, fullName } = req.body;
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
      if (fullName && result.user) {
        result.user.name = fullName;
        const u = db.data.users.find((user) => user.id === result.user.id);
        if (u) u.name = fullName;
      }

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
      res.status(err.status || 500).json({ error: err.message || 'Login failed' });
    }
  });

  app.post('/api/auth/google', async (req, res) => {
    try {
      const { email, displayName, photoURL } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required from Google sign in' });
      }

      const result = await loginOrCreateOAuthUser(email, displayName, photoURL);

      res.setHeader('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Lax; Path=/`);
      res.json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Google sign in failed' });
    }
  });

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' });
      }

      const result = await refreshSessionToken(refreshToken);

      res.setHeader('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; SameSite=Lax; Path=/`);
      res.json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err: any) {
      res.status(err.status || 401).json({ error: err.message || 'Refresh failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    await logoutUser(refreshToken);
    res.setHeader('Set-Cookie', `refreshToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ success: true });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email/mobile and new password are required' });
      }
      const result = await resetUserPassword(email, newPassword);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to reset password' });
    }
  });

  app.get('/api/me', requireUser, (req: AuthRequest, res) => {
    const user = db.data.users.find((u) => u.id === req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });

  app.patch('/api/me', requireUser, async (req: AuthRequest, res) => {
    try {
      const user = db.data.users.find((u) => u.id === req.user!.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { name, phone, spendingCeiling, targetSavings, profileSetupCompleted, month } = req.body;
      if (name !== undefined) user.name = String(name).trim();
      if (phone !== undefined) user.phone = String(phone).trim();
      if (spendingCeiling !== undefined) {
        const ceilingInt = Math.round(Number(spendingCeiling));
        user.spendingCeiling = ceilingInt;
        const targetMonth = month || new Date().toISOString().substring(0, 7);
        if (ceilingInt > 0) {
          await upsertMonthlyBudget(user.id, targetMonth, ceilingInt);
        }
      }
      if (targetSavings !== undefined) user.targetSavings = Math.round(Number(targetSavings));
      if (profileSetupCompleted !== undefined) user.profileSetupCompleted = Boolean(profileSetupCompleted);

      db.save();
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update profile' });
    }
  });

  // --- CATEGORY ROUTES ---
  app.get('/api/categories', requireUser, async (req: AuthRequest, res) => {
    const categories = await getUserCategories(req.user!.id);
    res.json(categories);
  });

  app.post('/api/categories', requireUser, async (req: AuthRequest, res) => {
    try {
      const { name, icon, color } = req.body;
      if (!name) return res.status(400).json({ error: 'Category name required' });
      const category = await createCategory(req.user!.id, name, icon, color);
      res.json(category);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create category' });
    }
  });

  app.patch('/api/categories/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const category = await updateCategory(req.user!.id, req.params.id, req.body);
      res.json(category);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      await deleteCategory(req.user!.id, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to delete category' });
    }
  });

  // --- TRANSACTION ROUTES ---
  app.get('/api/transactions', requireUser, async (req: AuthRequest, res) => {
    const { month, categoryId, type, page, limit } = req.query;
    const result = await getTransactions(req.user!.id, {
      month: month as string,
      categoryId: categoryId as string,
      type: type as any,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });
    res.json(result);
  });

  app.post('/api/transactions', requireUser, async (req: AuthRequest, res) => {
    try {
      const { type, amount, categoryId, merchant, note, date } = req.body;
      if (!type || !amount || !date) {
        return res.status(400).json({ error: 'Type, amount, and date are required' });
      }
      const transaction = await createTransaction(req.user!.id, {
        type,
        amount: Number(amount),
        categoryId,
        merchant,
        note,
        date,
      });
      res.json(transaction);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to create transaction' });
    }
  });

  app.patch('/api/transactions/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const tx = await updateTransaction(req.user!.id, req.params.id, req.body);
      res.json(tx);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update transaction' });
    }
  });

  app.delete('/api/transactions/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      await deleteTransaction(req.user!.id, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to delete transaction' });
    }
  });

  // --- AGGREGATIONS ---
  app.get('/api/transactions/summary', requireUser, async (req: AuthRequest, res) => {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const summary = await getMonthlySummary(req.user!.id, month);
    res.json(summary);
  });

  app.get('/api/transactions/by-category', requireUser, async (req: AuthRequest, res) => {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const result = await getSpendByCategory(req.user!.id, month);
    res.json(result);
  });

  app.get('/api/transactions/top-merchants', requireUser, async (req: AuthRequest, res) => {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const merchants = await getTopMerchants(req.user!.id, month, limit);
    res.json(merchants);
  });

  app.get('/api/transactions/biggest', requireUser, async (req: AuthRequest, res) => {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const items = await getBiggestTransactions(req.user!.id, month, limit);
    res.json(items);
  });

  // --- BUDGET ROUTES ---
  app.get('/api/budgets/category', requireUser, async (req: AuthRequest, res) => {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
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
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const budget = await getMonthlyBudget(req.user!.id, month);
    res.json(budget || { userId: req.user!.id, month, limitAmount: 0, spentAmount: 0 });
  });

  app.post('/api/budgets/monthly', requireUser, async (req: AuthRequest, res) => {
    try {
      const { month, limitAmount } = req.body;
      if (!month || limitAmount === undefined) {
        return res.status(400).json({ error: 'month and limitAmount required' });
      }
      const limitInt = Math.round(Number(limitAmount));
      const budget = await upsertMonthlyBudget(req.user!.id, month, limitInt);
      const user = db.data.users.find((u) => u.id === req.user!.id);
      if (user && limitInt > 0) {
        user.spendingCeiling = limitInt;
      }
      db.save();
      res.json(budget);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to update monthly budget' });
    }
  });

  // --- NOTIFICATION ROUTES ---
  app.get('/api/notifications', requireUser, (req: AuthRequest, res) => {
    const notifications = getUserNotifications(req.user!.id);
    res.json(notifications);
  });

  app.patch('/api/notifications/read-all', requireUser, (req: AuthRequest, res) => {
    const updatedCount = markAllNotificationsRead(req.user!.id);
    res.json({ success: true, count: updatedCount });
  });

  app.patch('/api/notifications/:id/read', requireUser, (req: AuthRequest, res) => {
    const notif = markNotificationRead(req.user!.id, req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  });

  app.delete('/api/notifications/:id', requireUser, (req: AuthRequest, res) => {
    const deleted = deleteNotification(req.user!.id, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  });

  app.delete('/api/notifications', requireUser, (req: AuthRequest, res) => {
    const category = req.query.category as any;
    const removedCount = clearNotifications(req.user!.id, category);
    res.json({ success: true, count: removedCount });
  });

  // --- SMART SEARCH ---
  app.post('/api/smart-search', requireUser, async (req: AuthRequest, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: 'Query text required' });
      const result = await processSmartSearch(req.user!.id, query);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Smart search failed' });
    }
  });

  // --- IMPORTS ---
  app.post('/api/imports', requireUser, async (req: AuthRequest, res) => {
    try {
      const { fileName, fileType } = req.body;
      if (!fileName || !fileType) return res.status(400).json({ error: 'fileName and fileType required' });
      const result = await createImportJob(req.user!.id, fileName, fileType);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Import failed' });
    }
  });

  app.post('/api/imports/:id/process', requireUser, async (req: AuthRequest, res) => {
    try {
      const { textContent, imageBase64 } = req.body;
      const job = await processImportJob(req.user!.id, req.params.id, textContent, imageBase64);
      res.json(job);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to process import' });
    }
  });

  app.get('/api/imports/:id', requireUser, async (req: AuthRequest, res) => {
    try {
      const job = await getImportJob(req.user!.id, req.params.id);
      res.json(job);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Import job not found' });
    }
  });

  app.patch('/api/imports/:id/items/:itemId', requireUser, async (req: AuthRequest, res) => {
    try {
      const item = await updateImportItem(req.user!.id, req.params.id, req.params.itemId, req.body);
      res.json(item);
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

  // --- REPORTS ---
  app.post('/api/reports/monthly', requireUser, async (req: AuthRequest, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const reportJob = await createMonthlyReport(req.user!.id, month);
      res.json(reportJob);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Failed to trigger report' });
    }
  });

  app.get('/api/reports/:jobId/status', requireUser, async (req: AuthRequest, res) => {
    try {
      const report = await getReportStatus(req.user!.id, req.params.jobId);
      res.json(report);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Report not found' });
    }
  });

  // --- FRIENDS & GROUPS ROUTES ---
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

  // Catch-all 404 handler for missing API endpoints to prevent Vite HTML fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data_store.json',
            '**/data_store*.json',
            '**/server/**',
            '**/server.ts',
            '**/.env*',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Expense Buddy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
