import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  SNSClient,
  PublishCommand,
  CreateTopicCommand,
  SubscribeCommand
} from '@aws-sdk/client-sns';

const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'splity_records';
const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET || 'splity-receipts-559169201994-ap-southeast-2';

export interface AwsStatus {
  dynamoDbConnected: boolean;
  s3Connected: boolean;
  region: string;
  tableName: string;
  bucketName: string;
  isQuarantined: boolean;
  lastError?: string;
}

let awsStatus: AwsStatus = {
  dynamoDbConnected: false,
  s3Connected: false,
  region: AWS_REGION,
  tableName: DYNAMODB_TABLE_NAME,
  bucketName: S3_BUCKET_NAME,
  isQuarantined: false,
};

let ddbDocClient: DynamoDBDocumentClient | null = null;
let s3Client: S3Client | null = null;
let ddbRawClient: DynamoDBClient | null = null;
let snsClient: SNSClient | null = null;

export function initAwsClients(): { ddbDocClient: DynamoDBDocumentClient | null; s3Client: S3Client | null; snsClient: SNSClient | null } {
  try {
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const creds =
      !isLambda && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: AWS_ACCESS_KEY_ID.trim(),
            secretAccessKey: AWS_SECRET_ACCESS_KEY.trim(),
            ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN.trim() } : {}),
          }
        : undefined;

    ddbRawClient = new DynamoDBClient({
      region: AWS_REGION,
      credentials: creds,
    });

    ddbDocClient = DynamoDBDocumentClient.from(ddbRawClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
    });

    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: creds,
    });

    snsClient = new SNSClient({
      region: AWS_REGION,
      credentials: creds,
    });

    return { ddbDocClient, s3Client, snsClient };
  } catch (err: any) {
    console.error('[AWS] Error initializing AWS clients:', err.message);
    awsStatus.lastError = err.message;
    return { ddbDocClient: null, s3Client: null, snsClient: null };
  }
}

// Check and ensure DynamoDB Table exists
export async function ensureDynamoTable(): Promise<boolean> {
  if (!ddbRawClient) {
    initAwsClients();
  }
  if (!ddbRawClient) return false;

  try {
    await ddbRawClient.send(new DescribeTableCommand({ TableName: DYNAMODB_TABLE_NAME }));
    awsStatus.dynamoDbConnected = true;
    console.log(`[AWS DynamoDB] Table "${DYNAMODB_TABLE_NAME}" verified and ready.`);
    return true;
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      try {
        console.log(`[AWS DynamoDB] Table "${DYNAMODB_TABLE_NAME}" does not exist, creating...`);
        await ddbRawClient.send(
          new CreateTableCommand({
            TableName: DYNAMODB_TABLE_NAME,
            AttributeDefinitions: [
              { AttributeName: 'pk', AttributeType: 'S' },
              { AttributeName: 'sk', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'pk', KeyType: 'HASH' },
              { AttributeName: 'sk', KeyType: 'RANGE' },
            ],
            BillingMode: 'PAY_PER_REQUEST',
          })
        );
        awsStatus.dynamoDbConnected = true;
        console.log(`[AWS DynamoDB] Table "${DYNAMODB_TABLE_NAME}" created successfully.`);
        return true;
      } catch (createErr: any) {
        checkQuarantine(createErr);
        console.error(`[AWS DynamoDB] Failed to create table:`, createErr.message);
        return false;
      }
    } else {
      checkQuarantine(err);
      console.warn(`[AWS DynamoDB] Table check warning:`, err.message);
      return false;
    }
  }
}

// Check if credentials are quarantined or restricted by AWS
function checkQuarantine(err: any) {
  if (!err) return;
  const msg = err.message || '';
  if (msg.includes('AWSCompromisedKeyQuarantine') || msg.includes('service control policy') || err.name === 'AccessDeniedException') {
    awsStatus.isQuarantined = true;
    awsStatus.lastError = msg;
  }
}

export function getAwsStatus(): AwsStatus {
  return { ...awsStatus };
}

const DEDICATED_TABLES: Record<string, string> = {
  friends: 'Splity_Friends',
  transactions: 'Splity_Transactions',
  categories: 'Splity_Categories',
  friendDebts: 'Splity_Debts',
  friendGroups: 'Splity_FriendGroups',
  monthlyBudgets: 'Splity_Budgets',
  categoryBudgets: 'Splity_Budgets',
  notifications: 'Splity_Notifications',
  users: 'Splity_Users',
};

/**
 * Save an item to DynamoDB (writes to both dedicated Splity_* table and splity_records)
 */
export async function putDynamoItem(collection: string, item: any): Promise<boolean> {
  if (!ddbDocClient) {
    initAwsClients();
  }
  if (!ddbDocClient) return false;

  const id =
    collection === 'users' && item.email
      ? String(item.email).trim().toLowerCase()
      : item.id || item.userId || item.email || String(Date.now());

  // Resolve user email to ensure primary key (userId) in dedicated tables is always the email
  let resolvedUserId = item.userId;
  if (!resolvedUserId || resolvedUserId === 'demo-user-123') {
    resolvedUserId = 'demo@splity.app';
  } else if (resolvedUserId === 'user-anshahlawat-me-9051') {
    resolvedUserId = 'anshahlawat.me@gmail.com';
  } else if (item.email && (!resolvedUserId || !resolvedUserId.includes('@'))) {
    resolvedUserId = String(item.email).trim().toLowerCase();
  }

  const ddbItem = {
    ...item,
    ...(resolvedUserId ? { userId: resolvedUserId } : {}),
    pk: collection,
    sk: String(id),
    updatedAt: new Date().toISOString(),
  };

  let success = false;

  // 1. Write to monolithic splity_records (pk is collection/category name, sk is id)
  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Item: ddbItem,
      })
    );
    success = true;
    awsStatus.dynamoDbConnected = true;
  } catch (err: any) {
    checkQuarantine(err);
    console.warn(`[AWS DynamoDB] put ${DYNAMODB_TABLE_NAME} failed: ${err.message}`);
  }

  // 2. Also write to dedicated Splity_* table so it shows immediately in the DynamoDB console
  const dedicatedTable = DEDICATED_TABLES[collection];
  if (dedicatedTable) {
    try {
      const dedicatedItem = { ...item };
      if (dedicatedTable === 'Splity_Users') {
        dedicatedItem.id = item.email ? String(item.email).trim().toLowerCase() : String(id);
      } else {
        dedicatedItem.userId = resolvedUserId || item.userId || 'demo@splity.app';
        dedicatedItem.id = String(id);
      }
      await ddbDocClient.send(
        new PutCommand({
          TableName: dedicatedTable,
          Item: dedicatedItem,
        })
      );
      success = true;
    } catch (err: any) {
      console.warn(`[AWS DynamoDB] put ${dedicatedTable} failed: ${err.message}`);
    }
  }

  return success;
}

/**
 * Delete an item from DynamoDB (both dedicated Splity_* table and splity_records)
 */
export async function deleteDynamoItem(collection: string, id: string, userId = 'demo@splity.app'): Promise<boolean> {
  if (!ddbDocClient) {
    initAwsClients();
  }
  if (!ddbDocClient) return false;

  let resolvedUserId = userId;
  if (!resolvedUserId || resolvedUserId === 'demo-user-123') {
    resolvedUserId = 'demo@splity.app';
  } else if (resolvedUserId === 'user-anshahlawat-me-9051') {
    resolvedUserId = 'anshahlawat.me@gmail.com';
  }

  let success = false;

  // 1. Delete from splity_records
  try {
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Key: {
          pk: collection,
          sk: String(id),
        },
      })
    );
    success = true;
  } catch (err: any) {
    checkQuarantine(err);
    console.warn(`[AWS DynamoDB] delete ${DYNAMODB_TABLE_NAME} failed: ${err.message}`);
  }

  // 2. Also delete from dedicated Splity_* table
  const dedicatedTable = DEDICATED_TABLES[collection];
  if (dedicatedTable) {
    try {
      const key: Record<string, any> =
        dedicatedTable === 'Splity_Users' ? { id: String(id) } : { userId: resolvedUserId, id: String(id) };
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: dedicatedTable,
          Key: key,
        })
      );
      success = true;
    } catch (err: any) {
      console.warn(`[AWS DynamoDB] delete ${dedicatedTable} failed: ${err.message}`);
    }
  }

  return success;
}

/**
 * Load all items from DynamoDB table
 */
export async function loadAllFromDynamoDb(): Promise<Record<string, any[]> | null> {
  if (!ddbDocClient) {
    initAwsClients();
  }
  if (!ddbDocClient) return null;

  try {
    const result: Record<string, any[]> = {};
    let lastEvaluatedKey: any = undefined;

    do {
      const response = await ddbDocClient.send(
        new ScanCommand({
          TableName: DYNAMODB_TABLE_NAME,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      const items = response.Items || [];
      for (const item of items) {
        const coll = item.pk;
        if (!coll) continue;
        if (!result[coll]) result[coll] = [];
        const { pk, sk, updatedAt, ...rest } = item;
        result[coll].push(rest);
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    awsStatus.dynamoDbConnected = true;
    return result;
  } catch (err: any) {
    checkQuarantine(err);
    console.warn(`[AWS DynamoDB] loadAllFromDynamoDb failed: ${err.message}`);
    return null;
  }
}

/**
 * Upload an analytics report or PDF receipt to AWS S3.
 * Gracefully creates local backup in public/reports/ if S3 encounters AWS policy/quarantine errors.
 */
export async function uploadReportToS3(params: {
  key: string;
  content: Buffer | string;
  contentType: string;
  reportId: string;
}): Promise<{ s3Url: string; s3Key: string; localFallbackUrl: string; uploadedToS3: boolean }> {
  const { key, content, contentType, reportId } = params;

  // Save local copy in /tmp on Lambda or public/reports on local server
  let localFallbackUrl = `/reports/${path.basename(key)}`;
  try {
    const baseDir = process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp/reports' : path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const safeFilename = path.basename(key);
    fs.writeFileSync(path.join(baseDir, safeFilename), content);
    localFallbackUrl = `/reports/${safeFilename}`;
  } catch (_) {}

  let s3Uploaded = false;
  let s3Url = localFallbackUrl;

  if (!s3Client) {
    initAwsClients();
  }

  if (s3Client) {
    try {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      s3Uploaded = true;
      awsStatus.s3Connected = true;
      s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
      console.log(`[AWS S3] Successfully uploaded report to S3: ${s3Url}`);
    } catch (err: any) {
      checkQuarantine(err);
      console.warn(`[AWS S3] Upload to S3 failed: ${err.message}. Relying on persistent local fallback: ${localFallbackUrl}`);
    }
  }

  return {
    s3Url: s3Uploaded ? s3Url : localFallbackUrl,
    s3Key: key,
    localFallbackUrl,
    uploadedToS3: s3Uploaded,
  };
}

/**
 * Generate a secure, 7-day presigned direct download URL for an S3 object (no login/credentials needed).
 */
export async function getPresignedDownloadUrl(key: string, filename?: string): Promise<string | null> {
  if (!s3Client) {
    initAwsClients();
  }
  if (!s3Client) return null;
  try {
    const cmd = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    });
    const url = await getSignedUrl(s3Client, cmd, { expiresIn: 7 * 24 * 3600 });
    return url;
  } catch (err: any) {
    console.warn('[AWS S3] Presign failed:', err.message);
    return null;
  }
}

/**
 * Send verified PDF receipt and executive analytics breakdown to customer email via AWS SNS (Free Tier).
 */
export async function sendReceiptViaSns(params: {
  email: string;
  month: string;
  summary: { totalIncome: number; totalExpense: number; netSaved: number; savingsRate: number };
  narrative?: string;
  downloadUrl?: string;
  s3Url?: string;
  reportId?: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const { email, month, summary, narrative, downloadUrl, reportId } = params;

  if (!snsClient) {
    initAwsClients();
  }

  // Format Month e.g. "October 2026"
  let billingPeriod = month;
  try {
    const [y, m] = month.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    billingPeriod = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {}

  const statementDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pdfUrl =
    downloadUrl && downloadUrl.startsWith('http')
      ? downloadUrl
      : `https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com${downloadUrl || (reportId ? `/api/reports/${reportId}/download` : '/api/reports/latest')}`;

  const cleanNarrative = (narrative || 'Monthly audit synthesis generated successfully.')
    .replace(/^[\*\-•]\s*/gm, '')
    .trim();

  const subject = `[Splity] Monthly Financial Statement - ${billingPeriod}`;
  const messageBody = `
SPLITY
Monthly Financial Statement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATEMENT DETAILS

Billing Period : ${billingPeriod}
Statement Date : ${statementDate}
Prepared For   : ${email}

────────────────────────────────────

FINANCIAL OVERVIEW

Total Income       : ₹${summary.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Total Expenses     : ₹${summary.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Net Savings        : ₹${summary.netSaved.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Savings Rate       : ${summary.savingsRate > 0 ? `${summary.savingsRate}%` : 'N/A'}

────────────────────────────────────

MONTHLY FINANCIAL INSIGHTS

${cleanNarrative}

────────────────────────────────────

REPORT DOCUMENT

Your monthly financial statement PDF is available below.

Report Format : Verified PDF Document
Download Link :
${pdfUrl}

────────────────────────────────────

ABOUT THIS STATEMENT

This automated financial summary was generated
by Splity using the transaction data available
for the reporting period.

(c) 2026 Splity. All rights reserved.

Automated notification delivered via AWS SNS.
Please do not reply directly to this email.
`.trim();

  if (snsClient) {
    try {
      // 1. Ensure receipt notification topic exists
      const topicRes = await snsClient.send(new CreateTopicCommand({ Name: 'SplityMonthlyReceipts' }));
      const topicArn = topicRes.TopicArn;

      if (topicArn) {
        // 2. Subscribe user's email endpoint if not already subscribed
        try {
          await snsClient.send(new SubscribeCommand({
            TopicArn: topicArn,
            Protocol: 'email',
            Endpoint: email,
          }));
        } catch (_) {}

        // 3. Publish receipt message directly to topic
        const publishRes = await snsClient.send(new PublishCommand({
          TopicArn: topicArn,
          Subject: subject.slice(0, 100),
          Message: messageBody,
        }));

        console.log(`[AWS SNS] Successfully published receipt email via SNS to ${email}, MessageId: ${publishRes.MessageId}`);
        return { sent: true, messageId: publishRes.MessageId };
      }
    } catch (err: any) {
      checkQuarantine(err);
      console.warn(`[AWS SNS] Publish via SNS notice (${err.message}). Logging simulated email notification.`);
      return { sent: false, error: err.message };
    }
  }

  return { sent: false, error: 'SNS Client not initialized' };
}

// Initialize on module load
initAwsClients();
