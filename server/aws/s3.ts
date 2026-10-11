import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_CONFIG } from './config.js';
import 'dotenv/config';

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

export const s3Client = new S3Client({
  region: AWS_CONFIG.region,
  credentials,
});

/**
 * Ensure S3 bucket exists for Splity receipt and export storage.
 */
export async function ensureS3BucketExists() {
  const bucketName = AWS_CONFIG.s3.bucketName;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[S3] Bucket ${bucketName} exists and is accessible.`);
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Creating S3 Bucket ${bucketName}...`);
      try {
        await s3Client.send(
          new CreateBucketCommand({
            Bucket: bucketName,
            CreateBucketConfiguration:
              AWS_CONFIG.region === 'us-east-1'
                ? undefined
                : { LocationConstraint: AWS_CONFIG.region as any },
          })
        );
        console.log(`[S3] Bucket ${bucketName} created successfully.`);
      } catch (createErr: any) {
        console.warn(`[S3] Could not create bucket: ${createErr.message}`);
      }
    } else {
      console.warn(`[S3] HeadBucket notice: ${err.message}`);
    }
  }
}

/**
 * Upload a receipt or file buffer to Amazon S3.
 */
export async function uploadReceiptToS3(
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string = 'application/pdf'
): Promise<string> {
  const key = `receipts/${userId}/${Date.now()}-${fileName}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: AWS_CONFIG.s3.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );
  return `https://${AWS_CONFIG.s3.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`;
}

/**
 * Generate a Pre-signed URL for direct client upload (Free Tier optimal, zero compute cost).
 */
export async function getPresignedUploadUrl(
  userId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string }> {
  const key = `receipts/${userId}/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: AWS_CONFIG.s3.bucketName,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 mins
  return { uploadUrl, key };
}

/**
 * Generate a Pre-signed URL for reading a receipt/export securely from S3.
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: AWS_CONFIG.s3.bucketName,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}
