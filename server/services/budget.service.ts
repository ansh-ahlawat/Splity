import crypto from 'node:crypto';
import { db } from '../db.js';
import { CategoryBudget, MonthlyBudget } from '../../src/types.js';
import { createNotification } from './notification.service.js';

export async function getCategoryBudgets(userId: string, month: string): Promise<CategoryBudget[]> {
  const budgets = db.data.categoryBudgets.filter((b) => b.userId === userId && b.month === month);

  // Enrich with spend
  return budgets.map((b) => {
    const totalSpent = db.data.transactions
      .filter(
        (t) =>
          t.userId === userId &&
          t.type === 'EXPENSE' &&
          t.categoryId === b.categoryId &&
          t.date.startsWith(month)
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const category = db.data.categories.find((c) => c.id === b.categoryId);

    return {
      ...b,
      categoryName: category?.name || 'Uncategorized',
      spentAmount: totalSpent,
      percentUsed: b.limitAmount > 0 ? Math.round((totalSpent / b.limitAmount) * 100) : 0,
    };
  });
}

export async function upsertCategoryBudget(
  userId: string,
  categoryId: string,
  month: string,
  limitAmount: number
): Promise<CategoryBudget> {
  let budget = db.data.categoryBudgets.find(
    (b) => b.userId === userId && b.categoryId === categoryId && b.month === month
  );

  if (budget) {
    budget.limitAmount = limitAmount;
  } else {
    budget = {
      id: crypto.randomUUID(),
      userId,
      categoryId,
      month,
      limitAmount,
      createdAt: new Date().toISOString(),
    };
    db.data.categoryBudgets.push(budget);
  }

  db.save();

  // Re-check threshold warnings
  await checkBudgetWarning(userId, categoryId, month);

  return budget;
}

export async function getMonthlyBudget(userId: string, month: string): Promise<MonthlyBudget | null> {
  const budget = db.data.monthlyBudgets.find((b) => b.userId === userId && b.month === month);
  if (!budget) return null;

  const totalExpense = db.data.transactions
    .filter((t) => t.userId === userId && t.type === 'EXPENSE' && t.date.startsWith(month))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    ...budget,
    spentAmount: totalExpense,
  };
}

export async function upsertMonthlyBudget(userId: string, month: string, limitAmount: number): Promise<MonthlyBudget> {
  let budget = db.data.monthlyBudgets.find((b) => b.userId === userId && b.month === month);

  if (budget) {
    budget.limitAmount = limitAmount;
  } else {
    budget = {
      id: crypto.randomUUID(),
      userId,
      month,
      limitAmount,
      createdAt: new Date().toISOString(),
    };
    db.data.monthlyBudgets.push(budget);
  }

  db.save();
  return budget;
}

export async function checkBudgetWarning(userId: string, categoryId: string | null | undefined, month: string) {
  if (!categoryId) return;

  const budget = db.data.categoryBudgets.find(
    (b) => b.userId === userId && b.categoryId === categoryId && b.month === month
  );
  if (!budget || budget.limitAmount <= 0) return;

  const totalSpent = db.data.transactions
    .filter(
      (t) =>
        t.userId === userId &&
        t.type === 'EXPENSE' &&
        t.categoryId === categoryId &&
        t.date.startsWith(month)
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const percent = (totalSpent / budget.limitAmount) * 100;
  const category = db.data.categories.find((c) => c.id === categoryId);
  const catName = category?.name || 'Category';

  if (percent >= 100) {
    const existing100 = db.data.notifications.find(
      (n) =>
        n.userId === userId &&
        n.type === 'BUDGET_WARNING' &&
        n.message.includes(catName) &&
        n.message.includes('exceeded') &&
        n.createdAt.startsWith(month)
    );
    if (!existing100) {
      createNotification(userId, {
        type: 'BUDGET_WARNING',
        category: 'Expenses',
        message: `Budget Alert: You have exceeded your limit for ${catName} (₹${Math.round(totalSpent).toLocaleString('en-IN')} / ₹${Math.round(budget.limitAmount).toLocaleString('en-IN')}).`,
      });
    }
  } else if (percent >= 80) {
    const existing80 = db.data.notifications.find(
      (n) =>
        n.userId === userId &&
        n.type === 'BUDGET_WARNING' &&
        n.message.includes(catName) &&
        n.message.includes('80%') &&
        n.createdAt.startsWith(month)
    );
    if (!existing80) {
      createNotification(userId, {
        type: 'BUDGET_WARNING',
        category: 'Expenses',
        message: `Budget Warning: You have used ${percent.toFixed(0)}% of your budget for ${catName} (₹${Math.round(totalSpent).toLocaleString('en-IN')} / ₹${Math.round(budget.limitAmount).toLocaleString('en-IN')}).`,
      });
    }
  }
}
