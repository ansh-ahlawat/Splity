import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Save, X, Wallet, Pencil, Check } from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { Category, CategoryBudget } from '../types.js';
import { BudgetProgressBar } from '../components/BudgetProgressBar.js';
import { useDate } from '../context/DateContext.js';

export const CategoryDetailPage: React.FC = () => {
  const { selectedMonth } = useDate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [uncategorizedAmount, setUncategorizedAmount] = useState(0);
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState<number>(0);
  const [editingMonthlyCeiling, setEditingMonthlyCeiling] = useState(false);
  const [ceilingInput, setCeilingInput] = useState('');
  const [savingCeiling, setSavingCeiling] = useState(false);

  // New Category state
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10b981');
  const [addingCat, setAddingCat] = useState(false);

  // Edit budget state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState('');

  const fetchData = async () => {
    try {
      const [catRes, budgetRes, txnRes, monthlyRes] = await Promise.all([
        apiRequest<Category[]>('/api/categories'),
        apiRequest<CategoryBudget[]>(`/api/budgets/category?month=${selectedMonth}`),
        apiRequest<any[]>(`/api/transactions?month=${selectedMonth}`),
        apiRequest<{ limitAmount: number }>(`/api/budgets/monthly?month=${selectedMonth}`),
      ]);
      setCategories(catRes);
      setBudgets(budgetRes);
      setMonthlyBudgetLimit(monthlyRes?.limitAmount || Number(localStorage.getItem('profile_ceiling')) || 0);

      // Calculate uncategorized amount
      const uncategorized = txnRes?.filter((t) => !t.categoryId).reduce((sum, t) => sum + t.amount, 0) || 0;
      setUncategorizedAmount(uncategorized);
    } catch (err) {
      console.error('Failed to load category budgets:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName, icon: 'Tag', color: newCatColor }),
      });
      setNewCatName('');
      setAddingCat(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create category');
    }
  };

  const handleSaveBudget = async (categoryId: string) => {
    if (!limitAmount || Number(limitAmount) < 0) return;
    try {
      await apiRequest('/api/budgets/category', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          month: selectedMonth,
          limitAmount: Math.round(Number(limitAmount)),
        }),
      });
      setEditingCatId(null);
      setLimitAmount('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save category budget');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure? Existing transactions will become uncategorized.')) return;
    try {
      await apiRequest(`/api/categories/${categoryId}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleSaveMonthlyCeiling = async () => {
    const val = Math.round(Number(ceilingInput));
    if (isNaN(val) || val <= 0) return;
    setSavingCeiling(true);
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
      setMonthlyBudgetLimit(val);
      setEditingMonthlyCeiling(false);
      window.dispatchEvent(new CustomEvent('splity:refresh'));
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update monthly ceiling');
    } finally {
      setSavingCeiling(false);
    }
  };

  const totalCategoryAllocated = budgets.reduce((acc, b) => acc + (b.limitAmount || 0), 0);
  const totalSpentAll = budgets.reduce((acc, b) => acc + (b.spentAmount || 0), 0) + uncategorizedAmount;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5 sm:mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
            Budgets & Spending Targets
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-light mt-0.5 tracking-tight">
            Configure monthly category limits, budget ceiling, and automated alerts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddingCat(true)}
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Monthly Budget Ceiling Hero Card */}
      <div className="bg-gradient-to-br from-green-800 via-green-900 to-green-950 text-white rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-green-200" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-green-200/90">
                Monthly Spending Ceiling ({selectedMonth})
              </span>
            </div>

            {editingMonthlyCeiling ? (
              <div className="flex items-center gap-2 pt-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono-num font-bold pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={ceilingInput}
                    onChange={(e) => setCeilingInput(e.target.value)}
                    placeholder="e.g. 50000"
                    min="1"
                    step="1"
                    autoFocus
                    className="w-44 h-10 pl-7 pr-3 rounded-2xl bg-white text-gray-900 font-mono-num font-bold text-sm outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveMonthlyCeiling}
                  disabled={savingCeiling || !ceilingInput || Number(ceilingInput) <= 0}
                  className="h-10 px-4 rounded-2xl bg-white text-green-900 font-medium text-xs flex items-center gap-1.5 hover:bg-green-50 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingCeiling ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMonthlyCeiling(false)}
                  className="h-10 px-3 rounded-2xl bg-white/10 text-white/80 hover:bg-white/20 text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-3 pt-1">
                <div className="text-3xl font-mono-num font-bold text-white tracking-tight">
                  ₹{monthlyBudgetLimit.toLocaleString('en-IN')}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCeilingInput(String(monthlyBudgetLimit || ''));
                    setEditingMonthlyCeiling(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs text-white transition-all cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Change Ceiling</span>
                </button>
              </div>
            )}
            <p className="text-xs text-white/60 font-light pt-0.5">
              Enter any integer value for your monthly ceiling (e.g. 50000, 75000, 100000).
            </p>
          </div>

          {/* Quick presets & summary */}
          <div className="sm:text-right space-y-1.5">
            <div className="text-xs text-white/70">
              Allocated to Categories: <span className="font-mono-num font-semibold text-white">₹{totalCategoryAllocated.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-xs text-white/70">
              Spent This Month: <span className="font-mono-num font-semibold text-white">₹{totalSpentAll.toLocaleString('en-IN')}</span>
            </div>
            {editingMonthlyCeiling && (
              <div className="flex flex-wrap gap-1 pt-1 justify-start sm:justify-end">
                {[30000, 40000, 50000, 60000, 75000, 100000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCeilingInput(String(preset))}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono-num transition-all cursor-pointer ${
                      ceilingInput === String(preset)
                        ? 'bg-white text-green-900 font-semibold'
                        : 'bg-white/10 hover:bg-white/20 text-white/80'
                    }`}
                  >
                    ₹{preset / 1000}k
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Category Form Card */}
      {addingCat && (
        <div className="card-base p-4 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-900">
              Create New Category
            </h2>
            <button
              onClick={() => setAddingCat(false)}
              className="text-gray-400 hover:text-gray-700 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row items-center gap-2.5">
            <input
              type="text"
              required
              placeholder="Category name (e.g. Healthcare, Fitness)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="input-base flex-1 w-full"
            />

            <div className="flex items-center gap-1.5 self-start sm:self-center">
              <span className="text-xs text-gray-500">Color:</span>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setAddingCat(false)}
                className="btn-secondary flex-1 sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 sm:flex-none"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Uncategorized Card - styled exactly like other categories */}
        <div className="card-base p-3 sm:p-3.5 pt-3 sm:pt-3.5 flex flex-col justify-between space-y-2.5">
          <div className="p-3 pt-2.5 sm:p-3.5 sm:pt-2.5 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-none bg-gray-400" />
                <span className="text-xs font-semibold text-gray-900 tracking-tight">
                  Uncategorized
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">
                General
              </span>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-light">Spent this month</span>
                <span className="font-mono-num font-semibold text-gray-900">
                  ₹ {uncategorizedAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="w-full bg-gray-100/90 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gray-400 rounded-full transition-all duration-300"
                  style={{ width: uncategorizedAmount > 0 ? '100%' : '0%' }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-gray-400 pt-0.5">
                <span>Unknown payees</span>
                <span className="font-mono-num">Needs review</span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-gray-100 flex items-center justify-center">
            <div className="w-full h-8.5 text-xs text-gray-400 font-light flex items-center justify-center bg-gray-50/60 rounded-full border border-gray-100">
              Assign categories in Ledger
            </div>
          </div>
        </div>

        {categories.map((cat) => {
          const budget = budgets.find((b) => b.categoryId === cat.id);
          const isEditing = editingCatId === cat.id;

          return (
            <div
              key={cat.id}
              className="card-base p-3 sm:p-3.5 pt-3 sm:pt-3.5 flex flex-col justify-between space-y-2.5"
            >
              <BudgetProgressBar
                categoryName={cat.name}
                spent={budget?.spentAmount || 0}
                limit={budget?.limitAmount || 0}
                color={cat.color}
                onDelete={() => handleDeleteCategory(cat.id)}
                className="card-base p-3 pt-2.5 sm:p-3.5 sm:pt-2.5 flex flex-col justify-between"
              />

              {/* Set / Edit Budget Action - Middle aligned at same level with spacing */}
              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-center">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 w-full h-8.5">
                    <div className="relative flex-1 flex items-center h-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-num text-gray-400 select-none pointer-events-none font-medium">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="1"
                        placeholder="Limit"
                        value={limitAmount}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                        onChange={(e) => setLimitAmount(e.target.value)}
                        className="input-base has-left-icon !pl-8.5 w-full h-8.5 text-xs font-mono-num font-light"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveBudget(cat.id)}
                      className="btn-primary h-8.5 px-3 text-xs flex items-center gap-1.5 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="w-8.5 h-8.5 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-full hover:bg-black/5 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setLimitAmount(budget ? budget.limitAmount.toString() : '');
                    }}
                    className="btn-secondary w-full h-8.5 text-xs flex items-center justify-center"
                  >
                    {budget && budget.limitAmount > 0 ? 'Adjust Monthly Max' : 'Set Monthly Max'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
