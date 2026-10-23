import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db.js';
import { generateNarrativeText } from '../gemini.js';
import { getMonthlySummary, getSpendByCategory, getTopMerchants } from './transaction.service.js';
import { MonthlyReportJob } from '../../src/types.js';
import { createNotification } from './notification.service.js';
import { uploadReportToS3, sendReceiptViaSns } from '../aws/aws.service.js';

export async function createMonthlyReport(userId: string, requestedMonth?: string): Promise<MonthlyReportJob> {
  const month = requestedMonth || new Date().toISOString().substring(0, 7);
  if (!db.data.reportJobs) db.data.reportJobs = [];

  // Update previous receipt for this month if one already exists
  const existingIndex = db.data.reportJobs.findIndex((r) => r.userId === userId && r.month === month);
  const jobId = existingIndex >= 0 ? db.data.reportJobs[existingIndex].id : crypto.randomUUID();

  const reportJob: MonthlyReportJob = {
    id: jobId,
    userId,
    month,
    status: 'RUNNING',
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    db.data.reportJobs[existingIndex] = reportJob;
  } else {
    db.data.reportJobs.push(reportJob);
  }
  db.saveItem('reportJobs', reportJob);

  // Run async processing
  processReportJob(userId, jobId, month).catch((err) => console.error('Report generation error:', err));

  return reportJob;
}

export async function processReportJob(userId: string, jobId: string, month: string): Promise<MonthlyReportJob | undefined> {
  if (!db.data.reportJobs) db.data.reportJobs = [];
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

    // Persist full report payload to AWS S3
    const reportPayload = JSON.stringify(
      {
        id: jobId,
        userId,
        month,
        status: 'DONE',
        summary,
        categorySpends,
        topMerchants,
        narrative,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const s3Result = await uploadReportToS3({
      key: `reports/${userId}/${month}/monthly_synthesis_${jobId}.json`,
      content: reportPayload,
      contentType: 'application/json',
      reportId: jobId,
    });

    report.s3Url = s3Result.s3Url;
    report.s3Key = s3Result.s3Key;

    // Save to DB and DynamoDB (updating previous receipt)
    db.saveItem('reportJobs', report);

    // Send PDF receipt and synthesis to emailholder via AWS SNS
    const user = db.data.users.find((u) => u.id === userId);
    const userEmail = user?.email || 'user@splity.app';

    sendReceiptViaSns({
      email: userEmail,
      month,
      summary,
      narrative,
      downloadUrl: report.downloadUrl,
      s3Url: report.s3Url,
    }).catch((snsErr) => console.warn('[AWS SNS] Non-blocking dispatch notice:', snsErr.message));

    createNotification(userId, {
      type: 'REPORT_READY',
      category: 'Reports',
      message: `Financial Analytics: Your receipt for ${month} has been updated in S3 and dispatched to ${userEmail} via AWS SNS.`,
    });

    return report;
  } catch (err: any) {
    report.status = 'FAILED';
    report.error = err.message || 'Failed to generate monthly report.';
    db.saveItem('reportJobs', report);
    return report;
  }
}

export async function getReportStatus(userId: string, jobId: string): Promise<MonthlyReportJob> {
  if (!db.data.reportJobs) db.data.reportJobs = [];
  const report = db.data.reportJobs.find((r) => r.id === jobId && r.userId === userId);
  if (!report) {
    throw { status: 404, message: 'Report job not found' };
  }
  return report;
}

/**
 * Retrieve the latest analytics report for the user.
 * If a report for the requested month exists, return it.
 * If none exists for the requested month, return the most recent available report.
 * If none exists at all, generate one immediately so the user NEVER sees a blank screen!
 */
export async function getLatestMonthlyReport(userId: string, month?: string): Promise<MonthlyReportJob> {
  if (!db.data.reportJobs) db.data.reportJobs = [];

  // Filter completed reports for this user
  const userReports = db.data.reportJobs.filter((r) => r.userId === userId && r.status === 'DONE');

  // Sort descending by creation date
  userReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (month) {
    const monthReport = userReports.find((r) => r.month === month);
    if (monthReport) return monthReport;
  }

  // If there's any completed report from a previous month, return the latest one
  if (userReports.length > 0) {
    return userReports[0];
  }

  // If no report exists at all, generate one synchronously right now
  const targetMonth = month || new Date().toISOString().substring(0, 7);
  const jobId = crypto.randomUUID();
  const initialJob: MonthlyReportJob = {
    id: jobId,
    userId,
    month: targetMonth,
    status: 'RUNNING',
    createdAt: new Date().toISOString(),
  };

  db.data.reportJobs.push(initialJob);
  db.saveItem('reportJobs', initialJob);

  const completedReport = await processReportJob(userId, jobId, targetMonth);
  return completedReport || initialJob;
}

export async function getAllUserReports(userId: string): Promise<MonthlyReportJob[]> {
  if (!db.data.reportJobs) db.data.reportJobs = [];
  return db.data.reportJobs
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
