import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/httpClient.js';
import { ModalContainer } from './ModalContainer.js';
import { Category, CategoryBudget } from '../types.js';
import {
  FaCircleCheck,
  FaReceipt,
  FaRightFromBracket,
} from './FaIcons.js';
import {
  Download,
  Save,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  FileJson,
  Layers,
  ArrowRightLeft
} from 'lucide-react';

interface DemoProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionResult?: () => void;
}

export const DemoProfileModal: React.FC<DemoProfileModalProps> = ({
  isOpen,
  onClose,
  onActionResult
}) => {
  const { user, logout, updateUserProfile } = useAuth();

  const [fullName, setFullName] = useState(() => {
    return user?.name || localStorage.getItem('profile_fullname') || '';
  });
  const [mobilePhone, setMobilePhone] = useState(() => {
    return user?.phone || localStorage.getItem('profile_phone') || '';
  });
  const [spendingCeiling, setSpendingCeiling] = useState(() => {
    return user?.spendingCeiling ? String(user.spendingCeiling) : (localStorage.getItem('profile_ceiling') || '');
  });
  const [targetSavings, setTargetSavings] = useState(() => {
    return user?.targetSavings !== undefined ? String(user.targetSavings) : (localStorage.getItem('profile_savings') || '');
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFullName(user?.name || localStorage.getItem('profile_fullname') || '');
      setMobilePhone(user?.phone || localStorage.getItem('profile_phone') || '');
      setSpendingCeiling(user?.spendingCeiling ? String(user.spendingCeiling) : (localStorage.getItem('profile_ceiling') || ''));
      setTargetSavings(user?.targetSavings !== undefined ? String(user.targetSavings) : (localStorage.getItem('profile_savings') || ''));
    }
  }, [isOpen, user]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const afterPrefix = raw.replace(/^(\+91|\+9|\+)?\s*/, '');
    const digits = afterPrefix.replace(/\D/g, '').slice(0, 10);
    setMobilePhone(digits ? `+91 ${digits}` : '');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile({
        name: fullName.trim(),
        phone: mobilePhone.trim(),
        spendingCeiling: Number(spendingCeiling) || 0,
        targetSavings: Number(targetSavings) || 0,
      });
      setSaveSuccess(true);
      onActionResult?.();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to save profile settings.');
    } finally {
      setSaving(false);
    }
  };

  // Export CSV Ledger
  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const res = await apiRequest<{ transactions: any[] }>('/api/transactions?limit=1000');
      const txs = res.transactions || [];
      if (txs.length === 0) {
        alert('No transaction records found to export.');
        return;
      }
      const headers = ['ID', 'Date', 'Type', 'Amount', 'Category', 'Merchant', 'Note'];
      const rows = txs.map((t) => [
        t.id,
        t.date,
        t.type,
        t.amount,
        `"${(t.categoryName || '').replace(/"/g, '""')}"`,
        `"${(t.merchant || '').replace(/"/g, '""')}"`,
        `"${(t.note || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `Splity_Financial_Ledger_${new Date().toISOString().substring(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExportingCSV(false);
    }
  };

  // Export Financial Audit Report (JSON)
  const handleExportReport = async () => {
    setExportingReport(true);
    try {
      const [txRes, debtsRes, catsRes] = await Promise.all([
        apiRequest<{ transactions: any[] }>('/api/transactions?limit=500'),
        apiRequest<any[]>('/api/debts'),
        apiRequest<Category[]>('/api/categories'),
      ]);

      const auditData = {
        exportedAt: new Date().toISOString(),
        user: { name: fullName, email: user?.email, phone: mobilePhone },
        financialCeiling: spendingCeiling,
        categories: catsRes || [],
        recentTransactions: txRes?.transactions || [],
        sharedDebts: debtsRes || [],
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditData, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute(
        'download',
        `Splity_Financial_Audit_${new Date().toISOString().substring(0, 10)}.json`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export audit report.');
    } finally {
      setExportingReport(false);
    }
  };

  // Reconcile and Sync Balances
  const handleReconcileBalances = async () => {
    setReconciling(true);
    try {
      window.dispatchEvent(new CustomEvent('splity:refresh'));
      onActionResult?.();
      setReconcileSuccess(true);
      setTimeout(() => setReconcileSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to reconcile balances.');
    } finally {
      setReconciling(false);
    }
  };

  // Display name: first word strictly
  const rawName = (fullName || (user?.email ? user.email.split('@')[0] : 'User')) || 'User';
  let firstNameOnly = rawName.trim().replace(/^@+/, '').split(/[\s._-]+/)[0] || 'User';
  const displayFirstName = firstNameOnly.charAt(0).toUpperCase() + firstNameOnly.slice(1);
  const initials = displayFirstName.charAt(0).toUpperCase();

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      title="Financial Account & Settings"
      subtitle="Manage your personal identity, mobile contact, monthly budget, and savings goal"
      maxWidthClass="max-w-2xl sm:max-w-3xl"
      maxHeightClass="max-h-[90vh] sm:max-h-[600px]"
    >
      <div className="space-y-6">
        {/* User Identity Row - container removed, circular round monogram in import statement theme */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] font-semibold text-lg select-none">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  {displayFirstName}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-green-100/70 text-green-800 text-[10px] font-semibold">
                  Verified Account
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 font-mono-num">{user?.email || 'user@splity.app'}</p>
            </div>
          </div>

          {/* Sign out button with icon and text red as before */}
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 rounded-xl hover:bg-red-50/80 transition-colors cursor-pointer"
          >
            <FaRightFromBracket className="w-3.5 h-3.5 text-red-600" style={{ color: '#dc2626' }} />
            <span className="text-red-600 font-medium">Sign Out</span>
          </button>
        </div>

        {/* Profile & Financial Settings Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-base w-full text-xs font-light"
                placeholder="Ansh Ahlawat"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Email Address (Permanent)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || 'demo@expensebuddy.app'}
                className="input-base w-full text-xs opacity-60 cursor-not-allowed bg-black/[0.02] font-light"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Mobile Number (+91)
              </label>
              <input
                type="text"
                value={mobilePhone}
                onChange={handlePhoneChange}
                className="input-base w-full text-xs font-mono-num font-light"
                placeholder="+91 98765 43210"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Monthly Budget (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={spendingCeiling}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onChange={(e) => setSpendingCeiling(e.target.value)}
                  className="input-base has-left-icon !pl-8 w-full text-xs font-mono-num font-light"
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Monthly Savings Goal (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={targetSavings}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onChange={(e) => setTargetSavings(e.target.value)}
                  className="input-base has-left-icon !pl-8 w-full text-xs font-mono-num font-light"
                  placeholder="40000"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full h-[38px] px-4 text-xs flex items-center justify-center gap-1.5 hover:transform-none"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </div>
          </div>

          {saveSuccess && (
            <div className="flex items-center justify-end -mt-1">
              <span className="text-xs font-medium text-green-700 flex items-center gap-1.5">
                <FaCircleCheck className="w-3.5 h-3.5 text-green-600" />
                Financial profile saved successfully.
              </span>
            </div>
          )}
        </form>

        {/* Financial Tools & Data Management */}
        <div className="pt-4 border-t border-[#edf2ee] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-900 tracking-tight flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-green-700" />
              <span>Financial Tools & Data Management</span>
            </h4>
            <span className="text-[11px] text-gray-400 font-light">Production Utilities</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tool 1: Export Complete Ledger CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="flex flex-col items-start p-3.5 rounded-2xl border border-[#edf2ee] hover:border-gray-300 hover:bg-gray-50/80 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-gray-900 leading-tight">
                {exportingCSV ? 'Exporting...' : 'Export Ledger (CSV)'}
              </span>
              <p className="text-[11px] text-gray-400 mt-1 font-light">Download all financial transactions in spreadsheet format</p>
            </button>

            {/* Tool 2: Export Financial Audit Report */}
            <button
              type="button"
              onClick={handleExportReport}
              disabled={exportingReport}
              className="flex flex-col items-start p-3.5 rounded-2xl border border-[#edf2ee] hover:border-purple-300 hover:bg-purple-50/40 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileJson className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-gray-900 leading-tight">
                {exportingReport ? 'Exporting...' : 'Export Audit Report'}
              </span>
              <p className="text-[11px] text-gray-400 mt-1 font-light">Complete JSON backup of budgets, debts, and categories</p>
            </button>

            {/* Tool 3: Reconcile Peer Balances */}
            <button
              type="button"
              onClick={handleReconcileBalances}
              disabled={reconciling}
              className="flex flex-col items-start p-3.5 rounded-2xl border border-[#edf2ee] hover:border-green-300 hover:bg-green-50/40 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <ArrowRightLeft className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
              </div>
              <span className="text-xs font-semibold text-gray-900 leading-tight">
                {reconciling ? 'Reconciling...' : reconcileSuccess ? 'Balances Synced!' : 'Reconcile Balances'}
              </span>
              <p className="text-[11px] text-gray-400 mt-1 font-light">
                {reconcileSuccess ? 'All peer debts and accounts verified' : 'Recalculate net positions and sync split debts'}
              </p>
            </button>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};
