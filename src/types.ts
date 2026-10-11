export type TransactionType = 'EXPENSE' | 'INCOME';
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'REVIEW' | 'COMMITTED' | 'FAILED';
export type ImportItemStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type NotificationCategory = 'General' | 'Expenses' | 'Reports' | 'Friends';
export type NotificationType =
  | 'BUDGET_WARNING'
  | 'IMPORT_READY'
  | 'REPORT_READY'
  | 'SYSTEM'
  | 'FRIEND_ACTIVITY'
  | 'FRIEND_ADDED'
  | 'FRIEND_DELETED'
  | 'EXPENSE_ADDED'
  | 'EXPENSE_DELETED'
  | 'EXPENSE_SETTLED';

export interface User {
  id: string;
  email: string;
  phone: string;
  name?: string;
  spendingCeiling?: number;
  targetSavings?: number;
  profileSetupCompleted?: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId?: string | null;
  categoryName?: string;
  type: TransactionType;
  amount: number;
  merchant?: string;
  note?: string;
  date: string; // ISO YYYY-MM-DD
  source: 'MANUAL' | 'IMPORT';
  createdAt: string;
}

export interface CategoryBudget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName?: string;
  month: string; // YYYY-MM
  limitAmount: number;
  spentAmount?: number;
  percentUsed?: number;
  createdAt: string;
}

export interface MonthlyBudget {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  limitAmount: number;
  spentAmount?: number;
  createdAt: string;
}

export interface ImportItem {
  id: string;
  importJobId: string;
  rawText?: string;
  date?: string;
  amount?: number;
  merchant?: string;
  type?: TransactionType;
  suggestedCategoryId?: string | null;
  confidence?: number;
  status: ImportItemStatus;
}

export interface ImportJob {
  id: string;
  userId: string;
  fileKey: string;
  fileName: string;
  fileType: 'PDF' | 'IMAGE';
  status: ImportStatus;
  items?: ImportItem[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  category?: NotificationCategory;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface MonthlySummary {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netSaved: number;
  savingsRate: number;
  monthlyBudget?: number;
}

export interface CategorySpend {
  categoryId: string;
  categoryName: string;
  color?: string;
  total: number;
  limitAmount?: number;
  percentUsed?: number;
}

export interface TopMerchant {
  merchant: string;
  total: number;
  count: number;
}

export interface Friend {
  id: string;
  userId: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface Group {
  id: string;
  userId: string;
  name: string;
  memberNames: string[];
  createdAt: string;
}

export type DebtType = 'YOU_OWE' | 'OWED_TO_YOU';

export interface FriendDebt {
  id: string;
  userId: string;
  friendName: string;
  friendPhone?: string;
  creatorName?: string;
  groupName?: string;
  type: DebtType;
  amount: number;
  description: string;
  status: 'PENDING' | 'SETTLED';
  date: string;
  createdAt: string;
}

export interface DebtSummary {
  youOweTotal: number;
  owedToYouTotal: number;
  debts: FriendDebt[];
  settledCount?: number;
}

export interface SmartSearchResult {
  intent: string;
  source: 'rule' | 'gemini';
  query: string;
  message: string;
  data?: any;
  actionTaken?: boolean;
}

export interface MonthlyReportJob {
  id: string;
  userId: string;
  month: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  summary?: MonthlySummary;
  categorySpends?: CategorySpend[];
  topMerchants?: TopMerchant[];
  narrative?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: string;
}
