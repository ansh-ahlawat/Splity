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
  await db.saveItem('reportJobs', reportJob);

  // Directly await report processing so Lambda does NOT freeze the async promise
  const completedReport = await processReportJob(userId, jobId, month);
  return completedReport || reportJob;
}

export async function processReportJob(userId: string, jobId: string, month: string): Promise<MonthlyReportJob | undefined> {
  if (!db.data.reportJobs) db.data.reportJobs = [];
  const report = db.data.reportJobs.find((r) => r.id === jobId && r.userId === userId);
  if (!report) return;

  try {
    const summary = await getMonthlySummary(userId, month);
    const categorySpends = await getSpendByCategory(userId, month);
    const topMerchants = await getTopMerchants(userId, month, 5);

    // Calculate previous month for month-over-month comparison
    const [yearStr, monthStr] = month.split('-');
    let prevYear = parseInt(yearStr, 10);
    let prevMonthNum = parseInt(monthStr, 10) - 1;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
    const lastMonthSummary = await getMonthlySummary(userId, prevMonth);

    // Savings comparison with arrows and percentage
    let savingsComparison = '';
    const diff = summary.netSaved - lastMonthSummary.netSaved;
    if (lastMonthSummary.totalIncome > 0 || lastMonthSummary.totalExpense > 0) {
      if (lastMonthSummary.netSaved === 0) {
        savingsComparison = diff >= 0 
          ? `Savings increased by Rs. ${Math.abs(diff).toLocaleString('en-IN')} (↑) compared to last month.`
          : `Savings decreased by Rs. ${Math.abs(diff).toLocaleString('en-IN')} (↓) compared to last month.`;
      } else {
        const pctChange = Math.abs(Math.round((diff / Math.abs(lastMonthSummary.netSaved)) * 100));
        const arrow = diff >= 0 ? '↑' : '↓';
        savingsComparison = diff >= 0
          ? `Savings increased by ${pctChange}% (${arrow}) compared to last month.`
          : `Savings decreased by ${pctChange}% (${arrow}) compared to last month.`;
      }
    } else {
      savingsComparison = `Savings stood at Rs. ${summary.netSaved.toLocaleString('en-IN')} (Baseline month).`;
    }

    // Category advice on where to spend less
    const topCat = categorySpends[0] && categorySpends[0].total > 0 ? categorySpends[0] : null;
    const categoryAdvice = topCat
      ? `You can spend less on ${topCat.categoryName} (Rs. ${topCat.total.toLocaleString('en-IN')}) to increase your savings next month.`
      : `Keep tracking your daily expenses to optimize your savings next month.`;

    const cashFlowPoint = summary.netSaved >= 0
      ? `You saved Rs. ${summary.netSaved.toLocaleString('en-IN')} this month with a savings rate of ${summary.savingsRate}%.`
      : `Expenses exceeded income by Rs. ${Math.abs(summary.netSaved).toLocaleString('en-IN')} this month. Focus on reducing non-essential expenses.`;

    const factPrompt = `
Generate a 3-bullet point Ai Summary in simple, clear English for personal finance for ${month}:
- Point 1: Cash Flow summary (Income: Rs. ${summary.totalIncome}, Expense: Rs. ${summary.totalExpense}, Net Saved: Rs. ${summary.netSaved}).
- Point 2: Specific recommendation where to spend less (Top spending category is ${topCat ? topCat.categoryName + ' at Rs. ' + topCat.total : 'miscellaneous'}).
- Point 3: Month-over-month comparison using arrows (↑ or ↓) and percentage: "${savingsComparison}".

Keep it concise, strictly bullet points starting with '• ', no jargon, no emojis.
`;

    let narrative = '';
    try {
      const narrativePromise = generateNarrativeText(factPrompt);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('AI narrative timeout')), 3500)
      );
      narrative = await Promise.race([narrativePromise, timeoutPromise]);
    } catch {
      narrative = '';
    }

    // Simple English fallback if AI fails or returns generic response
    if (!narrative || narrative.includes('unavailable') || narrative.length < 30) {
      narrative = [
        `• Cash Flow: ${cashFlowPoint}`,
        `• Category Optimization: ${categoryAdvice}`,
        `• Savings Trend: ${savingsComparison}`
      ].join('\n\n');
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
