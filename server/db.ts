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

interface DbSchema {
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
  createdAt: new Date().toISOString(),
};

export function ensureDemoData() {
  const hasDemo = dbData.users.some((u) => u.id === DEMO_USER_ID);
  if (!hasDemo) {
    dbData.users.unshift(DEMO_USER);
  }
  dbData.userPasswords[DEMO_USER_ID] =
    'scrypt:808080:e7b00366a5c2b620a23bc38703a893ef:994488a07fffc568a9e69b55bfdc422dfa4d033a37d3ef02e1a5e35752cb6d6da4023ed5f417a6f126d53f2c2c3e0518f605165888972f32e7c6436387e397d3';

  // 1. Exactly 3 Categories with proper semantic IDs
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

  // 2. Exactly 3 Friends with proper semantic IDs
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

  // 3. Exactly 2 Groups with proper semantic IDs and descriptions
  const demoGroups: FriendGroup[] = [
    {
      id: 'group-goa-trip',
      userId: DEMO_USER_ID,
      name: 'Goa Weekend Trip',
      description: 'Shared beach villa rental, seafood dinners & car fuel',
      members: ['Rohan Sharma', 'Priya Patel', 'Aman Verma'],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'group-roommates-flat',
      userId: DEMO_USER_ID,
      name: 'Roommates & Flat 402',
      description: 'Monthly flat groceries, broadband internet & utility splits',
      members: ['Rohan Sharma', 'Aman Verma'],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  // 4. Exactly 3 Debts (1 owe & 2 owed) with proper semantic IDs and descriptions
  const demoDebts: FriendDebt[] = [
    {
      id: 'debt-goa-villa-dinner',
      userId: DEMO_USER_ID,
      friendName: 'Rohan Sharma',
      groupId: 'group-goa-trip',
      groupName: 'Goa Weekend Trip',
      amount: 1450,
      type: 'YOU_OWE',
      description: 'Seafood dinner & drinks bill split at Fisherman Wharf',
      settled: false,
      date: '2026-10-18',
      createdAt: '2026-10-18T21:00:00.000Z',
    },
    {
      id: 'debt-concert-pass-booking',
      userId: DEMO_USER_ID,
      friendName: 'Priya Patel',
      groupId: null,
      groupName: null,
      amount: 3200,
      type: 'OWED_TO_YOU',
      description: 'Advance booking for live music concert passes',
      settled: false,
      date: '2026-10-19',
      createdAt: '2026-10-19T14:30:00.000Z',
    },
    {
      id: 'debt-flat-wifi-groceries',
      userId: DEMO_USER_ID,
      friendName: 'Aman Verma',
      groupId: 'group-roommates-flat',
      groupName: 'Roommates & Flat 402',
      amount: 1850,
      type: 'OWED_TO_YOU',
      description: 'Airtel Xstream fiber WiFi & pantry staples monthly split',
      settled: false,
      date: '2026-10-20',
      createdAt: '2026-10-20T16:00:00.000Z',
    },
  ];

  // 5. Exactly 5 Transactions with proper semantic IDs and descriptions
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

  // 6. Budgets for the 3 categories
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

  dbData.categories = [
    ...dbData.categories.filter((c) => c.userId !== DEMO_USER_ID),
    ...demoCategories,
  ];

  dbData.friends = [
    ...dbData.friends.filter((f) => f.userId !== DEMO_USER_ID),
    ...demoFriends,
  ];

  dbData.friendGroups = [
    ...dbData.friendGroups.filter((g) => g.userId !== DEMO_USER_ID),
    ...demoGroups,
  ];

  dbData.friendDebts = [
    ...dbData.friendDebts.filter((d) => d.userId !== DEMO_USER_ID),
    ...demoDebts,
  ];

  dbData.transactions = [
    ...dbData.transactions.filter((t) => t.userId !== DEMO_USER_ID),
    ...demoTransactions,
  ];

  dbData.monthlyBudgets = [
    ...dbData.monthlyBudgets.filter((b) => b.userId !== DEMO_USER_ID),
    ...demoMonthlyBudgets,
  ];

  dbData.categoryBudgets = [
    ...dbData.categoryBudgets.filter((cb) => cb.userId !== DEMO_USER_ID),
    ...demoCategoryBudgets,
  ];

  dbData.notifications = [
    ...dbData.notifications.filter((n) => n.userId !== DEMO_USER_ID),
    ...demoNotifications,
  ];
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

async function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        dbData = parsed;
        ensureDemoData();
        saveDb();
      } else {
        initSeedData();
        saveDb();
      }
    } else if (fs.existsSync(EXAMPLE_DB_FILE)) {
      const content = fs.readFileSync(EXAMPLE_DB_FILE, 'utf-8');
      dbData = JSON.parse(content);
      ensureDemoData();
      saveDb();
    } else {
      initSeedData();
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load local database, initializing fresh seed', err);
    initSeedData();
    saveDb();
  }

  // Attempt to sync from DynamoDB in the background
  try {
    const tableReady = await ensureDynamoTable();
    if (tableReady) {
      const remoteData = await loadAllFromDynamoDb();
      if (remoteData && Object.keys(remoteData).length > 0) {
        // Merge remote items from DynamoDB if present
        let mergedCount = 0;
        for (const [key, items] of Object.entries(remoteData)) {
          if (Array.isArray(items) && items.length > 0 && Array.isArray((dbData as any)[key])) {
            const localArr: any[] = (dbData as any)[key];
            for (const item of items) {
              const existingIndex = localArr.findIndex((x) => x.id === item.id);
              if (existingIndex >= 0) {
                localArr[existingIndex] = item;
              } else {
                localArr.push(item);
              }
              mergedCount++;
            }
          }
        }
        if (mergedCount > 0) {
          console.log(`[AWS DynamoDB] Merged ${mergedCount} items from DynamoDB into local memory.`);
          saveLocalFileOnly();
        }
      }
    }
  } catch (e: any) {
    console.warn('[AWS DynamoDB] Startup sync notice:', e.message);
  }
}

function saveLocalFileOnly() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save local database file', err);
  }
}

function saveDb(options?: { syncCollection?: keyof DbSchema; syncItem?: any; deleteItem?: { collection: keyof DbSchema; id: string } }) {
  saveLocalFileOnly();

  // Async sync to DynamoDB
  if (options?.syncCollection && options?.syncItem) {
    putDynamoItem(String(options.syncCollection), options.syncItem).catch((err) => {
      console.warn(`[AWS DynamoDB] Failed to sync ${String(options.syncCollection)} item to DynamoDB:`, err.message);
    });
  } else if (options?.deleteItem) {
    deleteDynamoItem(String(options.deleteItem.collection), options.deleteItem.id).catch((err) => {
      console.warn(`[AWS DynamoDB] Failed to delete ${String(options.deleteItem.collection)} item from DynamoDB:`, err.message);
    });
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

// Initialize on start
loadDb();

export const db = {
  get data() {
    return dbData;
  },
  save: saveDb,
  reload: loadDb,
  saveItem: (collection: keyof DbSchema, item: any) => {
    saveDb({ syncCollection: collection, syncItem: item });
  },
  deleteItem: (collection: keyof DbSchema, id: string) => {
    saveDb({ deleteItem: { collection, id } });
  },
  syncAllToDynamo,
  getAwsStatus,
};
