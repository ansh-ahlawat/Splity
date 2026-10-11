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

const DB_FILE = process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'data_store.json')
  : path.join(process.cwd(), 'data_store.json');
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

  // Seed Categories
  const categoriesData = [
    { name: 'Food & Dining', icon: 'Utensils', color: '#10B981' },
    { name: 'Shopping', icon: 'ShoppingBag', color: '#3B82F6' },
    { name: 'Housing & Rent', icon: 'Home', color: '#8B5CF6' },
    { name: 'Transport & Fuel', icon: 'Car', color: '#F59E0B' },
    { name: 'Entertainment', icon: 'Tv', color: '#EC4899' },
    { name: 'Salary / Income', icon: 'Briefcase', color: '#059669' },
    { name: 'Utilities', icon: 'Zap', color: '#6366F1' },
  ];

  const catMap: Record<string, string> = {};
  categoriesData.forEach((c) => {
    const id = crypto.randomUUID();
    catMap[c.name] = id;
    dbData.categories.push({
      id,
      userId: DEMO_USER_ID,
      name: c.name,
      icon: c.icon,
      color: c.color,
      createdAt: new Date().toISOString(),
    });
  });

  // Monthly Budgets & Category Budgets across all 5 recent months
  const monthsConfig: Record<string, { monthlyBudget: number; categories: Record<string, number> }> = {
    '2026-05': {
      monthlyBudget: 40000,
      categories: {
        'Housing & Rent': 12000,
        'Food & Dining': 12000,
        'Shopping': 6000,
        'Transport & Fuel': 4000,
        'Utilities': 3000,
        'Entertainment': 3000,
      },
    },
    '2026-06': {
      monthlyBudget: 45000,
      categories: {
        'Housing & Rent': 12000,
        'Food & Dining': 14000,
        'Shopping': 8000,
        'Transport & Fuel': 4500,
        'Utilities': 3500,
        'Entertainment': 3000,
      },
    },
    '2026-07': {
      monthlyBudget: 42000,
      categories: {
        'Housing & Rent': 12000,
        'Food & Dining': 13000,
        'Shopping': 7000,
        'Transport & Fuel': 4000,
        'Utilities': 3000,
        'Entertainment': 3000,
      },
    },
    '2026-08': {
      monthlyBudget: 48000,
      categories: {
        'Housing & Rent': 12000,
        'Food & Dining': 15000,
        'Shopping': 10000,
        'Transport & Fuel': 4500,
        'Entertainment': 3500,
        'Utilities': 3000,
      },
    },
    '2026-09': {
      monthlyBudget: 45000,
      categories: {
        'Housing & Rent': 12000,
        'Food & Dining': 14000,
        'Shopping': 8000,
        'Transport & Fuel': 4500,
        'Utilities': 3000,
        'Entertainment': 3500,
      },
    },
  };

  Object.entries(monthsConfig).forEach(([m, cfg]) => {
    dbData.monthlyBudgets.push({
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      month: m,
      limitAmount: cfg.monthlyBudget,
      createdAt: new Date(`${m}-01T00:00:00Z`).toISOString(),
    });

    Object.entries(cfg.categories).forEach(([catName, limit]) => {
      dbData.categoryBudgets.push({
        id: crypto.randomUUID(),
        userId: DEMO_USER_ID,
        categoryId: catMap[catName],
        month: m,
        limitAmount: limit,
        createdAt: new Date(`${m}-01T00:00:00Z`).toISOString(),
      });
    });
  });

  // 20 distinct realistic transactions for each of the 5 months (total 100)
  const monthlyTransactions: Record<string, Array<{ type: TransactionType; amount: number; cat: string; merchant: string; note: string; d: string }>> = {
    '2026-05': [
      { type: 'INCOME', amount: 82000, cat: 'Salary / Income', merchant: 'Acme Technologies', note: 'Monthly Base Salary', d: '2026-05-01' },
      { type: 'EXPENSE', amount: 12000, cat: 'Housing & Rent', merchant: 'Prestige Living', note: 'Apartment Rent May', d: '2026-05-02' },
      { type: 'EXPENSE', amount: 1150, cat: 'Utilities', merchant: 'Tata Power', note: 'May Electricity Bill', d: '2026-05-03' },
      { type: 'EXPENSE', amount: 3200, cat: 'Food & Dining', merchant: "Nature's Basket", note: 'Monthly Pantry & Grocery Staples', d: '2026-05-04' },
      { type: 'EXPENSE', amount: 1500, cat: 'Transport & Fuel', merchant: 'Indian Oil', note: 'Full Tank Petrol', d: '2026-05-05' },
      { type: 'EXPENSE', amount: 680, cat: 'Food & Dining', merchant: 'Swiggy', note: 'Biryani & Starters Dinner', d: '2026-05-07' },
      { type: 'EXPENSE', amount: 2190, cat: 'Shopping', merchant: 'Zara India', note: 'Summer Casual Cotton Shirt', d: '2026-05-09' },
      { type: 'EXPENSE', amount: 650, cat: 'Transport & Fuel', merchant: 'Uber Premier', note: 'Airport Pick & Drop', d: '2026-05-11' },
      { type: 'EXPENSE', amount: 540, cat: 'Food & Dining', merchant: 'Blue Tokai Coffee', note: 'Coffee & Roasted Beans', d: '2026-05-13' },
      { type: 'EXPENSE', amount: 800, cat: 'Utilities', merchant: 'Airtel Xstream', note: 'Fiber Broadband 300 Mbps', d: '2026-05-14' },
      { type: 'EXPENSE', amount: 780, cat: 'Entertainment', merchant: 'BookMyShow', note: 'IMAX Movie Tickets', d: '2026-05-16' },
      { type: 'EXPENSE', amount: 890, cat: 'Food & Dining', merchant: 'Blinkit', note: 'Fresh Veggies & Dairy', d: '2026-05-18' },
      { type: 'EXPENSE', amount: 2110, cat: 'Shopping', merchant: 'Decathlon', note: 'Running Shoes & Sports Socks', d: '2026-05-19' },
      { type: 'EXPENSE', amount: 400, cat: 'Transport & Fuel', merchant: 'Metro Card Recharge', note: 'Automated DMRC Smartcard', d: '2026-05-21' },
      { type: 'EXPENSE', amount: 1950, cat: 'Food & Dining', merchant: 'Social CyberHub', note: 'Team Dinner & Drinks', d: '2026-05-23' },
      { type: 'EXPENSE', amount: 590, cat: 'Entertainment', merchant: 'Spotify India', note: 'Annual Family Plan Renewal', d: '2026-05-25' },
      { type: 'EXPENSE', amount: 1240, cat: 'Food & Dining', merchant: 'Zomato', note: 'Weekend Brunch with Friends', d: '2026-05-26' },
      { type: 'EXPENSE', amount: 300, cat: 'Transport & Fuel', merchant: 'Fastag Toll', note: 'Highway Fastag Auto-Debit', d: '2026-05-28' },
      { type: 'EXPENSE', amount: 530, cat: 'Entertainment', merchant: 'Cult.fit Live', note: 'Fitness Pass Extension', d: '2026-05-29' },
      { type: 'EXPENSE', amount: 950, cat: 'Food & Dining', merchant: 'Chai Point', note: 'Evening Chai & Samosa Meetup', d: '2026-05-30' },
    ],
    '2026-06': [
      { type: 'INCOME', amount: 82000, cat: 'Salary / Income', merchant: 'Acme Technologies', note: 'Monthly Base Salary', d: '2026-06-01' },
      { type: 'EXPENSE', amount: 12000, cat: 'Housing & Rent', merchant: 'Prestige Living', note: 'Apartment Rent June', d: '2026-06-02' },
      { type: 'EXPENSE', amount: 1650, cat: 'Utilities', merchant: 'Tata Power', note: 'Summer AC Electricity Bill', d: '2026-06-03' },
      { type: 'EXPENSE', amount: 1120, cat: 'Food & Dining', merchant: 'Blinkit', note: 'Gourmet Ice Creams & Beverages', d: '2026-06-05' },
      { type: 'EXPENSE', amount: 2200, cat: 'Transport & Fuel', merchant: 'HPCL Petrol', note: 'Weekend Road Trip Fuel Refuel', d: '2026-06-07' },
      { type: 'EXPENSE', amount: 3890, cat: 'Shopping', merchant: 'H&M India', note: 'Summer Wardrobe Essentials', d: '2026-06-09' },
      { type: 'EXPENSE', amount: 2450, cat: 'Food & Dining', merchant: 'Punjabi By Nature', note: 'Family Sunday Dinner', d: '2026-06-11' },
      { type: 'EXPENSE', amount: 1600, cat: 'Entertainment', merchant: 'BookMyShow', note: 'Live Music Concert Passes', d: '2026-06-13' },
      { type: 'INCOME', amount: 12500, cat: 'Salary / Income', merchant: 'FinTech Client', note: 'Freelance UI/UX Consulting Retainer', d: '2026-06-15' },
      { type: 'EXPENSE', amount: 1850, cat: 'Food & Dining', merchant: 'Swiggy Instamart', note: 'Weekly Provisions & Organic Fruits', d: '2026-06-16' },
      { type: 'EXPENSE', amount: 850, cat: 'Transport & Fuel', merchant: 'Uber Auto & Cabs', note: 'Weekly Office Commute', d: '2026-06-17' },
      { type: 'EXPENSE', amount: 3560, cat: 'Shopping', merchant: 'Croma Electronics', note: 'Mechanical Keyboard & Desk Mat', d: '2026-06-19' },
      { type: 'EXPENSE', amount: 2840, cat: 'Food & Dining', merchant: 'Smoke House Deli', note: 'Anniversary Celebration Lunch', d: '2026-06-21' },
      { type: 'EXPENSE', amount: 800, cat: 'Utilities', merchant: 'Airtel Xstream', note: 'Fiber Broadband Bill', d: '2026-06-22' },
      { type: 'EXPENSE', amount: 740, cat: 'Food & Dining', merchant: 'Third Wave Coffee', note: 'Cold Brews & Workspace Cafe', d: '2026-06-24' },
      { type: 'EXPENSE', amount: 699, cat: 'Entertainment', merchant: 'Sony LIV', note: 'Annual OTT Streaming Pass', d: '2026-06-25' },
      { type: 'EXPENSE', amount: 850, cat: 'Transport & Fuel', merchant: 'BluSmart EV', note: 'Weekend Green Travel Cabs', d: '2026-06-27' },
      { type: 'EXPENSE', amount: 3400, cat: 'Food & Dining', merchant: 'Toit Brewery', note: 'Craft Beer & Pizza Evening Meetup', d: '2026-06-28' },
      { type: 'EXPENSE', amount: 501, cat: 'Entertainment', merchant: 'Steam Games', note: 'Summer Indie Game Sale', d: '2026-06-29' },
      { type: 'EXPENSE', amount: 800, cat: 'Food & Dining', merchant: 'Sweet Bengal', note: 'Mishti Doi & Rasgulla', d: '2026-06-30' },
    ],
    '2026-07': [
      { type: 'INCOME', amount: 82000, cat: 'Salary / Income', merchant: 'Acme Technologies', note: 'Monthly Base Salary', d: '2026-07-01' },
      { type: 'EXPENSE', amount: 12000, cat: 'Housing & Rent', merchant: 'Prestige Living', note: 'Apartment Rent July', d: '2026-07-02' },
      { type: 'EXPENSE', amount: 1500, cat: 'Utilities', merchant: 'Tata Power', note: 'Monsoon Electricity Bill', d: '2026-07-04' },
      { type: 'EXPENSE', amount: 720, cat: 'Food & Dining', merchant: 'Zepto', note: 'Monsoon Snacks & Ginger Chai', d: '2026-07-06' },
      { type: 'EXPENSE', amount: 1600, cat: 'Transport & Fuel', merchant: 'Bharat Petroleum', note: 'Petrol Refuel Full Tank', d: '2026-07-08' },
      { type: 'INCOME', amount: 4000, cat: 'Salary / Income', merchant: 'HDFC MF', note: 'Semi-Annual Equity Mutual Fund Dividend', d: '2026-07-10' },
      { type: 'EXPENSE', amount: 2990, cat: 'Shopping', merchant: 'Uniqlo India', note: 'Waterproof Hooded Raincoat', d: '2026-07-11' },
      { type: 'EXPENSE', amount: 2150, cat: 'Food & Dining', merchant: 'Mamagoto', note: 'Pan Asian Dimsum Dinner', d: '2026-07-13' },
      { type: 'EXPENSE', amount: 850, cat: 'Utilities', merchant: 'Indane Gas', note: 'LPG Gas Cylinder Refill', d: '2026-07-15' },
      { type: 'EXPENSE', amount: 1380, cat: 'Food & Dining', merchant: 'Swiggy', note: 'Artisan Sourdough Pizza & Salad', d: '2026-07-16' },
      { type: 'EXPENSE', amount: 1150, cat: 'Entertainment', merchant: 'PVR Directors Cut', note: 'Gold Lounge Movie Screening', d: '2026-07-18' },
      { type: 'EXPENSE', amount: 450, cat: 'Transport & Fuel', merchant: 'Fastag Auto Topup', note: 'Interstate Expressway Tolls', d: '2026-07-19' },
      { type: 'EXPENSE', amount: 1820, cat: 'Food & Dining', merchant: "Nature's Basket", note: 'Cold-pressed Oils & Parmesan', d: '2026-07-21' },
      { type: 'EXPENSE', amount: 1900, cat: 'Shopping', merchant: 'Amazon India', note: 'Ergonomic Memory Foam Seat Cushion', d: '2026-07-23' },
      { type: 'EXPENSE', amount: 350, cat: 'Utilities', merchant: 'Airtel Xstream', note: 'Broadband Plan Topup Booster', d: '2026-07-24' },
      { type: 'EXPENSE', amount: 1400, cat: 'Transport & Fuel', merchant: 'Uber Intercity', note: 'Monsoon Getaway Shared Taxi', d: '2026-07-25' },
      { type: 'EXPENSE', amount: 2480, cat: 'Food & Dining', merchant: 'The Beer Cafe', note: 'Friday Craft Brew & Nachos Platter', d: '2026-07-26' },
      { type: 'EXPENSE', amount: 189, cat: 'Entertainment', merchant: 'YouTube Premium', note: 'Family Ad-free Monthly Pack', d: '2026-07-28' },
      { type: 'EXPENSE', amount: 761, cat: 'Entertainment', merchant: 'Comedy Club', note: 'Weekend Standup Comedy Ticket', d: '2026-07-29' },
      { type: 'EXPENSE', amount: 2600, cat: 'Food & Dining', merchant: 'Starbucks Coffee', note: 'Iced Latte & Breakfast Bagels', d: '2026-07-30' },
    ],
    '2026-08': [
      { type: 'INCOME', amount: 82000, cat: 'Salary / Income', merchant: 'Acme Technologies', note: 'Monthly Base Salary', d: '2026-08-01' },
      { type: 'EXPENSE', amount: 12000, cat: 'Housing & Rent', merchant: 'Prestige Living', note: 'Apartment Rent August', d: '2026-08-02' },
      { type: 'EXPENSE', amount: 1350, cat: 'Utilities', merchant: 'Tata Power', note: 'August Electricity Bill', d: '2026-08-03' },
      { type: 'EXPENSE', amount: 1700, cat: 'Transport & Fuel', merchant: 'Indian Oil', note: 'Fuel Tank Topup', d: '2026-08-05' },
      { type: 'EXPENSE', amount: 3450, cat: 'Food & Dining', merchant: 'BigBasket Super', note: 'Monthly Organic Pulses, Rice & Oil', d: '2026-08-07' },
      { type: 'EXPENSE', amount: 4900, cat: 'Shopping', merchant: 'Apple Store India', note: 'MagSafe Battery Pack & Silicone Case', d: '2026-08-09' },
      { type: 'EXPENSE', amount: 2750, cat: 'Food & Dining', merchant: 'Burma Burma', note: 'Authentic Burmese Vegetarian Feast', d: '2026-08-11' },
      { type: 'EXPENSE', amount: 800, cat: 'Transport & Fuel', merchant: 'DMRC Smartcard', note: 'Monthly Metro Pass Topup', d: '2026-08-13' },
      { type: 'INCOME', amount: 23000, cat: 'Salary / Income', merchant: 'Acme Technologies', note: 'Annual Performance Appraisal Bonus', d: '2026-08-14' },
      { type: 'EXPENSE', amount: 4300, cat: 'Shopping', merchant: 'Marks & Spencer', note: 'Festive Linen Shirt & Trousers', d: '2026-08-15' },
      { type: 'EXPENSE', amount: 3200, cat: 'Food & Dining', merchant: 'Mainland China', note: 'Team Bonus Celebration Dinner', d: '2026-08-17' },
      { type: 'EXPENSE', amount: 800, cat: 'Utilities', merchant: 'Airtel Xstream', note: 'Fiber Broadband 300 Mbps', d: '2026-08-19' },
      { type: 'EXPENSE', amount: 650, cat: 'Transport & Fuel', merchant: 'Uber Black', note: 'Late Night Safe City Drop', d: '2026-08-20' },
      { type: 'EXPENSE', amount: 1450, cat: 'Food & Dining', merchant: 'Zomato', note: 'Gourmet Truffle Burger & Fries', d: '2026-08-22' },
      { type: 'EXPENSE', amount: 1400, cat: 'Entertainment', merchant: 'PVR INOX', note: 'IMAX Gold Class Tickets', d: '2026-08-23' },
      { type: 'EXPENSE', amount: 300, cat: 'Utilities', merchant: 'Delhi Gas Ltd', note: 'Piped Natural Gas Meter Bill', d: '2026-08-25' },
      { type: 'EXPENSE', amount: 1150, cat: 'Food & Dining', merchant: 'Blinkit', note: 'Greek Yogurt & Fresh Berries', d: '2026-08-26' },
      { type: 'EXPENSE', amount: 650, cat: 'Transport & Fuel', merchant: 'BluSmart EV', note: 'Client Onsite Visit Cabs', d: '2026-08-27' },
      { type: 'EXPENSE', amount: 2100, cat: 'Food & Dining', merchant: 'Board Game Cafe', note: 'Board Games Session & Woodfired Pizza', d: '2026-08-28' },
      { type: 'EXPENSE', amount: 1200, cat: 'Entertainment', merchant: 'Smaaash Gaming', note: 'Weekend Bowling & VR Arcade', d: '2026-08-29' },
    ],
    '2026-09': [
      { type: 'INCOME', amount: 82000, cat: 'Salary / Income', merchant: 'Acme Technologies', note: 'Monthly Base Salary', d: '2026-09-01' },
      { type: 'EXPENSE', amount: 12000, cat: 'Housing & Rent', merchant: 'Prestige Living', note: 'Apartment Rent September', d: '2026-09-02' },
      { type: 'EXPENSE', amount: 1100, cat: 'Utilities', merchant: 'Tata Power', note: 'September Electricity Bill', d: '2026-09-03' },
      { type: 'EXPENSE', amount: 1850, cat: 'Food & Dining', merchant: 'Swiggy Instamart', note: 'Pantry & Grocery Staples', d: '2026-09-03' },
      { type: 'EXPENSE', amount: 1250, cat: 'Transport & Fuel', merchant: 'Shell Gas Station', note: 'Car Petrol Refuel', d: '2026-09-04' },
      { type: 'INCOME', amount: 7500, cat: 'Salary / Income', merchant: 'Substack Inc', note: 'Tech Architecture Article Honorarium', d: '2026-09-05' },
      { type: 'EXPENSE', amount: 1450, cat: 'Food & Dining', merchant: 'Zomato', note: 'Friday Celebration Dinner', d: '2026-09-05' },
      { type: 'EXPENSE', amount: 1690, cat: 'Shopping', merchant: 'Amazon India', note: 'Anker MagSafe Wireless Charging Stand', d: '2026-09-05' },
      { type: 'EXPENSE', amount: 650, cat: 'Food & Dining', merchant: 'Blue Tokai Coffee', note: 'Pour-over Coffee & Roasted Beans', d: '2026-09-06' },
      { type: 'EXPENSE', amount: 420, cat: 'Transport & Fuel', merchant: 'Uber Premier', note: 'Meeting Commute Ride', d: '2026-09-06' },
      { type: 'EXPENSE', amount: 950, cat: 'Shopping', merchant: 'FabIndia', note: 'Handcrafted Ceramic Studio Mug', d: '2026-09-06' },
      { type: 'EXPENSE', amount: 650, cat: 'Entertainment', merchant: 'PVR Cinemas', note: 'Weekend Blockbuster Movie Screening', d: '2026-09-06' },
      { type: 'EXPENSE', amount: 820, cat: 'Food & Dining', merchant: 'Blinkit', note: 'Fresh Avocados, Milk & Bread', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 280, cat: 'Transport & Fuel', merchant: 'Metro Card Recharge', note: 'DMRC Auto Topup', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 980, cat: 'Food & Dining', merchant: "Haldiram's", note: 'Lunch Thali & Kaju Katli Sweets', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 1000, cat: 'Shopping', merchant: 'Myntra', note: 'Slim-fit Cotton Chinos', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 600, cat: 'Utilities', merchant: 'Airtel Xstream', note: 'Fiber Broadband Bill', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 550, cat: 'Entertainment', merchant: 'Netflix India', note: '4K Ultra HD Monthly Plan', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 700, cat: 'Food & Dining', merchant: 'Third Wave Coffee', note: 'Espresso & Butter Croissant', d: '2026-09-07' },
      { type: 'EXPENSE', amount: 2000, cat: 'Food & Dining', merchant: 'Chai Point', note: 'Evening Snacks & Tea with Team', d: '2026-09-07' },
    ],
  };

  Object.entries(monthlyTransactions).forEach(([m, txList]) => {
    txList.forEach((t) => {
      dbData.transactions.push({
        id: crypto.randomUUID(),
        userId: DEMO_USER_ID,
        categoryId: catMap[t.cat] || null,
        categoryName: t.cat,
        type: t.type,
        amount: t.amount,
        merchant: t.merchant,
        note: t.note,
        date: t.d,
        source: 'MANUAL',
        createdAt: new Date(`${t.d}T10:00:00Z`).toISOString(),
      });
    });
  });

  // Seed 10 Friends
  dbData.friends = [
    { id: 'f-1', userId: DEMO_USER_ID, name: 'Rohan Sharma', phone: '+91 98765 11111', createdAt: new Date().toISOString() },
    { id: 'f-2', userId: DEMO_USER_ID, name: 'Priya Patel', phone: '+91 98765 22222', createdAt: new Date().toISOString() },
    { id: 'f-3', userId: DEMO_USER_ID, name: 'Aman Verma', phone: '+91 98765 33333', createdAt: new Date().toISOString() },
    { id: 'f-4', userId: DEMO_USER_ID, name: 'Sneha Gupta', phone: '+91 98765 44444', createdAt: new Date().toISOString() },
    { id: 'f-5', userId: DEMO_USER_ID, name: 'Vikram Malhotra', phone: '+91 98765 55555', createdAt: new Date().toISOString() },
    { id: 'f-6', userId: DEMO_USER_ID, name: 'Ananya Rao', phone: '+91 98765 66666', createdAt: new Date().toISOString() },
    { id: 'f-7', userId: DEMO_USER_ID, name: 'Kabir Mehta', phone: '+91 98765 77777', createdAt: new Date().toISOString() },
    { id: 'f-8', userId: DEMO_USER_ID, name: 'Tanvi Joshi', phone: '+91 98765 88888', createdAt: new Date().toISOString() },
    { id: 'f-9', userId: DEMO_USER_ID, name: 'Rahul Nair', phone: '+91 98765 99999', createdAt: new Date().toISOString() },
    { id: 'f-10', userId: DEMO_USER_ID, name: 'Pooja Deshmukh', phone: '+91 98765 00000', createdAt: new Date().toISOString() },
  ];

  // Seed 4 Groups
  dbData.friendGroups = [
    {
      id: 'g-1',
      userId: DEMO_USER_ID,
      name: 'Goa Weekend Trip',
      description: 'Shared villa, beach dinners & fuel expenses',
      members: ['Rohan Sharma', 'Priya Patel', 'Aman Verma', 'Sneha Gupta'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'g-2',
      userId: DEMO_USER_ID,
      name: 'Roommates & Flat 402',
      description: 'Monthly groceries, cook, WiFi & utilities',
      members: ['Vikram Malhotra', 'Kabir Mehta'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'g-3',
      userId: DEMO_USER_ID,
      name: 'Friday Dinner & Hangouts',
      description: 'Weekly team dinners, cafes & drinks',
      members: ['Ananya Rao', 'Tanvi Joshi', 'Rahul Nair'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'g-4',
      userId: DEMO_USER_ID,
      name: 'Manali Trek 2026',
      description: 'Trek booking, tents & transportation',
      members: ['Rohan Sharma', 'Pooja Deshmukh', 'Aman Verma'],
      createdAt: new Date().toISOString(),
    },
  ];

  // Seed Debts
  dbData.friendDebts = [
    {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      friendName: 'Rohan Sharma',
      groupId: 'g-1',
      groupName: 'Goa Weekend Trip',
      amount: 1450,
      type: 'YOU_OWE',
      description: 'Dinner at Fisherman Wharf',
      settled: false,
      date: '2026-09-05',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      friendName: 'Priya Patel',
      groupId: null,
      groupName: null,
      amount: 3200,
      type: 'OWED_TO_YOU',
      description: 'Concert passes advance booking',
      settled: false,
      date: '2026-09-04',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      friendName: 'Aman Verma',
      groupId: 'g-1',
      groupName: 'Goa Weekend Trip',
      amount: 850,
      type: 'YOU_OWE',
      description: 'Fuel & Highway toll split',
      settled: false,
      date: '2026-09-03',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      friendName: 'Sneha Gupta',
      groupId: null,
      groupName: null,
      amount: 1900,
      type: 'OWED_TO_YOU',
      description: 'Birthday celebration cake & decor',
      settled: false,
      date: '2026-09-02',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      friendName: 'Vikram Malhotra',
      groupId: 'g-2',
      groupName: 'Roommates & Flat 402',
      amount: 2500,
      type: 'OWED_TO_YOU',
      description: 'Cook & maid monthly salary share',
      settled: false,
      date: '2026-09-01',
      createdAt: new Date().toISOString(),
    },
  ];

  // Seed Notification
  dbData.notifications = [
    {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      type: 'SYSTEM',
      message: 'Welcome to Expense Buddy! Your accounts, 5 months of historical financial data, and peer splits are loaded.',
      read: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbData = JSON.parse(content);
      // Auto upgrade if old seed without 5 full months
      if (!dbData.transactions || dbData.transactions.length < 50) {
        initSeedData();
        saveDb();
      }
    } else if (fs.existsSync(EXAMPLE_DB_FILE)) {
      const content = fs.readFileSync(EXAMPLE_DB_FILE, 'utf-8');
      dbData = JSON.parse(content);
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
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file', err);
  }
}

// Initialize on start
loadDb();

export const db = {
  get data() {
    return dbData;
  },
  save: saveDb,
  reload: loadDb,
};
