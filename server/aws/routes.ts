import { Router } from 'express';
import { requireUser, AuthRequest } from '../middleware/requireUser.js';
import { AWS_CONFIG } from './config.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl } from './s3.js';
import { signUpWithCognito, confirmCognitoUser, loginWithCognito } from './cognito.js';
import { dynamoDbRepo, ensureDynamoTablesExist } from './dynamoDb.js';

export const awsRouter = Router();

// AWS Infrastructure status
awsRouter.get('/status', async (req, res) => {
  res.json({
    status: 'online',
    cloudProvider: 'Amazon Web Services (AWS)',
    freeTierCompliance: '100% Free Tier Eligible',
    region: AWS_CONFIG.region,
    services: {
      compute: {
        type: 'AWS Lambda (Node.js 20.x)',
        freeTier: '1,000,000 requests/month + 3.2M seconds execution',
      },
      apiGateway: {
        type: 'Amazon API Gateway (HTTP API v2)',
        freeTier: '1,000,000 requests/month',
      },
      database: {
        type: 'Amazon DynamoDB (NoSQL)',
        freeTier: '25 GB Storage (Always Free) + 25 RCU/WCU',
        tables: Object.values(AWS_CONFIG.dynamoDb),
      },
      storage: {
        type: 'Amazon Simple Storage Service (S3)',
        freeTier: '5 GB Standard Storage + 20,000 GET requests',
        bucket: AWS_CONFIG.s3.bucketName,
      },
      auth: {
        type: 'Amazon Cognito User Pools',
        freeTier: '50,000 Monthly Active Users (Always Free)',
        configured: Boolean(AWS_CONFIG.cognito.clientId),
      },
      hosting: {
        type: 'AWS Amplify Hosting / S3 + CloudFront CDN',
        freeTier: '1,000 build minutes + 15 GB served / 1 TB CloudFront transfer',
      },
    },
  });
});

// S3 Pre-signed URL for direct browser-to-S3 receipt upload
awsRouter.post('/receipt-upload-url', requireUser, async (req: AuthRequest, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'fileName and contentType are required' });
    }
    const result = await getPresignedUploadUrl(req.user!.id, fileName, contentType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate S3 pre-signed URL' });
  }
});

// Cognito Sign-Up
awsRouter.post('/cognito/signup', async (req, res) => {
  try {
    const { email, password, phone, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await signUpWithCognito(email, password, phone, name);
    res.json({ success: true, userSub: result.UserSub, isConfirmed: result.UserConfirmed });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Cognito signup failed' });
  }
});

// Cognito Confirm Sign-Up
awsRouter.post('/cognito/confirm', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and confirmation code required' });
    }
    await confirmCognitoUser(email, code);
    res.json({ success: true, message: 'User confirmed successfully in AWS Cognito' });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Cognito verification failed' });
  }
});

// Cognito Log-in
awsRouter.post('/cognito/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const tokens = await loginWithCognito(email, password);
    res.json(tokens);
  } catch (err: any) {
    res.status(err.status || 401).json({ error: err.message || 'Cognito login failed' });
  }
});

// DynamoDB Table Init Trigger
awsRouter.post('/dynamodb/init', async (req, res) => {
  try {
    await ensureDynamoTablesExist();
    res.json({ success: true, message: 'DynamoDB tables verified/created on AWS' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize DynamoDB tables' });
  }
});
