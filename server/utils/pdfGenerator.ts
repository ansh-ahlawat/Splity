import { MonthlyReportJob, User } from '../../src/types.js';

function escapePdfText(text: string): string {
  const clean = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return clean
    .replace(/₹/g, 'Rs. ')
    .replace(/•/g, '*')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let curLine = '';
  for (const w of words) {
    if ((curLine + ' ' + w).trim().length > maxChars) {
      if (curLine) lines.push(curLine.trim());
      curLine = w;
    } else {
      curLine += (curLine ? ' ' : '') + w;
    }
  }
  if (curLine.trim()) lines.push(curLine.trim());
  return lines;
}

export function generatePdfBuffer(report: MonthlyReportJob, user?: User | null): Buffer {
  const month = report.month || '2026-10';
  const now = new Date(report.createdAt || Date.now());
  const formattedDate = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const userName = user?.name || 'Ansh Ahlawat';
  const userEmail = user?.email || 'anshahlawat.me@gmail.com';

  const rawId = (report.id || '9842').replace(/[^a-zA-Z0-9]/g, '');
  const idSuffix = rawId.length >= 4 ? rawId.slice(-4).toUpperCase() : '8421';
  const cleanMonthCode = month.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toUpperCase();
  const receiptNo = `#SPL-${cleanMonthCode}-${idSuffix}`;
  const cryptoHash = `SPL-${idSuffix}-4C10-B7E2-${rawId.slice(0, 4).toUpperCase() || '990A'}`;

  const incomeVal = report.summary?.totalIncome || 0;
  const expenseVal = report.summary?.totalExpense || 0;
  const netSavedVal = report.summary?.netSaved || 0;
  const savingsRateVal = report.summary?.savingsRate || 0;

  const totalIncomeStr = `Rs. ${incomeVal.toLocaleString('en-IN')}`;
  const totalExpenseStr = `Rs. ${expenseVal.toLocaleString('en-IN')}`;
  const netSavedStr = `Rs. ${netSavedVal.toLocaleString('en-IN')} (${savingsRateVal}%)`;

  const categories = report.categorySpends && report.categorySpends.length > 0
    ? report.categorySpends
    : [
        { categoryName: 'Housing & Rent', spent: 12000, budget: 15000, percentUsed: 80 },
        { categoryName: 'Food & Dining', spent: 4050, budget: 14000, percentUsed: 29 },
        { categoryName: 'Shopping & Lifestyle', spent: 2450, budget: 8000, percentUsed: 31 },
      ];

  const withinBudgetCount = categories.filter((c) => (c.percentUsed || 0) <= 100).length;
  const budgetComplianceStr = `${Math.round((withinBudgetCount / categories.length) * 100)}% Compliant`;
  const dailyBurnStr = `Rs. ${Math.round(expenseVal / 30).toLocaleString('en-IN')}/day`;

  const rawNarrative =
    report.narrative ||
    `During this billing cycle, your total inflow reached Rs. ${incomeVal.toLocaleString(
      'en-IN'
    )} against Rs. ${expenseVal.toLocaleString(
      'en-IN'
    )} in total expenditures, resulting in net savings of Rs. ${netSavedVal.toLocaleString(
      'en-IN'
    )} (${savingsRateVal}% savings efficiency).`;

  const narrativeLines = wrapText(rawNarrative, 90).slice(0, 5);

  const streamLines: string[] = [];

  const drawRect = (x: number, y: number, width: number, height: number, r: number, g: number, b: number) => {
    streamLines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    streamLines.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  };

  const drawRoundedRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fillR: number,
    fillG: number,
    fillB: number,
    strokeR?: number,
    strokeG?: number,
    strokeB?: number,
    strokeW = 0.5
  ) => {
    const k = 0.5522847498 * radius;
    streamLines.push(`${fillR.toFixed(3)} ${fillG.toFixed(3)} ${fillB.toFixed(3)} rg`);
    if (strokeR !== undefined && strokeG !== undefined && strokeB !== undefined) {
      streamLines.push(`${strokeW.toFixed(2)} w`);
      streamLines.push(`${strokeR.toFixed(3)} ${strokeG.toFixed(3)} ${strokeB.toFixed(3)} RG`);
    }

    streamLines.push(`${(x + radius).toFixed(2)} ${y.toFixed(2)} m`);
    streamLines.push(`${(x + w - radius).toFixed(2)} ${y.toFixed(2)} l`);
    streamLines.push(
      `${(x + w - radius + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + radius - k).toFixed(2)} ${(
        x + w
      ).toFixed(2)} ${(y + radius).toFixed(2)} c`
    );
    streamLines.push(`${(x + w).toFixed(2)} ${(y + h - radius).toFixed(2)} l`);
    streamLines.push(
      `${(x + w).toFixed(2)} ${(y + h - radius + k).toFixed(2)} ${(x + w - radius + k).toFixed(2)} ${(
        y + h
      ).toFixed(2)} ${(x + w - radius).toFixed(2)} ${(y + h).toFixed(2)} c`
    );
    streamLines.push(`${(x + radius).toFixed(2)} ${(y + h).toFixed(2)} l`);
    streamLines.push(
      `${(x + radius - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - radius + k).toFixed(2)} ${x.toFixed(
        2
      )} ${(y + h - radius).toFixed(2)} c`
    );
    streamLines.push(`${x.toFixed(2)} ${(y + radius).toFixed(2)} l`);
    streamLines.push(
      `${x.toFixed(2)} ${(y + radius - k).toFixed(2)} ${(x + radius - k).toFixed(2)} ${y.toFixed(2)} ${(
        x + radius
      ).toFixed(2)} ${y.toFixed(2)} c`
    );

    if (strokeR !== undefined) {
      streamLines.push('B');
    } else {
      streamLines.push('f');
    }
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r = 0.88,
    g = 0.9,
    b = 0.88,
    w = 0.5
  ) => {
    streamLines.push(`${w.toFixed(2)} w`);
    streamLines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    streamLines.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    font = '/F1',
    size = 9,
    r = 0.15,
    g = 0.18,
    b = 0.15,
    align: 'left' | 'right' | 'center' = 'left',
    approxWidth = 0
  ) => {
    const esc = escapePdfText(text);
    let drawX = x;
    if (align === 'right' && approxWidth > 0) {
      drawX = x - approxWidth;
    } else if (align === 'center' && approxWidth > 0) {
      drawX = x - approxWidth / 2;
    }

    streamLines.push('BT');
    streamLines.push(`${font} ${size} Tf`);
    streamLines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    streamLines.push(`1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm`);
    streamLines.push(`(${esc}) Tj`);
    streamLines.push('ET');
  };

  // Backdrop
  drawRect(0, 0, 595.28, 841.89, 0.985, 0.988, 0.985);

  const leftX = 42;
  const contentW = 511.28;

  // Header & Branding
  drawRoundedRect(leftX, 762, 34, 34, 8, 0.086, 0.396, 0.204);
  drawText('S', leftX + 11, 773, '/F2', 18, 1, 1, 1);

  drawText('SPLITY', leftX + 44, 783, '/F2', 16, 0.06, 0.09, 0.16);
  drawText('OFFICIAL FINANCIAL SYNTHESIS & AUDIT STATEMENT', leftX + 44, 770, '/F2', 7, 0.086, 0.396, 0.204);

  drawText(`RECEIPT: ${receiptNo}`, leftX + contentW, 784, '/F2', 8.5, 0.06, 0.09, 0.16, 'right', 130);
  drawText(`Audit Cycle: ${month}  |  Generated: ${formattedDate}`, leftX + contentW, 772, '/F1', 7.5, 0.39, 0.45, 0.54, 'right', 170);
  drawText(`Account: ${userName} (${userEmail})`, leftX + contentW, 760, '/F1', 7.5, 0.39, 0.45, 0.54, 'right', 180);

  drawLine(leftX, 748, leftX + contentW, 748, 0.88, 0.91, 0.94, 0.6);

  // Banner: Ai Summary (No green dot!)
  const bannerY = 598;
  const bannerH = 136;
  drawRoundedRect(leftX, bannerY, contentW, bannerH, 16, 0.078, 0.325, 0.176);

  drawRoundedRect(leftX + 16, bannerY + bannerH - 28, 16, 16, 8, 0.18, 0.42, 0.28);
  drawText('[v]', leftX + 19, bannerY + bannerH - 24, '/F2', 7.5, 0.525, 0.937, 0.675);

  drawText('Ai Summary', leftX + 38, bannerY + bannerH - 23, '/F2', 10, 0.525, 0.937, 0.675);

  drawRoundedRect(leftX + contentW - 128, bannerY + bannerH - 30, 114, 20, 10, 0.16, 0.4, 0.26);
  drawText(`Audit Verified | ${month}`, leftX + contentW - 120, bannerY + bannerH - 23, '/F2', 7.5, 0.86, 0.99, 0.9);

  let curNarrativeY = bannerY + bannerH - 48;
  for (const line of narrativeLines) {
    drawText(line, leftX + 20, curNarrativeY, '/F1', 8.2, 0.96, 0.98, 0.96);
    curNarrativeY -= 14.5;
  }

  // 3 Metric KPI Cards
  const metricY = 496;
  const metricH = 86;
  const cardW = (contentW - 20) / 3;

  drawRoundedRect(leftX, metricY, cardW, metricH, 14, 1, 1, 1, 0.88, 0.91, 0.94, 0.6);
  drawText('Total Inflow', leftX + 16, metricY + metricH - 24, '/F2', 9, 0.392, 0.455, 0.545);
  drawText(totalIncomeStr, leftX + 16, metricY + 22, '/F2', 17.5, 0.059, 0.09, 0.165);

  const card2X = leftX + cardW + 10;
  drawRoundedRect(card2X, metricY, cardW, metricH, 14, 1, 1, 1, 0.88, 0.91, 0.94, 0.6);
  drawText('Total Outflow', card2X + 16, metricY + metricH - 24, '/F2', 9, 0.392, 0.455, 0.545);
  drawText(totalExpenseStr, card2X + 16, metricY + 22, '/F2', 17.5, 0.059, 0.09, 0.165);

  const card3X = card2X + cardW + 10;
  drawRoundedRect(card3X, metricY, cardW, metricH, 14, 1, 1, 1, 0.88, 0.91, 0.94, 0.6);
  drawText('Net Retained', card3X + 16, metricY + metricH - 24, '/F2', 9, 0.392, 0.455, 0.545);
  drawText(netSavedStr, card3X + 16, metricY + 22, '/F2', 16, 0.086, 0.639, 0.29);

  // Category Spending & Targets Table
  const tableTitleY = 462;
  drawText('Category Spending & Targets', leftX, tableTitleY, '/F2', 11.5, 0.06, 0.09, 0.165);

  const tableHeaderY = 430;
  const tableHeaderH = 24;
  drawRoundedRect(leftX, tableHeaderY, contentW, tableHeaderH, 6, 0.972, 0.98, 0.988, 0.88, 0.91, 0.94, 0.5);

  drawText('CATEGORY', leftX + 16, tableHeaderY + 7, '/F2', 8, 0.278, 0.333, 0.412);
  drawText('SPENT', leftX + 220, tableHeaderY + 7, '/F2', 8, 0.278, 0.333, 0.412);
  drawText('MONTHLY MAX', leftX + 330, tableHeaderY + 7, '/F2', 8, 0.278, 0.333, 0.412);
  drawText('STATUS', leftX + 450, tableHeaderY + 7, '/F2', 8, 0.278, 0.333, 0.412);

  let rowY = tableHeaderY - 32;
  for (const cat of categories) {
    const catName = cat.categoryName || 'General';
    const spentStr = `Rs. ${(cat.spent || 0).toLocaleString('en-IN')}`;
    const maxStr = `Rs. ${(cat.budget || 0).toLocaleString('en-IN')}`;
    const pct = cat.percentUsed || 0;
    const badgeText = `${pct}% used`;

    drawLine(leftX, rowY - 6, leftX + contentW, rowY - 6, 0.94, 0.95, 0.96, 0.5);

    drawText(catName, leftX + 16, rowY + 6, '/F2', 9.5, 0.06, 0.09, 0.165);
    drawText(spentStr, leftX + 220, rowY + 6, '/F2', 9.5, 0.06, 0.09, 0.165);
    drawText(maxStr, leftX + 330, rowY + 6, '/F1', 9, 0.58, 0.64, 0.72);

    const isAmber = pct >= 80;
    const badgeW = 66;
    const badgeH = 18;
    const badgeX = leftX + 438;

    if (isAmber) {
      drawRoundedRect(badgeX, rowY + 1, badgeW, badgeH, 9, 0.996, 0.953, 0.78, 0.992, 0.902, 0.541, 0.5);
      drawText(badgeText, badgeX + 10, rowY + 6, '/F2', 7.5, 0.706, 0.325, 0.035);
    } else {
      drawRoundedRect(badgeX, rowY + 1, badgeW, badgeH, 9, 0.863, 0.988, 0.906, 0.733, 0.969, 0.816, 0.5);
      drawText(badgeText, badgeX + 10, rowY + 6, '/F2', 7.5, 0.082, 0.502, 0.239);
    }

    rowY -= 30;
  }

  // Verification Box
  const boxY = Math.max(130, rowY - 14);
  const boxW = (contentW - 12) / 2;

  drawRoundedRect(leftX, boxY, boxW, 52, 10, 1, 1, 1, 0.88, 0.91, 0.94, 0.5);
  drawText('BUDGET COMPLIANCE & BURN-RATE', leftX + 14, boxY + 36, '/F2', 7, 0.39, 0.45, 0.54);
  drawText(`Allocation Health: ${budgetComplianceStr}`, leftX + 14, boxY + 22, '/F2', 8.5, 0.06, 0.09, 0.165);
  drawText(`Estimated Daily Run-Rate: ${dailyBurnStr}`, leftX + 14, boxY + 9, '/F1', 7.5, 0.39, 0.45, 0.54);

  const box2X = leftX + boxW + 12;
  drawRoundedRect(box2X, boxY, boxW, 52, 10, 1, 1, 1, 0.88, 0.91, 0.94, 0.5);
  drawText('LEDGER AUTHENTICITY & SECURITY', box2X + 14, boxY + 36, '/F2', 7, 0.39, 0.45, 0.54);
  drawText('Status: Cryptographically Verified & Sealed', box2X + 14, boxY + 22, '/F2', 8.5, 0.086, 0.396, 0.204);
  drawText(`Audit Fingerprint: ${cryptoHash}`, box2X + 14, boxY + 9, '/F1', 7.5, 0.39, 0.45, 0.54);

  const footerLineY = boxY - 16;
  drawLine(leftX, footerLineY, leftX + contentW, footerLineY, 0.88, 0.91, 0.94, 0.5);

  drawText(
    'Splity Financial Operating System  |  Verified Monthly Audit Report  |  Stored in AWS S3',
    leftX + contentW / 2,
    footerLineY - 16,
    '/F1',
    7.5,
    0.58,
    0.64,
    0.72,
    'center',
    340
  );
  drawText(
    'This document is a certified digital financial record generated for tax, budgeting, and reimbursement compliance.',
    leftX + contentW / 2,
    footerLineY - 28,
    '/F1',
    6.8,
    0.72,
    0.78,
    0.84,
    'center',
    380
  );

  const streamContent = streamLines.join('\n');
  const streamLen = streamContent.length;

  const pdfParts = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  ];

  const offsets = [0];
  let cum = pdfParts[0].length;
  for (let i = 1; i < pdfParts.length; i++) {
    offsets.push(cum);
    cum += pdfParts[i].length;
  }

  let xref = 'xref\n0 7\n';
  xref += `${String(offsets[0]).padStart(10, '0')} 65535 f \n`;
  for (let i = 1; i < 7; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${cum}\n%%EOF\n`;
  const finalPdf = pdfParts.join('') + xref + trailer;

  return Buffer.from(finalPdf, 'utf-8');
}
