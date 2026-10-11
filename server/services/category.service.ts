import crypto from 'node:crypto';
import { db } from '../db.js';
import { Category } from '../../src/types.js';

export async function getUserCategories(userId: string): Promise<Category[]> {
  return db.data.categories.filter((c) => c.userId === userId);
}

export async function createCategory(
  userId: string,
  name: string,
  icon?: string,
  color?: string
): Promise<Category> {
  const existing = db.data.categories.find(
    (c) => c.userId === userId && c.name.toLowerCase() === name.trim().toLowerCase()
  );

  if (existing) {
    throw { status: 409, message: `Category "${name}" already exists` };
  }

  const category: Category = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim(),
    icon: icon || 'Tag',
    color: color || '#6B7280',
    createdAt: new Date().toISOString(),
  };

  db.data.categories.push(category);
  db.save();
  return category;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  updates: { name?: string; icon?: string; color?: string }
): Promise<Category> {
  const category = db.data.categories.find((c) => c.id === categoryId && c.userId === userId);
  if (!category) {
    throw { status: 404, message: 'Category not found' };
  }

  if (updates.name && updates.name.trim().toLowerCase() !== category.name.toLowerCase()) {
    const dup = db.data.categories.find(
      (c) => c.userId === userId && c.id !== categoryId && c.name.toLowerCase() === updates.name!.trim().toLowerCase()
    );
    if (dup) {
      throw { status: 409, message: `Category name "${updates.name}" already in use` };
    }
    category.name = updates.name.trim();
  }

  if (updates.icon !== undefined) category.icon = updates.icon;
  if (updates.color !== undefined) category.color = updates.color;

  db.save();
  return category;
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  const idx = db.data.categories.findIndex((c) => c.id === categoryId && c.userId === userId);
  if (idx === -1) {
    throw { status: 404, message: 'Category not found' };
  }

  db.data.categories.splice(idx, 1);

  // Set onDelete: SetNull for transactions
  db.data.transactions.forEach((tx) => {
    if (tx.userId === userId && tx.categoryId === categoryId) {
      tx.categoryId = null;
      tx.categoryName = 'Uncategorized';
    }
  });

  db.save();
}
