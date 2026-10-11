import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, Download, UploadCloud, ChevronDown, X } from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { Transaction, Category } from '../types.js';
import { ModalContainer } from '../components/ModalContainer.js';
import { ImportStatementModal } from '../components/ImportStatementModal.js';

interface TransactionsPageProps {
  initialOpenImport?: boolean;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ initialOpenImport = false }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(initialOpenImport);

  // Filters & Pagination
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [saving, setSaving] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let url = `/api/transactions?month=${selectedMonth}&page=${page}&limit=15`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (selectedType) url += `&type=${selectedType}`;

      const [res, catRes] = await Promise.all([
        apiRequest<{ transactions: Transaction[]; totalPages: number }>(url),
        apiRequest<Category[]>('/api/categories'),
      ]);

      setTransactions(res.transactions);
      setTotalPages(res.totalPages || 1);
      setCategories(catRes);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedMonth, selectedCategory, selectedType, page]);

  const handleOpenAdd = () => {
    setEditingTxn(null);
    setType('EXPENSE');
    setAmount('');
    setMerchant('');
    setNote('');
    setCategoryId('');
    setDate(new Date().toISOString().substring(0, 10));
    setShowModal(true);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTxn(tx);
    setType(tx.type);
    setAmount(tx.amount.toString());
    setMerchant(tx.merchant || '');
    setNote(tx.note || '');
    setCategoryId(tx.categoryId || '');
    setDate(tx.date);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTxn) {
        await apiRequest(`/api/transactions/${editingTxn.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            type,
            amount: Number(amount),
            merchant,
            note,
            categoryId: categoryId || undefined,
            date,
          }),
        });
      } else {
        await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type,
            amount: Number(amount),
            merchant,
            note,
            categoryId: categoryId || undefined,
            date,
          }),
        });
      }
      setShowModal(false);
      fetchTransactions();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchTransactions();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return alert('No transactions to export.');
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Merchant', 'Note', 'Source'];
    const rows = transactions.map((t) => [
      t.date,
      t.type,
      t.amount,
      t.categoryName || 'General',
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.source,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expense_Buddy_Ledger_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = transactions.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.merchant && t.merchant.toLowerCase().includes(q)) ||
      (t.note && t.note.toLowerCase().includes(q)) ||
      (t.categoryName && t.categoryName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5 sm:mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
            Transaction Ledger
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-light mt-0.5 tracking-tight">
            Audit history of income, expenses, and automated imports.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary"
          >
            <UploadCloud className="w-3.5 h-3.5 text-green-700" />
            <span>Import Statement</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-secondary"
          >
            <Download className="w-3.5 h-3.5 text-green-700" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Record</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card-base p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, memo..."
            className="input-base has-left-icon !pl-11 w-full font-light"
          />
        </div>

        <div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setPage(1);
            }}
            className="input-base w-full cursor-pointer"
          />
        </div>

        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="input-base w-full cursor-pointer appearance-none pr-10 pl-3.5 font-light"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="input-base w-full cursor-pointer appearance-none pr-10 pl-3.5 font-light"
          >
            <option value="">All Types (Income & Expense)</option>
            <option value="EXPENSE">Expenses Only</option>
            <option value="INCOME">Income Only</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Ledger Table: Well structured with crisp column & row separating lines */}
      <div className="card-base overflow-hidden rounded-[24px] border border-[#edf2ee] bg-white shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#fafcfa] text-[11px] font-semibold text-gray-600 uppercase tracking-wider border-b border-[#edf2ee]">
                <th className="py-3 px-4 border-r border-[#edf2ee]">Date</th>
                <th className="py-3 px-4 border-r border-[#edf2ee]">Merchant & Memo</th>
                <th className="py-3 px-4 border-r border-[#edf2ee]">Category</th>
                <th className="py-3 px-4 border-r border-[#edf2ee]">Origin</th>
                <th className="py-3 px-4 text-right border-r border-[#edf2ee]">Amount</th>
                <th className="py-3 px-4 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 font-medium">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/70 transition-colors border-b border-[#edf2ee] last:border-b-0">
                    <td className="py-3 px-4 font-mono-num text-gray-600 whitespace-nowrap border-r border-[#edf2ee]">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 border-r border-[#edf2ee]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] text-[11px] font-semibold select-none">
                          {(tx.merchant || tx.note || 'E').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 leading-tight truncate">
                            {tx.merchant || 'General'}
                          </p>
                          {tx.note && (
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{tx.note}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-[#edf2ee]">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium border border-gray-200/60">
                        {tx.categoryName || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-r border-[#edf2ee]">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          tx.source === 'IMPORT'
                            ? 'bg-[rgba(22,101,52,0.08)] text-[#166534] border-[rgba(22,101,52,0.14)]'
                            : 'bg-gray-100 text-gray-600 border-gray-200/60'
                        }`}
                      >
                        {tx.source}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-semibold text-xs border-r border-[#edf2ee] ${
                        tx.type === 'INCOME' ? 'text-green-700' : 'text-gray-900'
                      }`}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}₹ {tx.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center items-center gap-2.5 sm:gap-3">
                        <button
                          onClick={() => handleOpenEdit(tx)}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          title="Delete"
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" style={{ color: '#dc2626' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#edf2ee] bg-[#fafcfa]/60 text-xs text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200/90 hover:border-gray-300 hover:bg-gray-50/70 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200/90 hover:border-gray-300 hover:bg-gray-50/70 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      <ModalContainer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTxn ? 'Edit Transaction' : 'New Transaction'}
        subtitle="Manage and update transaction details in your ledger"
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
        <form onSubmit={handleSave} className="space-y-4">
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
                  <option value="">Uncategorized</option>
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
                placeholder="e.g. Swiggy, Amazon, Uber"
                className="input-base w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 block px-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-base w-full font-mono-num cursor-pointer"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-semibold text-gray-600 block px-1">
                Notes
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional memo"
                className="input-base w-full"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-[#edf2ee]">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-secondary flex-1 rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 rounded-full cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Pop-up modal for Statement Import */}
      <ImportStatementModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchTransactions}
      />
    </div>
  );
};
