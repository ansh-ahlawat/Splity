import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, Database, Eye } from 'lucide-react';

export const PrivacyPolicyPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <button
        onClick={onBack}
        className="btn-secondary text-xs inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Application</span>
      </button>

      <div className="card-base p-6 sm:p-10 space-y-6 bg-white rounded-3xl border border-[#edf2ee]">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-gray-500">Splity Financial Management System · Effective October 2026</p>
          </div>
        </div>

        <div className="prose prose-sm text-gray-600 space-y-4 text-xs sm:text-[13px] leading-relaxed font-light">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-700" />
              1. Information We Collect
            </h2>
            <p>
              Splity collects account identifiers (such as email, mobile number, and display name) and user-submitted financial ledger entries (including transaction amounts, timestamps, payees/merchants, category definitions, and shared debt balances).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-700" />
              2. Cloud Storage and AWS Infrastructure
            </h2>
            <p>
              Your data is stored securely using AWS DynamoDB with per-user partition isolation and verified Amazon Simple Storage Service (AWS S3) buckets for immutable monthly synthesis records. Sensitive secrets and credentials are cryptographically protected and never exposed to client-side scripts.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-700" />
              3. AI Copilot and Analytics Processing
            </h2>
            <p>
              When requesting natural language search or monthly executive audit reports, summarized financial statistics are processed securely through Google Gemini enterprise models with strict privacy constraints. Raw personal bank credentials are never requested or stored.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">4. User Rights and Data Portability</h2>
            <p>
              You maintain complete ownership of your financial records. You may export your transaction ledgers in CSV or JSON format at any time, or request account and record deletion directly through your profile settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
