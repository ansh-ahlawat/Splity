import crypto from 'node:crypto';
import { db } from '../db.js';
import { generateJSON } from '../gemini.js';
import { createTransaction } from './transaction.service.js';
import { ImportJob, ImportItem, TransactionType } from '../../src/types.js';
import { createNotification } from './notification.service.js';

export async function createImportJob(
  userId: string,
  fileName: string,
  fileType: 'PDF' | 'IMAGE'
): Promise<{ importJob: ImportJob; uploadUrl: string }> {
  const jobId = crypto.randomUUID();
  const fileKey = `imports/${userId}/${jobId}-${fileName}`;

  const importJob: ImportJob = {
    id: jobId,
    userId,
    fileKey,
    fileName,
    fileType,
    status: 'PENDING',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.data.importJobs.push(importJob);
  db.save();

  // Signed URL simulation / storage upload endpoint
  const uploadUrl = `/api/imports/${jobId}/upload-file`;

  return { importJob, uploadUrl };
}

export async function processImportJob(
  userId: string,
  jobId: string,
  rawTextContent?: string,
  imageBase64?: string
): Promise<ImportJob> {
  const job = db.data.importJobs.find((j) => j.id === jobId && j.userId === userId);
  if (!job) {
    throw { status: 404, message: 'Import job not found' };
  }

  job.status = 'PROCESSING';
  job.updatedAt = new Date().toISOString();
  db.save();

  // User category names for matching
  const userCats = db.data.categories.filter((c) => c.userId === userId).map((c) => c.name);

  let extracted: any[] | null = null;

  // 1. If real image is uploaded, perform exact OCR using Gemini Vision
  if (imageBase64 && imageBase64.includes('base64')) {
    try {
      const { getGeminiClient } = await import('../gemini.js');
      const ai = getGeminiClient();
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const data = match ? match[2] : imageBase64;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data,
                },
              },
              {
                text: `You are an expert OCR financial statement and receipt analyzer.
Read this receipt/statement image with extreme accuracy.
Extract EVERY single real transaction item or receipt purchase line visible in the image.
Do not use dummy, placeholder, or default data under any circumstances. Extract only what is actually printed in the image.
Available categories: ${JSON.stringify(userCats)}.

Output valid JSON array:
[
  {
    "rawText": "exact text from receipt line",
    "date": "YYYY-MM-DD",
    "amount": 1450.00,
    "merchant": "Exact Store/Merchant name from receipt",
    "type": "EXPENSE",
    "suggestedCategory": "category name",
    "confidence": 0.95
  }
]`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const raw = response.text?.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim() || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        extracted = parsed;
      }
    } catch (ocrErr) {
      console.error('OCR Extraction error:', ocrErr);
    }
  }

  // 2. If text was pasted or OCR needs text fallback
  if ((!extracted || extracted.length === 0) && rawTextContent && rawTextContent.trim()) {
    const prompt = `
Extract transaction items from the following statement text as JSON array.
Extract the EXACT records and amounts listed in the text. Do not invent items.
Text:
"""
${rawTextContent.trim()}
"""

Available user categories: ${JSON.stringify(userCats)}.

Output JSON array:
[
  {
    "rawText": "original text line",
    "date": "YYYY-MM-DD",
    "amount": 142.50,
    "merchant": "Exact Payee",
    "type": "EXPENSE",
    "suggestedCategory": "Category",
    "confidence": 0.95
  }
]
`;
    extracted = await generateJSON<any[]>(
      prompt,
      'Extract financial line items accurately as structured JSON array.'
    );
  }

  // 3. Deterministic regex line parser if AI is unavailable but text is provided
  if ((!extracted || extracted.length === 0) && rawTextContent && rawTextContent.trim()) {
    const lines = rawTextContent.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedLines: any[] = [];

    for (const line of lines) {
      const amountMatch = line.match(/(?:₹|\$|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i) || line.match(/([\d,]+\.\d{1,2})/);
      const amountVal = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      if (amountVal > 0) {
        const isIncome = /income|credit|deposit|salary|refund/i.test(line);
        const dateMatch = line.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
        const cleanDate = dateMatch ? new Date(dateMatch[1]).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10);
        
        // Remove amount, date, and keywords to get merchant
        let merchant = line
          .replace(amountMatch[0], '')
          .replace(dateMatch ? dateMatch[0] : '', '')
          .replace(/expense|income|credit|debit|rs\.?|inr|₹|\$/gi, '')
          .trim();
        if (!merchant) merchant = 'General Payee';

        parsedLines.push({
          rawText: line,
          date: cleanDate,
          amount: amountVal,
          merchant,
          type: isIncome ? 'INCOME' : 'EXPENSE',
          suggestedCategory: userCats[0] || 'General',
          confidence: 0.9,
        });
      }
    }

    if (parsedLines.length > 0) {
      extracted = parsedLines;
    }
  }

  const items: ImportItem[] = [];

  if (Array.isArray(extracted) && extracted.length > 0) {
    for (const item of extracted) {
      const cat = db.data.categories.find(
        (c) => c.userId === userId && c.name.toLowerCase() === (item.suggestedCategory || '').toLowerCase()
      );

      const itemId = crypto.randomUUID();
      const newItem: ImportItem = {
        id: itemId,
        importJobId: jobId,
        rawText: item.rawText || '',
        date: item.date || new Date().toISOString().substring(0, 10),
        amount: Math.abs(Number(item.amount)) || 0,
        merchant: item.merchant || 'Merchant',
        type: item.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        suggestedCategoryId: cat ? cat.id : null,
        confidence: Number(item.confidence) || 0.95,
        status: 'PENDING',
      };
      db.data.importItems.push(newItem);
      items.push(newItem);
    }
  }

  job.status = 'REVIEW';
  job.items = items;
  job.updatedAt = new Date().toISOString();
  db.save();

  return job;
}

export async function getImportJob(userId: string, jobId: string): Promise<ImportJob> {
  const job = db.data.importJobs.find((j) => j.id === jobId && j.userId === userId);
  if (!job) {
    throw { status: 404, message: 'Import job not found' };
  }

  const items = db.data.importItems.filter((i) => i.importJobId === jobId);
  return { ...job, items };
}

export async function updateImportItem(
  userId: string,
  jobId: string,
  itemId: string,
  updates: Partial<ImportItem>
): Promise<ImportItem> {
  const job = db.data.importJobs.find((j) => j.id === jobId && j.userId === userId);
  if (!job) {
    throw { status: 404, message: 'Import job not found' };
  }

  const item = db.data.importItems.find((i) => i.id === itemId && i.importJobId === jobId);
  if (!item) {
    throw { status: 404, message: 'Import item not found' };
  }

  if (updates.status !== undefined) item.status = updates.status;
  if (updates.merchant !== undefined) item.merchant = updates.merchant;
  if (updates.amount !== undefined) item.amount = Number(updates.amount);
  if (updates.date !== undefined) item.date = updates.date;
  if (updates.type !== undefined) item.type = updates.type;
  if (updates.suggestedCategoryId !== undefined) item.suggestedCategoryId = updates.suggestedCategoryId;

  db.save();
  return item;
}

export async function commitImportJob(userId: string, jobId: string): Promise<{ createdCount: number }> {
  const job = db.data.importJobs.find((j) => j.id === jobId && j.userId === userId);
  if (!job) {
    throw { status: 404, message: 'Import job not found' };
  }

  const items = db.data.importItems.filter((i) => i.importJobId === jobId && i.status === 'ACCEPTED');

  let createdCount = 0;
  for (const item of items) {
    await createTransaction(userId, {
      type: item.type || 'EXPENSE',
      amount: item.amount || 0,
      categoryId: item.suggestedCategoryId,
      merchant: item.merchant,
      note: `Imported from ${job.fileName}`,
      date: item.date || new Date().toISOString().substring(0, 10),
      source: 'IMPORT',
    });
    createdCount++;
  }

  job.status = 'COMMITTED';
  job.updatedAt = new Date().toISOString();
  db.save();

  createNotification(userId, {
    type: 'IMPORT_READY',
    category: 'Reports',
    message: `Statement imported: Successfully committed ${createdCount} records from ${job.fileName}.`,
  });

  return { createdCount };
}
