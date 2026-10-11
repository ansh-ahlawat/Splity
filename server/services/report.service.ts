import crypto from 'node:crypto';
import { db } from '../db.js';
import { generateNarrativeText } from '../gemini.js';
import { getMonthlySummary, getSpendByCategory, getTopMerchants } from './transaction.service.js';
import { MonthlyReportJob } from '../../src/types.js';
import { createNotification } from './notification.service.js';

export async function createMonthlyReport(userId: string, month: string): Promise<MonthlyReportJob> {
  const jobId = crypto.randomUUID();

  const reportJob: MonthlyReportJob = {
    id: jobId,
    userId,
    month,
    status: 'RUNNING',
    createdAt: new Date().toISOString(),
  };

  db.data.reportJobs.push(reportJob);
  db.save();

  // Run async processing
  processReportJob(userId, jobId, month).catch((err) => console.error('Report generation error:', err));

  return reportJob;
}

async function processReportJob(userId: string, jobId: string, month: string) {
  const report = db.data.reportJobs.find((r) => r.id === jobId && r.userId === userId);
  if (!report) return;

  try {
    const summary = await getMonthlySummary(userId, month);
    const categorySpends = await getSpendByCategory(userId, month);
    const topMerchants = await getTopMerchants(userId, month, 5);

    const factPrompt = `
Monthly Financial Performance Summary (${month}):
Total Inflow (Income): ₹${summary.totalIncome.toFixed(2)}
Total Outflow (Expenses): ₹${summary.totalExpense.toFixed(2)}
Net Capital Retained (Savings): ₹${summary.netSaved.toFixed(2)} (Savings Efficiency Rate: ${summary.savingsRate}%)
Top Expense Categories: ${categorySpends.slice(0, 4).map((c) => `${c.categoryName}: ₹${c.total} (${c.percentUsed || 0}% of budget)`).join(', ')}
Top Payees / Merchants: ${topMerchants.slice(0, 4).map((m) => `${m.merchant}: ₹${m.total}`).join(', ')}

Please provide an advanced-level yet crystal-clear Executive Financial Analysis written in an approachable, easily understandable style for everyday personal finance. Cover:
1. Overall Cash Flow Health & Capital Retention.
2. Major Spending Drivers & Budget Compliance.
3. 2 Practical Strategic Steps to optimize cash reserves next month.
`;

    let narrative = await generateNarrativeText(factPrompt);

    // Advanced, crystal-clear fallback if AI returns generic message
    if (!narrative || narrative.includes('unavailable') || narrative.length < 50) {
      const isPositive = summary.netSaved >= 0;
      const topCat = categorySpends[0] ? `${categorySpends[0].categoryName} (₹${categorySpends[0].total.toLocaleString('en-IN')})` : 'general categories';
      const topMerch = topMerchants[0] ? `${topMerchants[0].merchant} (₹${topMerchants[0].total.toLocaleString('en-IN')})` : 'recurring payees';

      narrative = `During this billing cycle, your total inflow reached ₹${summary.totalIncome.toLocaleString('en-IN')} against ₹${summary.totalExpense.toLocaleString('en-IN')} in total expenditures, resulting in ${
        isPositive
          ? `a positive net capital retention of ₹${summary.netSaved.toLocaleString('en-IN')} (${summary.savingsRate}% savings efficiency)`
          : `a net deficit of ₹${Math.abs(summary.netSaved).toLocaleString('en-IN')}`
      }. Your primary spending driver was concentrated in ${topCat}, with significant disbursements recorded at ${topMerch}. To fortify your financial runway next cycle, maintain spending discipline across variable lifestyle categories and systematically allocate surplus inflows into dedicated liquid reserves.`;
    }

    report.status = 'DONE';
    report.summary = summary;
    report.categorySpends = categorySpends;
    report.topMerchants = topMerchants;
    report.narrative = narrative;
    report.downloadUrl = `/api/reports/${jobId}/download`;

    db.save();

    createNotification(userId, {
      type: 'REPORT_READY',
      category: 'Reports',
      message: `Financial Analytics: Your monthly synthesis report for ${month} is ready.`,
    });
  } catch (err: any) {
    report.status = 'FAILED';
    report.error = err.message || 'Failed to generate monthly report.';
    db.save();
  }
}

export async function getReportStatus(userId: string, jobId: string): Promise<MonthlyReportJob> {
  const report = db.data.reportJobs.find((r) => r.id === jobId && r.userId === userId);
  if (!report) {
    throw { status: 404, message: 'Report job not found' };
  }
  return report;
}
