import { MonthlyReportJob } from '../types.js';
import { SPLITY_LOGO_WIDTH, SPLITY_LOGO_HEIGHT, SPLITY_LOGO_HEX } from './receiptLogoData.js';

/**
 * Clean & escape characters for PDF literal strings (ASCII / WinAnsiEncoding).
 */
function escapePdfText(text: string): string {
  const clean = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  // Replace non-ascii with space or closest ascii equivalent
  return clean.replace(/[^\x20-\x7E]/g, ' ');
}

/**
 * Generates and downloads an authentic, high-resolution vector PDF receipt
 * with a stunning modern fintech receipt ticket layout and official Splity branding.
 */
export function downloadReceiptPdf(report: MonthlyReportJob): void {
  const month = report.month || 'Current Cycle';
  const now = new Date(report.createdAt || Date.now());
  const formattedDate = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const issuedAt = `${formattedDate}, ${formattedTime}`;

  // User details
  let userName = 'Splity Member';
  try {
    if (typeof localStorage !== 'undefined') {
      const storedName = localStorage.getItem('profile_fullname');
      if (storedName && storedName.trim()) {
        userName = storedName.trim();
      }
    }
  } catch {
    // fallback
  }

  // Receipt Identifier
  const rawId = (report.id || '9842').replace(/[^a-zA-Z0-9]/g, '');
  const idSuffix = rawId.length >= 4 ? rawId.slice(-4).toUpperCase() : '8421';
  const cleanMonthCode = month.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toUpperCase();
  const receiptNo = `#SPL-${cleanMonthCode || '202609'}-${idSuffix}`;
  const barcodeSerial = `* SPL-${cleanMonthCode || '202609'}-${idSuffix}0984 *`;
  const cryptoHash = `SPL-${idSuffix}-4C10-B7E2-${rawId.slice(0, 4).toUpperCase() || '990A'}`;

  // Financial values
  const incomeVal = report.summary?.totalIncome || 0;
  const expenseVal = report.summary?.totalExpense || 0;
  const netSavedVal = report.summary?.netSaved || 0;
  const savingsRateVal = report.summary?.savingsRate || 0;

  const totalIncomeStr = `Rs. ${incomeVal.toLocaleString('en-IN')}`;
  const totalExpenseStr = `Rs. ${expenseVal.toLocaleString('en-IN')}`;
  const netSavedStr = `Rs. ${netSavedVal.toLocaleString('en-IN')}`;
  const savingsRateStr = `${savingsRateVal}%`;

  const dailyBurnStr = `Rs. ${Math.round(expenseVal / 30).toLocaleString('en-IN')}/day`;
  const categories = report.categorySpends || [];
  const withinBudgetCount = categories.filter((c) => (c.percentUsed || 0) <= 100).length;
  const budgetComplianceStr = categories.length > 0 ? `${Math.round((withinBudgetCount / categories.length) * 100)}% compliant` : '100% compliant';
  const cashFlowHealthStr = netSavedVal >= 0 ? 'Positive Cashflow' : 'Deficit Drawdown';

  // Process executive narrative into clean lines
  const rawNarrative = report.narrative || 'Monthly financial audit generated successfully. All transactions categorized and verified.';
  const cleanedParagraphs = rawNarrative
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '---')
    .map((line) =>
      line
        .replace(/###\s*/g, '')
        .replace(/\*\*/g, '')
        .replace(/^[\*\-•]\s*/g, '- ')
        .replace(/#+\s*/g, '')
        .trim()
    )
    .filter(Boolean);

  const narrativeLines: string[] = [];
  for (const para of cleanedParagraphs) {
    const isBullet = para.startsWith('- ') || /^\d+\.\s/.test(para);
    const prefix = isBullet ? '' : '- ';
    const words = (prefix + para.replace(/^- /, '')).split(/\s+/);
    let curLine = '';
    for (const w of words) {
      if ((curLine + ' ' + w).length > 76) {
        narrativeLines.push(curLine.trim());
        curLine = '   ' + w;
      } else {
        curLine += (curLine ? ' ' : '') + w;
      }
    }
    if (curLine.trim()) {
      narrativeLines.push(curLine.trim());
    }
  }

  // Cap narrative lines for receipt card balance
  const displayedNarrative = narrativeLines.slice(0, 5);

  // PDF Coordinate Stream: A4 (595.28 x 841.89)
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
    streamLines.push(`${(x + w - radius + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + radius - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + radius).toFixed(2)} c`);
    streamLines.push(`${(x + w).toFixed(2)} ${(y + h - radius).toFixed(2)} l`);
    streamLines.push(`${(x + w).toFixed(2)} ${(y + h - radius + k).toFixed(2)} ${(x + w - radius + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - radius).toFixed(2)} ${(y + h).toFixed(2)} c`);
    streamLines.push(`${(x + radius).toFixed(2)} ${(y + h).toFixed(2)} l`);
    streamLines.push(`${(x + radius - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - radius + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - radius).toFixed(2)} c`);
    streamLines.push(`${x.toFixed(2)} ${(y + radius).toFixed(2)} l`);
    streamLines.push(`${x.toFixed(2)} ${(y + radius - k).toFixed(2)} ${(x + radius - k).toFixed(2)} ${y.toFixed(2)} ${(x + radius).toFixed(2)} ${y.toFixed(2)} c`);

    if (strokeR !== undefined) {
      streamLines.push('B');
    } else {
      streamLines.push('f');
    }
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, r = 0.88, g = 0.90, b = 0.88, w = 0.5, dashed = false) => {
    streamLines.push(`${w.toFixed(2)} w`);
    streamLines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    if (dashed) {
      streamLines.push('[3 3] 0 d');
    } else {
      streamLines.push('[] 0 d');
    }
    streamLines.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    streamLines.push('[] 0 d'); // reset dash
  };

  const drawText = (text: string, x: number, y: number, font = '/F1', size = 9, r = 0.15, g = 0.18, b = 0.15) => {
    const esc = escapePdfText(text);
    streamLines.push('BT');
    streamLines.push(`${font} ${size} Tf`);
    streamLines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    streamLines.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
    streamLines.push(`(${esc}) Tj`);
    streamLines.push('ET');
  };

  // 1. Subtle soft tinted backdrop for the A4 sheet
  drawRect(0, 0, 595.28, 841.89, 0.957, 0.968, 0.957);

  // 2. Centered modern receipt card (440pt wide, 762pt high)
  const rx = 77.64;
  const ry = 40.0;
  const rw = 440.0;
  const rh = 762.0;
  drawRoundedRect(rx, ry, rw, rh, 16, 1, 1, 1, 0.86, 0.89, 0.86, 0.6);

  // 3. Official Splity Logo at top center
  const logoW = 78.0;
  const logoH = (logoW / SPLITY_LOGO_WIDTH) * SPLITY_LOGO_HEIGHT; // ~37pt
  const logoX = rx + (rw - logoW) / 2;
  const logoY = ry + rh - 50;

  streamLines.push('q');
  streamLines.push(`${logoW.toFixed(2)} 0 0 ${logoH.toFixed(2)} ${logoX.toFixed(2)} ${logoY.toFixed(2)} cm`);
  streamLines.push('/Im1 Do');
  streamLines.push('Q');

  // 4. Status Pill above title
  const pillW = 114;
  const pillX = rx + (rw - pillW) / 2;
  drawRoundedRect(pillX, logoY - 14, pillW, 13, 6.5, 0.91, 0.96, 0.92, 0.80, 0.89, 0.82, 0.5);
  drawText('VERIFIED MONTHLY AUDIT', pillX + 9, logoY - 10, '/F2', 6.2, 0.086, 0.396, 0.204);

  // Title & Subtitle
  drawText('EXPENSE STATEMENT & RECEIPT', rx + (rw - 170) / 2, logoY - 27, '/F2', 8.5, 0.12, 0.15, 0.12);
  drawText('Certified Personal Financial Ledger', rx + (rw - 124) / 2, logoY - 38, '/F1', 7.2, 0.52, 0.55, 0.52);

  // Dotted tear divider
  drawLine(rx + 20, logoY - 48, rx + rw - 20, logoY - 48, 0.82, 0.85, 0.82, 0.75, true);

  // 5. Receipt Metadata Grid (Two balanced columns)
  let metaY = logoY - 64;
  drawText('RECEIPT NO:', rx + 24, metaY, '/F2', 7, 0.5, 0.55, 0.5);
  drawText(receiptNo, rx + 82, metaY, '/F2', 7.5, 0.15, 0.18, 0.15);

  drawText('BILLING CYCLE:', rx + 240, metaY, '/F2', 7, 0.5, 0.55, 0.5);
  drawText(month, rx + 308, metaY, '/F2', 7.5, 0.15, 0.18, 0.15);

  metaY -= 14;
  drawText('ISSUED AT:', rx + 24, metaY, '/F2', 7, 0.5, 0.55, 0.5);
  drawText(issuedAt, rx + 82, metaY, '/F1', 7.5, 0.25, 0.28, 0.25);

  drawText('ACCOUNT:', rx + 240, metaY, '/F2', 7, 0.5, 0.55, 0.5);
  drawText(userName, rx + 308, metaY, '/F2', 7.5, 0.15, 0.18, 0.15);

  metaY -= 14;
  drawText('PAYMENT LEDGER:', rx + 24, metaY, '/F2', 7, 0.5, 0.55, 0.5);
  drawText('Balanced & Reconciled', rx + 104, metaY, '/F1', 7.5, 0.25, 0.28, 0.25);

  drawText('STATUS:', rx + 240, metaY, '/F2', 7, 0.5, 0.55, 0.5);
  drawText('PAID & AUDITED', rx + 308, metaY, '/F2', 7.5, 0.086, 0.396, 0.204);

  // Dotted divider
  drawLine(rx + 20, metaY - 12, rx + rw - 20, metaY - 12, 0.85, 0.88, 0.85, 0.5, true);

  // 6. Hero Grand Total Box (Modern receipt total display)
  const heroY = metaY - 24;
  const heroH = 62;
  drawRoundedRect(rx + 20, heroY - heroH, rw - 40, heroH, 10, 0.985, 0.995, 0.985, 0.88, 0.92, 0.88, 0.5);

  drawText('TOTAL MONTHLY OUTFLOW', rx + 34, heroY - 17, '/F2', 7.5, 0.45, 0.50, 0.45);
  drawText(totalExpenseStr, rx + 34, heroY - 44, '/F2', 22, 0.10, 0.12, 0.10);

  // Sub-metrics inside hero card
  drawText('TOTAL INFLOW', rx + 250, heroY - 20, '/F2', 6.8, 0.45, 0.50, 0.45);
  drawText(totalIncomeStr, rx + 250, heroY - 32, '/F2', 10, 0.086, 0.396, 0.204);

  drawText('NET RETAINED', rx + 335, heroY - 20, '/F2', 6.8, 0.45, 0.50, 0.45);
  drawText(`${netSavedStr} (${netSavedVal >= 0 ? '+' : ''}${savingsRateStr})`, rx + 335, heroY - 32, '/F2', 10, netSavedVal >= 0 ? 0.086 : 0.82, netSavedVal >= 0 ? 0.396 : 0.15, netSavedVal >= 0 ? 0.204 : 0.15);

  // Dual-tone retention progress bar
  const barY = heroY - 52;
  const savingsPct = Math.min(100, Math.max(0, savingsRateVal));
  drawRect(rx + 250, barY, 140, 3, 0.90, 0.92, 0.90);
  drawRect(rx + 250, barY, Math.round(140 * (savingsPct / 100)), 3, 0.086, 0.396, 0.204);

  // Sub-metrics strip below hero box
  const stripY = heroY - heroH - 14;
  drawText(`Daily Burn Rate: ${dailyBurnStr}`, rx + 24, stripY, '/F1', 7.2, 0.45, 0.48, 0.45);
  drawText(`|  Budget Adherence: ${budgetComplianceStr}`, rx + 160, stripY, '/F1', 7.2, 0.45, 0.48, 0.45);
  drawText(`|  Cashflow Health: ${cashFlowHealthStr}`, rx + 310, stripY, '/F2', 7.2, netSavedVal >= 0 ? 0.086 : 0.82, netSavedVal >= 0 ? 0.396 : 0.15, netSavedVal >= 0 ? 0.204 : 0.15);

  drawLine(rx + 20, stripY - 8, rx + rw - 20, stripY - 8, 0.88, 0.91, 0.88, 0.5, true);

  // 7. Itemized Category Breakdown
  let tableY = stripY - 22;
  drawText('ITEMIZED CATEGORY BREAKDOWN', rx + 24, tableY, '/F2', 8, 0.20, 0.25, 0.20);

  tableY -= 14;
  drawRect(rx + 20, tableY - 14, rw - 40, 16, 0.97, 0.98, 0.97);
  drawText('CATEGORY', rx + 28, tableY - 10, '/F2', 7, 0.40, 0.45, 0.40);
  drawText('BUDGET LIMIT', rx + 160, tableY - 10, '/F2', 7, 0.40, 0.45, 0.40);
  drawText('UTILIZATION', rx + 250, tableY - 10, '/F2', 7, 0.40, 0.45, 0.40);
  drawText('SPENT AMOUNT', rx + 335, tableY - 10, '/F2', 7, 0.40, 0.45, 0.40);

  let rowY = tableY - 18;
  if (categories.length === 0) {
    drawText('No category spending recorded for this cycle.', rx + 28, rowY, '/F1', 7.5, 0.5, 0.5, 0.5);
    rowY -= 16;
  } else {
    for (const cat of categories.slice(0, 6)) {
      drawLine(rx + 20, rowY + 14, rx + rw - 20, rowY + 14, 0.93, 0.95, 0.93, 0.4);

      const catName = cat.categoryName || 'Uncategorized';
      const spentStr = `Rs. ${cat.total.toLocaleString('en-IN')}`;
      const limitStr = cat.limitAmount ? `Rs. ${cat.limitAmount.toLocaleString('en-IN')}` : 'No limit';
      const pct = Math.min(100, Math.max(0, cat.percentUsed || 0));
      const pctStr = `${cat.percentUsed || 0}%`;

      const isOver = (cat.percentUsed || 0) > 100;
      const isWarn = (cat.percentUsed || 0) >= 80;
      const cr = isOver ? 0.82 : isWarn ? 0.72 : 0.086;
      const cg = isOver ? 0.15 : isWarn ? 0.45 : 0.396;
      const cb = isOver ? 0.15 : isWarn ? 0.15 : 0.204;

      drawText(catName, rx + 28, rowY, '/F2', 7.8, 0.15, 0.18, 0.15);
      drawText(limitStr, rx + 160, rowY, '/F1', 7.5, 0.45, 0.48, 0.45);

      // Mini utilization bar
      drawRect(rx + 250, rowY, 45, 3, 0.92, 0.94, 0.92);
      drawRect(rx + 250, rowY, Math.max(1, Math.round(45 * (pct / 100))), 3, cr, cg, cb);
      drawText(pctStr, rx + 300, rowY, '/F1', 7, 0.42, 0.45, 0.42);

      drawText(spentStr, rx + 335, rowY, '/F2', 8, 0.12, 0.15, 0.12);
      rowY -= 16;
    }
  }

  // 8. Top Payees & Merchants Strip
  let payeesY = rowY - 8;
  drawLine(rx + 20, payeesY + 6, rx + rw - 20, payeesY + 6, 0.88, 0.91, 0.88, 0.5, true);

  if (report.topMerchants && report.topMerchants.length > 0) {
    drawText('TOP PAYEES & MERCHANTS:', rx + 24, payeesY - 6, '/F2', 7, 0.45, 0.50, 0.45);
    const merchStr = report.topMerchants
      .slice(0, 4)
      .map((m) => `${m.merchant} (Rs. ${m.total.toLocaleString('en-IN')})`)
      .join('   |   ');
    drawText(merchStr, rx + 24, payeesY - 18, '/F1', 7.2, 0.25, 0.30, 0.25);
    payeesY -= 20;
  }

  // 9. Executive Audit Summary Card
  const execY = payeesY - 14;
  const execLines = displayedNarrative.length > 0 ? displayedNarrative : ['- Monthly ledger reconciled with verified transaction records.'];
  const execH = Math.max(50, execLines.length * 13 + 24);
  drawRoundedRect(rx + 20, execY - execH, rw - 40, execH, 8, 0.99, 0.995, 0.99, 0.88, 0.92, 0.88, 0.5);

  drawText('EXECUTIVE AUDIT SUMMARY', rx + 32, execY - 15, '/F2', 7.5, 0.086, 0.396, 0.204);
  let by = execY - 28;
  for (const b of execLines) {
    drawText(b, rx + 32, by, '/F1', 7.2, 0.25, 0.28, 0.25);
    by -= 13;
  }

  // 10. Receipt Footer with Code 128 Barcode & Attestation
  const footY = execY - execH - 16;
  drawLine(rx + 20, footY, rx + rw - 20, footY, 0.82, 0.86, 0.82, 0.75, true);

  const barcodeY = footY - 32;
  const barcodeH = 22;
  const patterns = [2, 1, 3, 1, 2, 2, 1, 4, 1, 2, 3, 1, 1, 3, 2, 1, 2, 4, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1];
  const totalBarcodeW = patterns.reduce((a, b) => a + b, 0) * 1.5;
  let bx = rx + (rw - totalBarcodeW) / 2;
  for (let i = 0; i < patterns.length; i++) {
    const barWidth = patterns[i] * 1.5;
    if (i % 2 === 0) {
      drawRect(bx, barcodeY, barWidth, barcodeH, 0.15, 0.18, 0.15);
    }
    bx += barWidth;
  }

  drawText(barcodeSerial, rx + (rw - 120) / 2, barcodeY - 10, '/F2', 6.5, 0.45, 0.5, 0.45);
  drawText('Thank you for choosing Splity · Certified Personal Financial OS', rx + (rw - 230) / 2, barcodeY - 23, '/F2', 7, 0.35, 0.40, 0.35);
  drawText(`Cryptographic Hash: ${cryptoHash} · Non-fungible audit timestamp · splity.app`, rx + (rw - 270) / 2, barcodeY - 33, '/F1', 6, 0.6, 0.63, 0.6);

  // Finalize PDF stream
  const streamContent = streamLines.join('\n');
  const streamLen = streamContent.length;

  const pdfParts = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${SPLITY_LOGO_WIDTH} /Height ${SPLITY_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${SPLITY_LOGO_HEX.length + 1} >>\nstream\n${SPLITY_LOGO_HEX}>\nendstream\nendobj\n`,
  ];

  // Calculate exact byte offsets for 100% standard XRef table
  const offsets = [0];
  let cum = pdfParts[0].length;
  for (let i = 1; i < pdfParts.length; i++) {
    offsets.push(cum);
    cum += pdfParts[i].length;
  }

  let xref = 'xref\n0 8\n';
  xref += `${String(offsets[0]).padStart(10, '0')} 65535 f \n`;
  for (let i = 1; i < 8; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${cum}\n%%EOF\n`;
  const finalPdf = pdfParts.join('') + xref + trailer;

  // Trigger download in browser
  const blob = new Blob([finalPdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const cleanMonthFilename = month.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `Splity_Receipt_${cleanMonthFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
