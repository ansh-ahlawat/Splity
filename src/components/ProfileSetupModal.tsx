import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function extractNameFromEmail(email: string): string {
  if (!email) return '';
  const localPart = email.split('@')[0] || '';
  // Remove numbers from end and replace separators with space
  const cleaned = localPart.replace(/[0-9]+$/g, '').replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return localPart;
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const { user, updateUserProfile } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Compute initial prefilled name based on email or existing user name
  const getInitialName = () => {
    if (user?.name && user.name.trim().toLowerCase() !== 'user') {
      return user.name.trim();
    }
    if (user?.email) {
      return extractNameFromEmail(user.email);
    }
    return '';
  };

  const getInitialPhone = () => {
    if (user?.phone && user.phone.trim() && user.phone !== '+91 98765 43210') {
      return user.phone.trim();
    }
    return '';
  };

  const getInitialCeiling = () => {
    if (user?.spendingCeiling && user.spendingCeiling > 0) {
      return String(user.spendingCeiling);
    }
    return '';
  };

  const getInitialSavings = () => {
    if (user?.targetSavings && user.targetSavings > 0) {
      return String(user.targetSavings);
    }
    return '';
  };

  const [fullName, setFullName] = useState(getInitialName);
  const [mobilePhone, setMobilePhone] = useState(getInitialPhone);
  const [spendingLimit, setSpendingLimit] = useState(getInitialCeiling);
  const [targetSavings, setTargetSavings] = useState(getInitialSavings);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update fields if user object loads after mount
  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(getInitialName());
      if (!mobilePhone) setMobilePhone(getInitialPhone());
      if (!spendingLimit && user.spendingCeiling) setSpendingLimit(String(user.spendingCeiling));
      if (!targetSavings && user.targetSavings) setTargetSavings(String(user.targetSavings));
    }
  }, [user]);

  // Prevent Escape key from closing the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }

    // Extract digits to validate phone number
    const digitsOnly = mobilePhone.replace(/\D/g, '');
    const cleanDigits = digitsOnly.startsWith('91') && digitsOnly.length === 12
      ? digitsOnly.slice(2)
      : digitsOnly;

    if (cleanDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    const formattedPhone = `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;

    const numLimit = Math.round(Number(spendingLimit));
    if (!spendingLimit.trim() || isNaN(numLimit) || numLimit <= 0) {
      setError('Please enter a valid monthly budget limit (greater than ₹0).');
      return;
    }

    const numSavings = Math.round(Number(targetSavings));
    if (!targetSavings.trim() || isNaN(numSavings) || numSavings < 0) {
      setError('Please enter a valid monthly savings target (₹0 or greater).');
      return;
    }

    setSubmitting(true);
    try {
      await updateUserProfile({
        name: trimmedName,
        phone: formattedPhone,
        spendingCeiling: numLimit,
        targetSavings: numSavings,
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-6 overflow-hidden pointer-events-auto select-none">
          {/* Backdrop — strictly unclosable */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[8px] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Outer frosted container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 18 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative z-10 w-[94vw] max-w-2xl sm:max-w-3xl p-2 rounded-[36px] bg-white/[0.38] border-none shadow-2xl pointer-events-auto select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inner white card */}
            <div className="bg-white rounded-[28px] border border-[#edf2ee] flex flex-col overflow-hidden shadow-none">
              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#edf2ee] bg-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[#166534]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-semibold text-gray-900 tracking-tight">
                        Complete Account Setup
                      </h2>
                      <span className="text-[10px] font-semibold bg-[rgba(22,101,52,0.08)] text-[#166534] px-2.5 py-0.5 rounded-full border border-[rgba(22,101,52,0.14)]">
                        Mandatory
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-500 font-light mt-0.5">
                      Please configure your identity and budget goals to access your dashboard
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-7">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-2 text-xs text-red-700"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700 block">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        required
                        className="w-full h-10 px-3.5 rounded-2xl border border-gray-200/90 hover:border-gray-300 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10 text-xs sm:text-[12.5px] text-gray-900 placeholder:text-gray-400 placeholder:text-[11px] font-light transition-all outline-none bg-white"
                      />
                      <p className="text-[10px] text-gray-400 font-light px-0.5">
                        Prefilled from your email. You can customize it anytime.
                      </p>
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700 block">
                        Mobile Number (+91) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={mobilePhone}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const afterPrefix = raw.replace(/^(\+91|\+9|\+)?\s*/, '');
                          const digits = afterPrefix.replace(/\D/g, '').slice(0, 10);
                          setMobilePhone(digits ? `+91 ${digits}` : '');
                        }}
                        placeholder="+91 98765 43210"
                        required
                        className="w-full h-10 px-3.5 rounded-2xl border border-gray-200/90 hover:border-gray-300 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10 text-xs sm:text-[12.5px] text-gray-900 placeholder:text-gray-400 placeholder:text-[11px] font-mono-num font-light transition-all outline-none bg-white"
                      />
                      <p className="text-[10px] text-gray-400 font-light px-0.5">
                        Your 10-digit phone for peer settlements &amp; split tracking
                      </p>
                    </div>

                    {/* Monthly Budget Limit */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700 block">
                        Monthly Budget Ceiling (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={spendingLimit}
                          onChange={(e) => setSpendingLimit(e.target.value)}
                          placeholder="e.g. 50000"
                          required
                          min="1"
                          step="1"
                          className="w-full h-10 pl-8 pr-3.5 rounded-2xl border border-gray-200/90 hover:border-gray-300 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10 text-xs sm:text-[12.5px] text-gray-900 placeholder:text-gray-400 placeholder:text-[11px] font-mono-num font-light transition-all outline-none bg-white"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 font-light px-0.5">
                        Enter any monthly spending ceiling (e.g. 50000, 75000)
                      </p>
                    </div>

                    {/* Monthly Savings Target */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700 block">
                        Target Savings (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={targetSavings}
                          onChange={(e) => setTargetSavings(e.target.value)}
                          placeholder="e.g. 40000"
                          required
                          min="0"
                          step="1"
                          className="w-full h-10 pl-8 pr-3.5 rounded-2xl border border-gray-200/90 hover:border-gray-300 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10 text-xs sm:text-[12.5px] text-gray-900 placeholder:text-gray-400 placeholder:text-[11px] font-mono-num font-light transition-all outline-none bg-white"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 font-light px-0.5">
                        Monthly target money to retain and save
                      </p>
                    </div>
                  </div>

                  {/* Submit button — user cannot proceed without completing this */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-11 rounded-2xl font-medium text-xs text-white flex items-center justify-center gap-2 bg-[#166534] hover:bg-[#14532d] active:scale-[0.99] transition-all cursor-pointer shadow-sm disabled:opacity-60"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Save &amp; Enter Dashboard</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
};
