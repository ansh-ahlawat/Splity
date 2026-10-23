import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  User,
  Session,
  Category,
  Transaction,
  CategoryBudget,
  MonthlyBudget,
  ImportJob,
  ImportItem,
  NotificationItem,
  MonthlyReportJob,
  TransactionType
} from '../src/types.js';
import {
  putDynamoItem,
  deleteDynamoItem,
  loadAllFromDynamoDb,
  ensureDynamoTable,
  getAwsStatus
} from './aws/aws.service.js';

const DB_FILE = path.join(process.cwd(), 'data_store.json');
const EXAMPLE_DB_FILE = path.join(process.cwd(), 'data_store.example.json');

export interface Friend {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
}

export interface FriendGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  members: string[];
  createdAt: string;
}

export interface FriendDebt {
  id: string;
  userId: string;
  friendName: string;
  friendPhone?: string | null;
  creatorName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  amount: number;
  type: 'YOU_OWE' | 'OWED_TO_YOU';
  description: string;
  settled: boolean;
  date: string;
  createdAt: string;
}

export interface DbSchema {
  users: User[];
  userPasswords: Record<string, string>;
  sessions: Session[];
  categories: Category[];
  transactions: Transaction[];
  categoryBudgets: CategoryBudget[];
  monthlyBudgets: MonthlyBudget[];
  importJobs: ImportJob[];
  importItems: ImportItem[];
  notifications: NotificationItem[];
  reportJobs: MonthlyReportJob[];
  friends: Friend[];
  friendGroups: FriendGroup[];
  friendDebts: FriendDebt[];
}

let dbData: DbSchema = {
  users: [],
  userPasswords: {},
  sessions: [],
  categories: [],
  transactions: [],
  categoryBudgets: [],
  monthlyBudgets: [],
  importJobs: [],
  importItems: [],
  notifications: [],
  reportJobs: [],
  friends: [],
  friendGroups: [],
  friendDebts: [],
};

const DEMO_USER_ID = 'demo-user-123';
const DEMO_USER: User = {
  id: DEMO_USER_ID,
  email: 'demo@expensebuddy.app',
  phone: '+91 00000 00000',
  name: 'Ansh Ahlawat',
  spendingCeiling: 45000,
  targetSavings: 40000,
  profileSetupCompleted: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

export function ensureDemoData() {
  if (!dbData.users) dbData.users = [];
  if (!dbData.categories) dbData.categories = [];
  if (!dbData.friends) dbData.friends = [];
  if (!dbData.friendGroups) dbData.friendGroups = [];
  if (!dbData.friendDebts) dbData.friendDebts = [];
  if (!dbData.transactions) dbData.transactions = [];
  if (!dbData.monthlyBudgets) dbData.monthlyBudgets = [];
  if (!dbData.categoryBudgets) dbData.categoryBudgets = [];
  if (!dbData.notifications) dbData.notifications = [];
  if (!dbData.userPasswords) dbData.userPasswords = {};

  // 1. Demo User
  const userIdx = dbData.users.findIndex((u) => u.id === DEMO_USER_ID);
  if (userIdx >= 0) {
    dbData.users[userIdx] = { ...DEMO_USER, ...dbData.users[userIdx] };
  } else {
    dbData.users.push(DEMO_USER);
  }

  // Password123!
  dbData.userPasswords[DEMO_USER_ID] =
    'scrypt:808080:e7b00366a5c2b620a23bc38703a893ef:994488a07fffc568a9e69b55bfdc422dfa4d033a37d3ef02e1a5e35752cb6d6da4023ed5f417a6f126d53f2c2c3e0518f605165888972f32e7c6436387e397d3';

  // 2. Exactly 3 Categories with Semantic IDs
  const demoCategories: Category[] = [
    {
      id: 'cat-housing-rent',
      userId: DEMO_USER_ID,
      name: 'Housing & Rent',
      icon: 'Home',
      color: '#8B5CF6',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'cat-food-dining',
      userId: DEMO_USER_ID,
      name: 'Food & Dining',
      icon: 'Utensils',
      color: '#10B981',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'cat-shopping-lifestyle',
      userId: DEMO_USER_ID,
      name: 'Shopping & Lifestyle',
      icon: 'ShoppingBag',
      color: '#3B82F6',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  // 3. Exactly 3 Friends with Semantic IDs
  const demoFriends: Friend[] = [
    {
      id: 'friend-rohan-sharma',
      userId: DEMO_USER_ID,
      name: 'Rohan Sharma',
      phone: '+91 98765 11111',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'friend-priya-patel',
      userId: DEMO_USER_ID,
      name: 'Priya Patel',
      phone: '+91 98765 22222',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'friend-aman-verma',
      userId: DEMO_USER_ID,
      name: 'Aman Verma',
      phone: '+91 98765 33333',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  // 4. Exactly 2 Friend Groups with Semantic IDs
  const demoGroups: FriendGroup[] = [
    {
      id: 'group-goa-trip',
      userId: DEMO_USER_ID,
      name: 'Goa Weekend Trip',
      description: 'Goa villa stay, dining, and beach scooty expenses',
      members: [DEMO_USER_ID, 'friend-rohan-sharma', 'friend-priya-patel'],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'group-roommates-flat',
      userId: DEMO_USER_ID,
      name: 'Roommates & Flat 402',
      description: 'Shared flat rent, high-speed WiFi, maid, and monthly groceries',
      members: [DEMO_USER_ID, 'friend-aman-verma'],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  // 5. Exactly 3 Debts (1 owe, 2 owed)
  const demoDebts: FriendDebt[] = [
    {
      id: 'debt-goa-villa-dinner',
      userId: DEMO_USER_ID,
      friendName: 'Rohan Sharma',
      friendPhone: '+91 98765 11111',
      groupId: 'group-goa-trip',
      groupName: 'Goa Weekend Trip',
      amount: 1450,
      type: 'YOU_OWE',
      description: 'Seafood dinner & drinks bill split at Fisherman Wharf',
      settled: false,
      date: '2026-10-18',
      createdAt: '2026-10-18T00:00:00.000Z',
    },
    {
      id: 'debt-concert-pass-booking',
      userId: DEMO_USER_ID,
      friendName: 'Priya Patel',
      friendPhone: '+91 98765 22222',
      groupId: null,
      groupName: null,
      amount: 3200,
      type: 'OWED_TO_YOU',
      description: 'Advance booking for live music concert passes',
      settled: false,
      date: '2026-10-19',
      createdAt: '2026-10-19T00:00:00.000Z',
    },
    {
      id: 'debt-flat-wifi-groceries',
      userId: DEMO_USER_ID,
      friendName: 'Aman Verma',
      friendPhone: '+91 98765 33333',
      groupId: 'group-roommates-flat',
      groupName: 'Roommates & Flat 402',
      amount: 1850,
      type: 'OWED_TO_YOU',
      description: 'Airtel Xstream fiber WiFi & pantry staples monthly split',
      settled: false,
      date: '2026-10-20',
      createdAt: '2026-10-20T00:00:00.000Z',
    },
  ];

  // 6. Exactly 5 Transactions with Semantic IDs
  const demoTransactions: Transaction[] = [
    {
      id: 'txn-salary-deposit-oct',
      userId: DEMO_USER_ID,
      categoryId: null,
      categoryName: 'Salary / Income',
      type: 'INCOME',
      amount: 82000,
      merchant: 'Acme Technologies',
      note: 'Monthly Senior Engineer salary direct credit',
      date: '2026-10-01',
      source: 'MANUAL',
      createdAt: '2026-10-01T09:00:00.000Z',
    },
    {
      id: 'txn-apartment-rent-oct',
      userId: DEMO_USER_ID,
      categoryId: 'cat-housing-rent',
      categoryName: 'Housing & Rent',
      type: 'EXPENSE',
      amount: 12000,
      merchant: 'Prestige Living Properties',
      note: 'Monthly 2BHK apartment rent payment',
      date: '2026-10-02',
      source: 'MANUAL',
      createdAt: '2026-10-02T10:30:00.000Z',
    },
    {
      id: 'txn-groceries-supermarket',
      userId: DEMO_USER_ID,
      categoryId: 'cat-food-dining',
      categoryName: 'Food & Dining',
      type: 'EXPENSE',
      amount: 3200,
      merchant: "Nature's Basket Gourmet",
      note: 'Monthly organic pantry supplies & olive oil',
      date: '2026-10-06',
      source: 'MANUAL',
      createdAt: '2026-10-06T15:20:00.000Z',
    },
    {
      id: 'txn-coffee-roasters',
      userId: DEMO_USER_ID,
      categoryId: 'cat-food-dining',
      categoryName: 'Food & Dining',
      type: 'EXPENSE',
      amount: 850,
      merchant: 'Blue Tokai Coffee Roasters',
      note: 'Artisan pour-over coffee & breakfast croissant',
      date: '2026-10-12',
      source: 'MANUAL',
      createdAt: '2026-10-12T11:45:00.000Z',
    },
    {
      id: 'txn-work-desk-accessories',
      userId: DEMO_USER_ID,
      categoryId: 'cat-shopping-lifestyle',
      categoryName: 'Shopping & Lifestyle',
      type: 'EXPENSE',
      amount: 2450,
      merchant: 'Amazon India',
      note: 'Ergonomic aluminum laptop stand & wireless mouse',
      date: '2026-10-17',
      source: 'MANUAL',
      createdAt: '2026-10-17T18:10:00.000Z',
    },
  ];

  // 7. Budgets for the 3 Categories
  const demoMonthlyBudgets: MonthlyBudget[] = [
    {
      id: 'mbudget-demo-2026-10',
      userId: DEMO_USER_ID,
      month: '2026-10',
      limitAmount: 45000,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const demoCategoryBudgets: CategoryBudget[] = [
    {
      id: 'cbudget-housing-rent-2026-10',
      userId: DEMO_USER_ID,
      categoryId: 'cat-housing-rent',
      month: '2026-10',
      limitAmount: 15000,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'cbudget-food-dining-2026-10',
      userId: DEMO_USER_ID,
      categoryId: 'cat-food-dining',
      month: '2026-10',
      limitAmount: 14000,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'cbudget-shopping-lifestyle-2026-10',
      userId: DEMO_USER_ID,
      categoryId: 'cat-shopping-lifestyle',
      month: '2026-10',
      limitAmount: 8000,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const demoNotifications: NotificationItem[] = [
    {
      id: 'notif-welcome-demo',
      userId: DEMO_USER_ID,
      type: 'SYSTEM',
      message: 'Welcome to Splity! Your 3 categories, 5 transactions, and 3 friend balances are ready.',
      read: false,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  if (dbData.categories.filter((c) => c.userId === DEMO_USER_ID).length === 0) {
    dbData.categories.push(...demoCategories);
  }
  if (dbData.friends.filter((f) => f.userId === DEMO_USER_ID).length === 0) {
    dbData.friends.push(...demoFriends);
  }
  if (dbData.friendGroups.filter((g) => g.userId === DEMO_USER_ID).length === 0) {
    dbData.friendGroups.push(...demoGroups);
  }
  if (dbData.friendDebts.filter((d) => d.userId === DEMO_USER_ID).length === 0) {
    dbData.friendDebts.push(...demoDebts);
  }
  if (dbData.transactions.filter((t) => t.userId === DEMO_USER_ID).length === 0) {
    dbData.transactions.push(...demoTransactions);
  }
  if (dbData.monthlyBudgets.filter((b) => b.userId === DEMO_USER_ID).length === 0) {
    dbData.monthlyBudgets.push(...demoMonthlyBudgets);
  }
  if (dbData.categoryBudgets.filter((cb) => cb.userId === DEMO_USER_ID).length === 0) {
    dbData.categoryBudgets.push(...demoCategoryBudgets);
  }
  if (dbData.notifications.filter((n) => n.userId === DEMO_USER_ID).length === 0) {
    dbData.notifications.push(...demoNotifications);
  }
}

export function initSeedData() {
  dbData = {
    users: [DEMO_USER],
    userPasswords: {
      [DEMO_USER_ID]:
        'scrypt:808080:e7b00366a5c2b620a23bc38703a893ef:994488a07fffc568a9e69b55bfdc422dfa4d033a37d3ef02e1a5e35752cb6d6da4023ed5f417a6f126d53f2c2c3e0518f605165888972f32e7c6436387e397d3',
    },
    sessions: [],
    categories: [],
    transactions: [],
    categoryBudgets: [],
    monthlyBudgets: [],
    importJobs: [],
    importItems: [],
    notifications: [],
    reportJobs: [],
    friends: [],
    friendGroups: [],
    friendDebts: [],
  };

  ensureDemoData();
}

let lastDynamoSync = 0;
const SYNC_COOLDOWN_MS = 1500; // 1.5 seconds cooldown between full scans

export async function syncFromDynamo(force = false) {
  const now = Date.now();
  if (!force && now - lastDynamoSync < SYNC_COOLDOWN_MS) {
    return;
  }

  try {
    const remoteData = await loadAllFromDynamoDb();
    if (remoteData && Object.keys(remoteData).length > 0) {
      const collections: (keyof DbSchema)[] = [
        'users',
        'categories',
        'transactions',
        'categoryBudgets',
        'monthlyBudgets',
        'friends',
        'friendGroups',
        'friendDebts',
        'notifications',
        'reportJobs',
      ];

      for (const coll of collections) {
        if (Array.isArray(remoteData[coll]) && remoteData[coll].length > 0) {
          (dbData as any)[coll] = remoteData[coll];
        }
      }

      ensureDemoData();
      lastDynamoSync = now;
      saveLocalFileOnly();
    }
  } catch (err: any) {
    console.warn('[AWS DynamoDB] syncFromDynamo notice:', err.message);
  }
}

async function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        dbData = parsed;
        ensureDemoData();
        saveLocalFileOnly();
      } else {
        initSeedData();
        saveLocalFileOnly();
      }
    } else if (fs.existsSync(EXAMPLE_DB_FILE)) {
      const content = fs.readFileSync(EXAMPLE_DB_FILE, 'utf-8');
      dbData = JSON.parse(content);
      ensureDemoData();
      saveLocalFileOnly();
    } else {
      initSeedData();
      saveLocalFileOnly();
    }
  } catch (err) {
    initSeedData();
    saveLocalFileOnly();
  }

  // Attempt to sync from DynamoDB
  await syncFromDynamo(true);
}

function saveLocalFileOnly() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    // In read-only lambda environments, ignoring local file write failure is safe
  }
}

async function saveItem(collection: keyof DbSchema, item: any) {
  const list = (dbData as any)[collection];
  if (Array.isArray(list)) {
    const idx = list.findIndex((x: any) => x.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
  }
  saveLocalFileOnly();

  // Persist directly to DynamoDB so all serverless instances immediately see it
  try {
    await putDynamoItem(String(collection), item);
  } catch (err: any) {
    console.warn(`[AWS DynamoDB] Failed to sync ${String(collection)} to DynamoDB:`, err.message);
  }
}

async function deleteItem(collection: keyof DbSchema, id: string, userId = 'demo-user-123') {
  const list = (dbData as any)[collection];
  if (Array.isArray(list)) {
    const idx = list.findIndex((x: any) => x.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
  }
  saveLocalFileOnly();

  // Delete directly from DynamoDB so all serverless instances immediately see it
  try {
    await deleteDynamoItem(String(collection), id, userId);
  } catch (err: any) {
    console.warn(`[AWS DynamoDB] Failed to delete ${String(collection)} from DynamoDB:`, err.message);
  }
}

async function syncAllToDynamo(): Promise<{ success: boolean; totalSynced: number }> {
  let count = 0;
  const collections: (keyof DbSchema)[] = [
    'users',
    'categories',
    'transactions',
    'categoryBudgets',
    'monthlyBudgets',
    'friends',
    'friendGroups',
    'friendDebts',
    'notifications',
    'reportJobs',
  ];

  for (const coll of collections) {
    const list = dbData[coll];
    if (Array.isArray(list)) {
      for (const item of list) {
        const ok = await putDynamoItem(String(coll), item);
        if (ok) count++;
      }
    }
  }
  return { success: true, totalSynced: count };
}

// Initial sync on startup
loadDb();

export const db = {
  get data() {
    return dbData;
  },
  save: saveLocalFileOnly,
  reload: loadDb,
  syncFromDynamo,
  saveItem,
  deleteItem,
  syncAllToDynamo,
  getAwsStatus,
};
