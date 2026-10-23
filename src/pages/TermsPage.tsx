import React from 'react';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const TermsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
            <FileText className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Terms of Service</h1>
            <p className="text-xs text-gray-500">Splity Finance Platform · Last updated October 2026</p>
          </div>
        </div>

        <div className="prose prose-sm text-gray-600 space-y-4 text-xs sm:text-[13px] leading-relaxed font-light">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p>
              By signing up, logging in, or otherwise utilizing the Splity service, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">2. Financial Ledger Usage</h2>
            <p>
              Splity is provided as a personal and shared ledger management tool. While high precision and automated AI summaries are generated to assist in spending insights, users remain solely responsible for validating their personal tax, commercial banking, and budgeting commitments.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">3. Account Integrity & Security</h2>
            <p>
              You agree to safeguard your login credentials and notify Splity immediately if you detect unauthorized access. The platform employs rate-limiting and encrypted token exchanges to prevent abuse.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">4. Free Tier & Fair Use</h2>
            <p>
              Splity operations are architected to operate within predictable cloud capacity. Users agree not to submit automated scrapers, denial-of-service scripts, or excessive bulk payloads exceeding standard personal finance volumes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
