import React, { useState, useEffect } from 'react';
import { FileBarChart, Sparkles, Download, RefreshCw, TrendingUp, ShieldCheck, CloudCheck, Cloud, AlertCircle, Database } from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { MonthlyReportJob } from '../types.js';
import { useDate } from '../context/DateContext.js';
import { downloadReceiptPdf } from '../utils/pdfReceiptGenerator.js';

interface AwsStatusInfo {
  dynamoDbConnected: boolean;
  s3Connected: boolean;
  region: string;
  tableName: string;
  bucketName: string;
  isQuarantined: boolean;
  lastError?: string;
}

export const ReportsPage: React.FC = () => {
  const { selectedMonth } = useDate();
  const [reportJob, setReportJob] = useState<MonthlyReportJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [awsStatus, setAwsStatus] = useState<AwsStatusInfo | null>(null);

  // Automatically fetch latest existing/historical report when component mounts or month changes
  useEffect(() => {
    let isMounted = true;
    setLoadingInitial(true);

    async function loadLatestReport() {
      try {
        const res = await apiRequest<MonthlyReportJob>(`/api/reports/latest?month=${selectedMonth}`);
        if (isMounted && res) {
          setReportJob(res);
        }
      } catch (err: any) {
        console.warn('Could not load latest report:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    async function checkAws() {
      try {
        const res = await apiRequest<AwsStatusInfo>('/api/aws/status');
        if (isMounted && res) {
          setAwsStatus(res);
        }
      } catch {}
    }

    loadLatestReport();
    checkAws();

    return () => {
      isMounted = false;
    };
  }, [selectedMonth]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    const targetMonth = selectedMonth || reportJob?.month || new Date().toISOString().substring(0, 7);
    try {
      const res = await apiRequest<MonthlyReportJob>('/api/reports/monthly', {
        method: 'POST',
        body: JSON.stringify({ month: targetMonth }),
      });
      setReportJob(res);
      if (res.status === 'DONE' || res.status === 'FAILED') {
        setGenerating(false);
      } else {
        pollReportStatus(res.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate report');
      setGenerating(false);
    }
  };

  const handleEmailReceipt = async () => {
    if (!reportJob) {
      alert('No report available yet to email. Please click Generate first.');
      return;
    }
    setEmailing(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/reports/email', {
        method: 'POST',
        body: JSON.stringify({ jobId: reportJob.id, month: reportJob.month }),
      });
      alert(res.message || 'Report receipt successfully dispatched via AWS SNS!');
    } catch (err: any) {
      alert(err.message || 'Failed to email report via SNS');
    } finally {
      setEmailing(false);
    }
  };

  const pollReportStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest<MonthlyReportJob>(`/api/reports/${jobId}/status`);
        setReportJob(res);
        if (res.status === 'DONE' || res.status === 'FAILED') {
          clearInterval(interval);
          setGenerating(false);
        }
      } catch (err) {
        clearInterval(interval);
        setGenerating(false);
      }
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5 sm:mb-7">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
              Financial Synthesis & Reports
            </h1>
          </div>
          <p className="text-xs sm:text-[13px] text-gray-500 font-light mt-0.5 tracking-tight">
            Comprehensive monthly audit, category variance, executive AI analysis, and vector PDF receipt.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="btn-secondary"
            title="Generate or recalculate monthly financial synthesis report"
          >
            <span>
              {generating
                ? 'Generating...'
                : reportJob && reportJob.status === 'DONE'
                ? 'Regenerate'
                : 'Generate Report'}
            </span>
          </button>

          <button
            onClick={handleEmailReceipt}
            disabled={emailing || generating || !reportJob || reportJob.status !== 'DONE'}
            className="btn-primary"
            title="Email the current report receipt via AWS SNS"
          >
            <span>{emailing ? 'Sending via SNS...' : 'Email (SNS)'}</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loadingInitial ? (
        <div className="card-base p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-24 bg-gray-100 rounded-2xl"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-16 bg-gray-100 rounded-xl"></div>
            <div className="h-16 bg-gray-100 rounded-xl"></div>
            <div className="h-16 bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      ) : reportJob && reportJob.status === 'DONE' ? (
        <div className="card-base p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5 gap-3">
            <div>
              <div className="mb-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-green-700 block">
                  Executive Synthesis
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Monthly Financial Audit — {reportJob.month}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Cycle Audit {reportJob.month} · Generated {new Date(reportJob.createdAt).toLocaleDateString()} · Financial Intelligence Analytics
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => downloadReceiptPdf(reportJob)}
                className="btn-secondary"
                title="Download verified official PDF receipt directly to your device"
              >
                <Download className="w-3.5 h-3.5 text-green-700" />
                <span>Print PDF Receipt</span>
              </button>
            </div>
          </div>

          {/* Detailed Executive Briefing */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-[#166534] to-[#14532d] text-white rounded-3xl space-y-3 shadow-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-300">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-semibold tracking-wide uppercase">
                  Executive Financial Analysis & Strategic Health
                </span>
              </div>
              <span className="text-[10px] font-mono-num bg-white/15 text-green-100 px-2 py-0.5 rounded-full">
                Audit Verified · {reportJob.month}
              </span>
            </div>
            {/* Formatted narrative points without **, ###, or markdown tokens */}
            <div className="space-y-3 select-text">
              {reportJob.narrative
                ?.split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && l !== '---')
                .map((line, idx) => {
                  const cleanLine = line
                    .replace(/###\s*/g, '')
                    .replace(/\*\*/g, '')
                    .replace(/^[\*\-•]\s*/g, '')
                    .replace(/#+\s*/g, '')
                    .trim();

                  if (!cleanLine) return null;

                  const isHeader = /^\d+\.\s+[A-Z]/.test(cleanLine) || line.startsWith('###');
                  const isHighlight =
                    cleanLine.toLowerCase().includes('positive takeaway') ||
                    cleanLine.toLowerCase().includes('advisor insight');

                  if (isHeader) {
                    return (
                      <div key={idx} className="pt-2 border-t border-white/10 first:border-t-0 first:pt-0">
                        <h4 className="text-xs sm:text-[13px] font-semibold text-emerald-200 tracking-wide">
                          {cleanLine}
                        </h4>
                      </div>
                    );
                  }

                  if (isHighlight) {
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white/10 rounded-2xl border border-white/15 text-xs text-emerald-100 font-light leading-relaxed"
                      >
                        <span className="font-semibold text-emerald-300 mr-1.5">Key Insight:</span>
                        {cleanLine
                          .replace(/^Key Insight:?\s*/i, '')
                          .replace(/^Positive Takeaway:?\s*/i, '')
                          .replace(/^Advisor Insight:?\s*/i, '')}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs sm:text-[13px] text-green-50/95 font-light leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-2" />
                      <p className="flex-1">{cleanLine}</p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <span className="text-[11px] font-medium text-gray-400 block mb-1">
                Total Inflow
              </span>
              <p className="text-xl font-mono-num font-semibold text-gray-900">
                ₹{reportJob.summary?.totalIncome.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <span className="text-[11px] font-medium text-gray-400 block mb-1">
                Total Outflow
              </span>
              <p className="text-xl font-mono-num font-semibold text-gray-900">
                ₹{reportJob.summary?.totalExpense.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <span className="text-[11px] font-medium text-gray-400 block mb-1">
                Net Retained
              </span>
              <p className={`text-xl font-mono-num font-semibold ${(reportJob.summary?.netSaved || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                ₹{reportJob.summary?.netSaved.toLocaleString('en-IN')} ({reportJob.summary?.savingsRate}%)
              </p>
            </div>
          </div>

          {/* Category Table */}
          <div className="space-y-2.5">
            <h3 className="font-semibold text-gray-900 text-xs tracking-tight">
              Category Spending & Targets
            </h3>
            <div className="card-base overflow-hidden rounded-[20px] border border-[#edf2ee] bg-white shadow-none">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#edf2ee] text-[11px] font-semibold text-gray-600 uppercase tracking-wider bg-[#fafcfa]">
                    <th className="py-2.5 px-4 border-r border-[#edf2ee]">Category</th>
                    <th className="py-2.5 px-4 border-r border-[#edf2ee]">Spent</th>
                    <th className="py-2.5 px-4 border-r border-[#edf2ee]">Monthly Max</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportJob.categorySpends?.map((cat, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 border-b border-[#edf2ee] last:border-b-0">
                      <td className="py-2.5 px-4 font-medium text-gray-900 border-r border-[#edf2ee]">{cat.categoryName}</td>
                      <td className="py-2.5 px-4 font-mono-num text-gray-900 border-r border-[#edf2ee]">₹ {cat.total.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 font-mono-num text-gray-400 border-r border-[#edf2ee]">₹ {(cat.limitAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-mono-num font-medium border ${
                            (cat.percentUsed || 0) > 100
                              ? 'bg-red-50 text-red-700 border-red-200/60'
                              : (cat.percentUsed || 0) >= 80
                              ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                              : 'bg-green-50 text-green-700 border-green-200/60'
                          }`}
                        >
                          {cat.percentUsed || 0}% used
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-[50vh] sm:min-h-[58vh] flex items-center justify-center">
          <div className="card-base p-8 sm:p-10 text-center max-w-md w-full mx-auto space-y-3.5 rounded-[24px] border border-[#edf2ee]">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] flex items-center justify-center mx-auto shadow-none">
              <FileBarChart className="w-5 h-5 text-[#166534]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-gray-900 tracking-tight">
                No Analytics Yet For {selectedMonth}
              </h3>
              <p className="text-xs text-gray-400 font-light leading-relaxed max-w-sm mx-auto">
                Click &apos;Generate Report&apos; above to compute monthly KPIs, compile category breakdowns, and dispatch your verified receipt.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
