import crypto from 'node:crypto';
import { db } from '../db.js';
import { Transaction, TransactionType, CategorySpend, TopMerchant, MonthlySummary } from '../../src/types.js';
import { checkBudgetWarning } from './budget.service.js';
import { createNotification } from './notification.service.js';

export interface GetTransactionsOptions {
  month?: string; // YYYY-MM
  categoryId?: string;
  type?: TransactionType;
  page?: number;
  limit?: number;
}

export async function getTransactions(userId: string, opts: GetTransactionsOptions) {
  let items = db.data.transactions.filter((t) => t.userId === userId);

  if (opts.month) {
    items = items.filter((t) => t.date.startsWith(opts.month!));
  }

  if (opts.categoryId) {
    items = items.filter((t) => t.categoryId === opts.categoryId);
  }

  if (opts.type) {
    items = items.filter((t) => t.type === opts.type);
  }

  // Sort descending by date
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const page = opts.page || 1;
  const limit = opts.limit || 50;
  const totalCount = items.length;

  const paginated = items.slice((page - 1) * limit, page * limit);

  // Enrich with category names
  const enriched = paginated.map((t) => {
    const cat = t.categoryId ? db.data.categories.find((c) => c.id === t.categoryId) : null;
    return {
      ...t,
      categoryName: cat ? cat.name : t.categoryName || 'Uncategorized',
    };
  });

  return {
    transactions: enriched,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}

export async function createTransaction(
  userId: string,
  data: {
    type: TransactionType;
    amount: number;
    categoryId?: string | null;
    merchant?: string;
    note?: string;
    date: string;
    source?: 'MANUAL' | 'IMPORT';
  }
): Promise<Transaction> {
  let categoryName = 'Uncategorized';
  if (data.categoryId) {
    const cat = db.data.categories.find((c) => c.id === data.categoryId && c.userId === userId);
    if (cat) categoryName = cat.name;
  }

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    userId,
    categoryId: data.categoryId || null,
    categoryName,
    type: data.type,
    amount: Number(data.amount),
    merchant: data.merchant?.trim() || '',
    note: data.note?.trim() || '',
    date: data.date,
    source: data.source || 'MANUAL',
    createdAt: new Date().toISOString(),
  };

  db.data.transactions.push(transaction);
  db.save();

  // Create notification for expense
  if (data.type === 'EXPENSE') {
    createNotification(userId, {
      type: 'EXPENSE_ADDED',
      category: 'Expenses',
      message: `Expense recorded: ${data.merchant || data.note || categoryName} of ₹${Number(data.amount).toLocaleString('en-IN')}`,
    });
  }

  // Evaluate budget alerts if expense
  if (data.type === 'EXPENSE' && data.categoryId) {
    const month = data.date.substring(0, 7);
    await checkBudgetWarning(userId, data.categoryId, month);
  }

  return transaction;
}

export async function updateTransaction(
  userId: string,
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>
): Promise<Transaction> {
  const tx = db.data.transactions.find((t) => t.id === id && t.userId === userId);
  if (!tx) {
    throw { status: 404, message: 'Transaction not found' };
  }

  if (updates.type !== undefined) tx.type = updates.type;
  if (updates.amount !== undefined) tx.amount = Number(updates.amount);
  if (updates.merchant !== undefined) tx.merchant = updates.merchant.trim();
  if (updates.note !== undefined) tx.note = updates.note.trim();
  if (updates.date !== undefined) tx.date = updates.date;

  if (updates.categoryId !== undefined) {
    tx.categoryId = updates.categoryId;
    if (updates.categoryId) {
      const cat = db.data.categories.find((c) => c.id === updates.categoryId && c.userId === userId);
      tx.categoryName = cat ? cat.name : 'Uncategorized';
    } else {
      tx.categoryName = 'Uncategorized';
    }
  }

  db.save();

  if (tx.type === 'EXPENSE' && tx.categoryId) {
    const month = tx.date.substring(0, 7);
    await checkBudgetWarning(userId, tx.categoryId, month);
  }

  return tx;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const idx = db.data.transactions.findIndex((t) => t.id === id && t.userId === userId);
  if (idx === -1) {
    throw { status: 404, message: 'Transaction not found' };
  }

  const [deletedTx] = db.data.transactions.splice(idx, 1);
  db.save();

  if (deletedTx.type === 'EXPENSE') {
    createNotification(userId, {
      type: 'EXPENSE_DELETED',
      category: 'Expenses',
      message: `Deleted expense: ${deletedTx.merchant || deletedTx.note || deletedTx.categoryName || 'Expense'} (₹${deletedTx.amount.toLocaleString('en-IN')})`,
    });
  }
}

// Aggregation endpoints for dashboard & Smart Search

export async function getMonthlySummary(userId: string, month: string): Promise<MonthlySummary> {
  const monthTxns = db.data.transactions.filter((t) => t.userId === userId && t.date.startsWith(month));

  const totalIncome = monthTxns
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = monthTxns
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netSaved = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSaved / totalIncome) * 100) : 0;

  const mbRecord = db.data.monthlyBudgets.find((b) => b.userId === userId && b.month === month);
  const cbRecords = db.data.categoryBudgets.filter((b) => b.userId === userId && b.month === month);
  const cbTotal = cbRecords.reduce((s, b) => s + Number(b.limitAmount), 0);
  const user = db.data.users.find((u) => u.id === userId);
  const userCeiling = user?.spendingCeiling && user.spendingCeiling > 0 ? user.spendingCeiling : 0;
  const monthlyBudget = mbRecord
    ? mbRecord.limitAmount
    : (userCeiling > 0 ? userCeiling : (cbTotal > 0 ? cbTotal : 0));

  return {
    month,
    totalIncome,
    totalExpense,
    netSaved,
    savingsRate,
    monthlyBudget,
  };
}

export async function getSpendByCategory(userId: string, month: string): Promise<CategorySpend[]> {
  const userCategories = db.data.categories.filter((c) => c.userId === userId);
  const budgets = db.data.categoryBudgets.filter((b) => b.userId === userId && b.month === month);

  const result: CategorySpend[] = [];

  for (const cat of userCategories) {
    const total = db.data.transactions
      .filter(
        (t) => t.userId === userId && t.type === 'EXPENSE' && t.categoryId === cat.id && t.date.startsWith(month)
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const budget = budgets.find((b) => b.categoryId === cat.id);
    const limitAmount = budget ? budget.limitAmount : 0;

    if (total > 0 || limitAmount > 0) {
      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        color: cat.color,
        total,
        limitAmount,
        percentUsed: limitAmount > 0 ? Math.round((total / limitAmount) * 100) : 0,
      });
    }
  }

  result.sort((a, b) => b.total - a.total);
  return result;
}

export async function getTopMerchants(userId: string, month: string, limit = 5): Promise<TopMerchant[]> {
  const expTxns = db.data.transactions.filter(
    (t) => t.userId === userId && t.type === 'EXPENSE' && t.date.startsWith(month) && t.merchant
  );

  const map: Record<string, { total: number; count: number }> = {};

  for (const t of expTxns) {
    const name = t.merchant!.trim();
    if (!map[name]) {
      map[name] = { total: 0, count: 0 };
    }
    map[name].total += Number(t.amount);
    map[name].count += 1;
  }

  const list: TopMerchant[] = Object.keys(map).map((merchant) => ({
    merchant,
    total: map[merchant].total,
    count: map[merchant].count,
  }));

  list.sort((a, b) => b.total - a.total);
  return list.slice(0, limit);
}

export async function getBiggestTransactions(userId: string, month: string, limit = 10): Promise<Transaction[]> {
  const expTxns = db.data.transactions.filter(
    (t) => t.userId === userId && t.type === 'EXPENSE' && t.date.startsWith(month)
  );

  expTxns.sort((a, b) => Number(b.amount) - Number(a.amount));
  return expTxns.slice(0, limit);
}
