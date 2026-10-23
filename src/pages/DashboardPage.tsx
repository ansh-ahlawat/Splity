import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownLeft, Wallet, PiggyBank, ChevronDown, Pencil } from 'lucide-react';
import {
  FaArrowTrendUp as TrendingUp,
  FaPlus as Plus,
  FaCalendar as Calendar,
  FaUpload as Upload,
  FaUsers as Users,
  FaCircleCheck as CheckCircle2,
  FaChevronRight as ChevronRight,
  FaArrowRight as ArrowRight,
  FaWandMagicSparkles as Sparkles,
  FaXmark as X
} from '../components/FaIcons.js';
import { apiRequest } from '../api/httpClient.js';
import { useAuth } from '../context/AuthContext.js';
import { useDate } from '../context/DateContext.js';
import { ImportStatementModal } from '../components/ImportStatementModal.js';
import {
  MonthlySummary,
  CategorySpend,
  Transaction,
  Category
} from '../types.js';
import { BudgetProgressBar } from '../components/BudgetProgressBar.js';
import { ModalContainer } from '../components/ModalContainer.js';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

interface DebtSummary {
  youOweTotal: number;
  owedToYouTotal: number;
  netBalance: number;
  debts: Array<{
    id: string;
    friendName: string;
    amount: number;
    type: 'YOU_OWE' | 'OWED_TO_YOU';
    description: string;
    date: string;
  }>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { selectedMonth } = useDate();

  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [categorySpends, setCategorySpends] = useState<CategorySpend[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Add Transaction Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const [profileBudget, setProfileBudget] = useState<number>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('profile_ceiling') : null;
    if (v) return Number(v);
    return user?.spendingCeiling || 0;
  });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [profileSavings, setProfileSavings] = useState<number>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('profile_savings') : null;
    if (v) return Number(v);
    return user?.targetSavings || 0;
  });
  const [profileFullName, setProfileFullName] = useState<string>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('profile_fullname') : null;
    return v?.trim() || user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  });

  useEffect(() => {
    if (user) {
      if (user.spendingCeiling) setProfileBudget(user.spendingCeiling);
      if (user.targetSavings) setProfileSavings(user.targetSavings);
      if (user.name) setProfileFullName(user.name);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [sumRes, catRes, txRes, allCatRes, debtRes] = await Promise.all([
        apiRequest<MonthlySummary>(`/api/transactions/summary?month=${selectedMonth}`),
        apiRequest<CategorySpend[]>(`/api/transactions/by-category?month=${selectedMonth}`),
        apiRequest<{ transactions: Transaction[] }>(`/api/transactions?month=${selectedMonth}&limit=6`),
        apiRequest<Category[]>('/api/categories'),
        apiRequest<DebtSummary>('/api/debts/summary'),
      ]);

      setSummary(sumRes);
      setCategorySpends(catRes);
      setRecentTxns(txRes.transactions);
      setCategories(allCatRes);
      setDebtSummary(debtRes);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const handleRefresh = () => {
      const vCeiling = localStorage.getItem('profile_ceiling');
      const vSavings = localStorage.getItem('profile_savings');
      const vName = localStorage.getItem('profile_fullname');
      if (vCeiling) setProfileBudget(Number(vCeiling));
      if (vSavings) setProfileSavings(Number(vSavings));
      if (vName) setProfileFullName(vName.trim());
      fetchDashboardData();
    };
    window.addEventListener('splity:refresh', handleRefresh);
    return () => window.removeEventListener('splity:refresh', handleRefresh);
  }, [selectedMonth]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          type,
          amount: Number(amount),
          merchant,
          note,
          categoryId: categoryId || undefined,
          date: txnDate,
        }),
      });
      setShowAddModal(false);
      setAmount('');
      setMerchant('');
      setNote('');
      fetchDashboardData();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err: any) {
      alert(err.message || 'Failed to record transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBudgetCeiling = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.round(Number(budgetInput));
    if (isNaN(val) || val <= 0) return;
    setSavingBudget(true);
    try {
      await Promise.all([
        apiRequest('/api/budgets/monthly', {
          method: 'POST',
          body: JSON.stringify({ month: selectedMonth, limitAmount: val }),
        }),
        apiRequest('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({ spendingCeiling: val, month: selectedMonth }),
        }),
      ]);
      localStorage.setItem('profile_ceiling', String(val));
      setProfileBudget(val);
      setShowBudgetModal(false);
      fetchDashboardData();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err: any) {
      alert(err.message || 'Failed to update monthly budget ceiling');
    } finally {
      setSavingBudget(false);
    }
  };

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === currentMonthStr;

  const categoryBudgetsTotal = categorySpends.reduce((acc, c) => acc + (c.limitAmount || 0), 0);
  const totalCategoryLimit = (summary?.monthlyBudget && summary.monthlyBudget > 0)
    ? summary.monthlyBudget
    : (profileBudget > 0
        ? profileBudget
        : (categoryBudgetsTotal > 0 ? categoryBudgetsTotal : 0));

  const totalExpense = summary?.totalExpense ?? 0;
  // Default income zero for all new accounts without income transactions
  const totalIncome = summary?.totalIncome ?? 0;
  const selfSavings = totalIncome - totalExpense;
  const targetSavings = profileSavings;
  const overallUsedPercent = totalCategoryLimit > 0
    ? Math.min(100, Math.round((totalExpense / totalCategoryLimit) * 100))
    : 0;

  const oweDebts = (debtSummary?.debts || []).filter((d) => d.type === 'YOU_OWE');
  const owePeersCount = new Set(oweDebts.map((d) => d.friendName)).size || oweDebts.length || 0;

  const owedDebts = (debtSummary?.debts || []).filter((d) => d.type === 'OWED_TO_YOU');
  const owedPeersCount = new Set(owedDebts.map((d) => d.friendName)).size || owedDebts.length || 0;

  return (
    <div className="space-y-3 sm:space-y-3.5 pb-8 pt-1.5 sm:pt-3">
      {/* Top Header Bar / Hero Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5 sm:mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
            Hi {profileFullName},
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-light mt-0.5 tracking-tight">
            Ready to smartly manage your budget and track your expenses.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary"
          >
            <Upload className="w-3.5 h-3.5 text-green-700" />
            <span>Import Statement</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deposit / Record</span>
          </button>
        </div>
      </div>

      {/* Row of 4 Core KPI Cards (Identical button sizing & thin icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Card 1: Monthly Budget (Forest Green Hero Card with Thin Wallet icon) */}
        <div className="bg-gradient-to-br from-green-800 via-green-900 to-green-950 text-white rounded-3xl p-3.5 flex flex-col justify-between space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-start -mr-1 -mt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-green-200/80 pt-1.5 pl-0.5">
              Total Budget
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBudgetInput(String(totalCategoryLimit || profileBudget || ''));
                  setShowBudgetModal(true);
                }}
                title="Edit Budget Ceiling"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('categories')}
                title="View Budgets"
                className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-[#edf4ed] text-green-800 hover:bg-[#e2ede2] transition-all cursor-pointer shrink-0"
              >
                <Wallet className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <div
            onClick={() => {
              setBudgetInput(String(totalCategoryLimit || profileBudget || ''));
              setShowBudgetModal(true);
            }}
            className="cursor-pointer group/amt"
            title="Click to change monthly budget ceiling"
          >
            <div className="text-2xl font-mono-num font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>₹{totalCategoryLimit.toLocaleString('en-IN')}</span>
              <span className="text-[10px] font-normal text-white/50 opacity-0 group-hover/amt:opacity-100 transition-opacity bg-white/10 px-1.5 py-0.5 rounded-md">
                Edit
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5 truncate">
              Spent: ₹{totalExpense.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  overallUsedPercent > 90 ? 'bg-red-400' : 'bg-white'
                }`}
                style={{ width: `${overallUsedPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium text-white/50">
              <span>{overallUsedPercent}% utilized</span>
              <span>
                {totalCategoryLimit >= totalExpense
                  ? `₹${(totalCategoryLimit - totalExpense).toLocaleString('en-IN')} left`
                  : `₹${(totalExpense - totalCategoryLimit).toLocaleString('en-IN')} over budget`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Retained Savings (Thin PiggyBank icon) */}
        <div className="card-base p-3.5 rounded-3xl flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-start -mr-1 -mt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1.5 pl-0.5">
              Retained Savings
            </span>
            <button
              onClick={() => onNavigate('reports')}
              title="View Analytics"
              className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-[#edf4ed] text-green-800 hover:bg-[#e2ede2] transition-all cursor-pointer shrink-0"
            >
              <PiggyBank className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
            </button>
          </div>
          <div>
            <div className={`text-2xl font-mono-num font-bold tracking-tight ${selfSavings >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              ₹{selfSavings.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Income ₹{totalIncome.toLocaleString('en-IN')} − Spent ₹{totalExpense.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-green-700 pt-0.5 truncate">
            <TrendingUp className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {targetSavings > 0
                ? `Goal: ₹${targetSavings.toLocaleString('en-IN')} (${selfSavings >= targetSavings ? 'Goal achieved!' : `₹${(targetSavings - selfSavings).toLocaleString('en-IN')} to target`})`
                : 'Net savings after all monthly expenses'}
            </span>
          </div>
        </div>

        {/* Card 3: You Owe (Payables - Red themed light background & thin arrow) */}
        <div className="card-base p-3.5 rounded-3xl flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-start -mr-1 -mt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1.5 pl-0.5">
              Payables (You Owe)
            </span>
            <button
              onClick={() => onNavigate('friends-groups')}
              title="View Payables"
              className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 transition-all cursor-pointer shrink-0"
            >
              <ArrowUpRight className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
            </button>
          </div>
          <div>
            <div className="text-2xl font-mono-num font-bold text-red-600 tracking-tight">
              ₹{(debtSummary?.youOweTotal || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {(debtSummary?.youOweTotal || 0) > 0
                ? 'Pending payback to friends'
                : 'All settled — zero dues'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('friends-groups')}
            className="btn-secondary-danger w-full text-xs h-7 rounded-full"
          >
            Review Paybacks
          </button>
        </div>

        {/* Card 4: Owed to You (Receivables - Reversed incoming thin arrow) */}
        <div className="card-base p-3.5 rounded-3xl flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-start -mr-1 -mt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1.5 pl-0.5">
              Receivables (Owed)
            </span>
            <button
              onClick={() => onNavigate('friends-groups')}
              title="View Receivables"
              className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-[#edf4ed] text-green-800 hover:bg-[#e2ede2] transition-all cursor-pointer shrink-0"
            >
              <ArrowDownLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
            </button>
          </div>
          <div>
            <div className="text-2xl font-mono-num font-bold text-gray-950 tracking-tight">
              ₹{(debtSummary?.owedToYouTotal || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {(debtSummary?.owedToYouTotal || 0) > 0
                ? 'Pending return from friends'
                : 'All settled — zero owed to you'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('friends-groups')}
            className="btn-secondary w-full text-xs h-7 rounded-full"
          >
            Settle Balances
          </button>
        </div>
      </div>

      {/* Category Budget Progress Grid (Reduced gap) */}
      <div className="card-base p-4 rounded-3xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              Category Budgets & Progress
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Monthly spending targets and utilization status
            </p>
          </div>
          <button
            onClick={() => onNavigate('categories')}
            className="text-xs font-semibold text-gray-700 hover:text-green-800 flex items-center gap-2 px-3 py-1 rounded-full hover:bg-black/5 transition-all cursor-pointer"
          >
            <span>Adjust budget</span>
            <ChevronRight className="w-2.5 h-2.5 text-green-700" />
          </button>
        </div>

        <div className="flex items-stretch gap-3 overflow-x-auto pb-2.5 pt-1 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 -mx-1 px-1 snap-x snap-mandatory">
          {categorySpends.map((cat) => (
            <div
              key={cat.categoryId}
              className="w-[85%] sm:w-[calc((100%-12px)/2)] md:w-[calc((100%-24px)/3)] min-w-[280px] md:min-w-[calc((100%-24px)/3)] md:max-w-[calc((100%-24px)/3)] flex-shrink-0 snap-start"
            >
              <BudgetProgressBar
                categoryName={cat.categoryName}
                spent={cat.total || 0}
                limit={cat.limitAmount || 10000}
                color={cat.color || '#10b981'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & Shared Splits (Reduced gap) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5">
        {/* Recent Ledger Activity */}
        <div className="card-base p-4 rounded-3xl space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Recent Ledger Activity</h2>
              <p className="text-[11px] text-gray-400">Latest recorded transactions</p>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-gray-700 hover:text-green-800 flex items-center gap-2 px-3 py-1 rounded-full hover:bg-black/5 transition-all cursor-pointer"
            >
              <span>View ledger</span>
              <ArrowRight className="w-2.5 h-2.5 text-green-700" />
            </button>
          </div>

          <div className="divide-y divide-black/[0.05]">
            {recentTxns.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No transactions recorded for this period.</p>
            ) : (
              recentTxns.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 px-1 hover:bg-black/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-black/[0.04] text-gray-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {(tx.merchant || tx.note || 'E').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 leading-tight">
                        {tx.merchant || tx.note || 'Expense'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {tx.categoryName || 'General'} • {tx.date}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono-num font-bold ${
                      tx.type === 'INCOME' ? 'text-green-700' : 'text-gray-900'
                    }`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Friends Shared Split Balances */}
        <div className="card-base p-4 rounded-3xl space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                Shared Split Balances
              </h2>
              <p className="text-[11px] text-gray-400">Net balances with friends & groups</p>
            </div>
            <button
              onClick={() => onNavigate('friends-groups')}
              className="text-xs font-semibold text-gray-700 hover:text-green-800 flex items-center gap-2 px-3 py-1 rounded-full hover:bg-black/5 transition-all cursor-pointer"
            >
              <span>Manage</span>
              <ArrowRight className="w-2.5 h-2.5 text-green-700" />
            </button>
          </div>

          <div className="divide-y divide-black/[0.05]">
            {!debtSummary?.debts || debtSummary.debts.length === 0 ? (
              <div className="py-6 text-center space-y-0.5">
                <p className="text-xs font-semibold text-gray-800">All settled — zero dues</p>
                <p className="text-[11px] text-gray-400">
                  {debtSummary?.settledCount && debtSummary.settledCount > 0
                    ? `Zero pending dues. ${debtSummary.settledCount} shared balance${debtSummary.settledCount === 1 ? '' : 's'} settled.`
                    : 'No active shared balances.'}
                </p>
              </div>
            ) : (
              debtSummary.debts.slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  className="py-2.5 px-1 flex items-center justify-between hover:bg-black/[0.015] transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{d.friendName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{d.description}</p>
                  </div>
                  <span
                    className={`text-xs font-mono-num font-bold ${
                      d.type === 'YOU_OWE' ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {d.type === 'YOU_OWE' ? 'You owe ' : 'Owed '}₹{d.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Record Transaction Modal */}
      <ModalContainer
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Transaction"
        subtitle="Log a new personal expense or incoming receipt"
        headerRight={
          /* Minimalist thin line toggle with fancy themed dot */
          <div className="relative flex items-center gap-3 select-none mr-1 -ml-24 p-2 cursor-pointer" onClick={() => setType(type === 'EXPENSE' ? 'INCOME' : 'EXPENSE')}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setType('EXPENSE'); }}
              className={`text-[11px] sm:text-xs font-medium transition-colors cursor-pointer ${
                type === 'EXPENSE' ? 'text-[#166534]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Expense
            </button>

            {/* Thin line with green circle indicator */}
            <div className="relative w-8 h-0.5 bg-gray-200/80 flex items-center">
              <motion.div
                className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#166534] shadow-sm"
                animate={{
                  x: type === 'EXPENSE' ? 0 : 18
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30
                }}
              />
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setType('INCOME'); }}
              className={`text-[11px] sm:text-xs font-medium transition-colors cursor-pointer ${
                type === 'INCOME' ? 'text-[#166534]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Income
            </button>
          </div>
        }
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 block px-1">
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input-base w-full font-mono-num font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 block px-1">
                Category
              </label>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="input-base w-full cursor-pointer appearance-none pr-10"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 block px-1">
                Merchant / Payee
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Swiggy, Apple, Uber"
                className="input-base w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 block px-1">
                Date
              </label>
              <input
                type="date"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                className="input-base w-full font-mono-num cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-[#edf2ee] justify-end">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="btn-secondary px-6 py-2 rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-6 py-2 rounded-full cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Import Statement Modal */}
      <ImportStatementModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          window.dispatchEvent(new CustomEvent('splity:refresh'));
        }}
      />

      {/* Edit Budget Ceiling Modal */}
      <ModalContainer
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        title="Monthly Budget Ceiling"
        subtitle={`Set your total spending limit for ${selectedMonth}`}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveBudgetCeiling} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">
              Budget Ceiling Limit (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="e.g. 50000"
                min="1"
                step="1"
                required
                autoFocus
                className="input-base has-left-icon !pl-8.5 w-full text-base font-mono-num font-bold text-gray-900"
              />
            </div>
            <p className="text-[11px] text-gray-400 font-light">
              Enter any integer value (e.g. 30000, 50000, 75000, 100000).
            </p>
          </div>

          {/* Quick presets */}
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Quick Suggestions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[30000, 40000, 50000, 60000, 75000, 100000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudgetInput(String(preset))}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono-num font-medium transition-all cursor-pointer border ${
                    budgetInput === String(preset)
                      ? 'bg-[#166534] text-white border-[#166534]'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  ₹{preset.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBudgetModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBudget || !budgetInput || Number(budgetInput) <= 0}
              className="btn-primary"
            >
              {savingBudget ? 'Saving...' : 'Update Budget Limit'}
            </button>
          </div>
        </form>
      </ModalContainer>
    </div>
  );
};
