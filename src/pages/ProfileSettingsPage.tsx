import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/httpClient.js';
import {
  FaRightFromBracket,
  FaCircleCheck,
  FaCloudArrowUp
} from '../components/FaIcons.js';
import { Download, Trash2, Save, ShieldCheck } from 'lucide-react';

export const ProfileSettingsPage: React.FC = () => {
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
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);

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
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await apiRequest<{ transactions: any[] }>('/api/transactions?limit=500');
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
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Expense_Buddy_Ledger_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleClearTransactions = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently clear all transactions? This action cannot be undone.'
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await apiRequest('/api/transactions/reset', { method: 'POST' });
      alert('All transactions have been erased and budgets reset.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to reset transactions.');
    } finally {
      setResetting(false);
    }
  };

  const userDisplayName = fullName || user?.email?.split('@')[0] || 'User';
  const handle = '@' + (user?.email?.split('@')[0] || 'user').toLowerCase();
  const initials = userDisplayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Account & Security Settings
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage your credentials, contact information, and financial budget thresholds
        </p>
      </div>

      {/* Card 1: Profile Information (Exact match to uploaded screenshot) */}
      <div className="card-base p-6 sm:p-8 space-y-6">
        {/* User Identity Header */}
        <div className="flex items-center justify-between pb-6 border-b border-black/[0.04]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-900 font-bold text-lg flex items-center justify-center">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                {userDisplayName}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 font-mono-num">
                {handle}
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-semibold tracking-wide">
            Verified Account
          </span>
        </div>

        {/* Profile Settings Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-base w-full"
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">
                Email Address (Permanent)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || 'user@example.com'}
                className="input-base w-full opacity-60 cursor-not-allowed bg-black/[0.02]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">
                Mobile Number (+91)
              </label>
              <input
                type="text"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                className="input-base w-full font-mono-num"
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">
                Monthly Budget (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold pointer-events-none select-none">
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
                  className="input-base has-left-icon !pl-11 w-full font-mono-num font-light"
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">
                Monthly Savings Goal (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold pointer-events-none select-none">
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
                  className="input-base has-left-icon !pl-11 w-full font-mono-num font-light"
                  placeholder="40000"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess ? (
              <span className="text-xs font-medium text-green-700 flex items-center gap-1.5">
                <FaCircleCheck className="w-3.5 h-3.5 text-green-600" />
                Profile changes saved successfully.
              </span>
            ) : <span />}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 !rounded-xl !bg-[#0e1217] hover:!bg-[#1c222b] text-white px-5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Card 2: Data Management & Ledger Controls (Exact match to screenshot) */}
      <div className="card-base p-6 sm:p-8 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">
            Data Management & Ledger Controls
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Export structured CSV data for tax auditing or clear the local ledger
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Export Subcard */}
          <div className="p-4 rounded-2xl bg-black/[0.02] flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-2.5">
              <Download className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-gray-900">
                  Export Ledger CSV
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Download a clean spreadsheet of all personal and split transactions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting}
              className="btn-secondary w-full text-xs font-semibold !rounded-xl"
            >
              <Download className="w-3 h-3 text-gray-500" />
              <span>{exporting ? 'Generating CSV...' : 'Download CSV File'}</span>
            </button>
          </div>

          {/* Reset Subcard */}
          <div className="p-4 rounded-2xl bg-red-50/50 flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-red-600">
                  Reset Ledger Data
                </h3>
                <p className="text-[11px] text-red-400 mt-0.5">
                  Permanently erase all transaction records and reset budgets.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearTransactions}
              disabled={resetting}
              className="w-full py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>{resetting ? 'Erasing...' : 'Clear All Transactions'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-5 border-t border-black/[0.04]">
          <span className="text-xs text-gray-400">
            Currently signed in as {user?.email}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <FaRightFromBracket className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
