import crypto from 'node:crypto';
import { db } from '../db.js';
import { NotificationItem, NotificationCategory, NotificationType } from '../../src/types.js';

export function getNotificationCategory(type: NotificationType): NotificationCategory {
  switch (type) {
    case 'BUDGET_WARNING':
    case 'EXPENSE_ADDED':
    case 'EXPENSE_DELETED':
    case 'EXPENSE_SETTLED':
      return 'Expenses';

    case 'REPORT_READY':
    case 'IMPORT_READY':
      return 'Reports';

    case 'FRIEND_ADDED':
    case 'FRIEND_DELETED':
    case 'FRIEND_ACTIVITY':
      return 'Friends';

    case 'SYSTEM':
    default:
      return 'General';
  }
}

export function createNotification(
  userId: string,
  data: {
    type: NotificationType;
    message: string;
    category?: NotificationCategory;
  }
): NotificationItem {
  if (!db.data.notifications) {
    db.data.notifications = [];
  }

  const category = data.category || getNotificationCategory(data.type);

  const notif: NotificationItem = {
    id: crypto.randomUUID(),
    userId,
    type: data.type,
    category,
    message: data.message,
    read: false,
    createdAt: new Date().toISOString(),
  };

  db.data.notifications.unshift(notif);

  // Keep a maximum of 120 notifications per user
  const userNotifs = db.data.notifications.filter((n) => n.userId === userId);
  if (userNotifs.length > 120) {
    const toRemove = userNotifs.slice(120);
    const removeIds = new Set(toRemove.map((n) => n.id));
    db.data.notifications = db.data.notifications.filter((n) => !removeIds.has(n.id));
  }

  db.save();
  return notif;
}

export function getUserNotifications(userId: string): NotificationItem[] {
  if (!db.data.notifications) {
    db.data.notifications = [];
  }

  const items = db.data.notifications
    .filter((n) => n.userId === userId)
    .map((n) => ({
      ...n,
      category: n.category || getNotificationCategory(n.type),
    }));

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export function markNotificationRead(userId: string, notificationId: string): NotificationItem | null {
  if (!db.data.notifications) db.data.notifications = [];
  const notif = db.data.notifications.find((n) => n.id === notificationId && n.userId === userId);
  if (!notif) return null;
  notif.read = true;
  if (!notif.category) {
    notif.category = getNotificationCategory(notif.type);
  }
  db.save();
  return notif;
}

export function markAllNotificationsRead(userId: string): number {
  if (!db.data.notifications) db.data.notifications = [];
  let count = 0;
  for (const n of db.data.notifications) {
    if (n.userId === userId && !n.read) {
      n.read = true;
      if (!n.category) {
        n.category = getNotificationCategory(n.type);
      }
      count++;
    }
  }
  if (count > 0) {
    db.save();
  }
  return count;
}

export function deleteNotification(userId: string, notificationId: string): boolean {
  if (!db.data.notifications) db.data.notifications = [];
  const idx = db.data.notifications.findIndex((n) => n.id === notificationId && n.userId === userId);
  if (idx === -1) return false;
  db.data.notifications.splice(idx, 1);
  db.save();
  return true;
}

export function clearNotifications(userId: string, category?: NotificationCategory): number {
  if (!db.data.notifications) db.data.notifications = [];
  const initialLen = db.data.notifications.length;
  db.data.notifications = db.data.notifications.filter((n) => {
    if (n.userId !== userId) return true;
    if (!category) return false;
    const cat = n.category || getNotificationCategory(n.type);
    return cat !== category;
  });
  const removed = initialLen - db.data.notifications.length;
  if (removed > 0) {
    db.save();
  }
  return removed;
}
