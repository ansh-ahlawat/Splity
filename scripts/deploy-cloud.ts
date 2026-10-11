import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
} from '@aws-sdk/client-iam';
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  AddPermissionCommand,
} from '@aws-sdk/client-lambda';
import {
  ApiGatewayV2Client,
  GetApisCommand,
  CreateApiCommand,
  CreateStageCommand,
  GetStagesCommand,
} from '@aws-sdk/client-apigatewayv2';
import { AWS_CONFIG } from '../server/aws/config.js';

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const region = AWS_CONFIG.region || 'ap-southeast-2';

const iam = new IAMClient({ region, credentials });
const lambda = new LambdaClient({ region, credentials });
const apigw = new ApiGatewayV2Client({ region, credentials });

const ROLE_NAME = 'SplityLambdaExecutionRole';
const FUNCTION_NAME = 'SplityApiFunction';
const API_NAME = 'SplityHttpApi';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrCreateIamRole(): Promise<string> {
  console.log(`[IAM] Checking role: ${ROLE_NAME}...`);
  try {
    const res = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
    console.log(`  ✓ Found existing IAM Role: ${res.Role?.Arn}`);
    return res.Role!.Arn!;
  } catch (err: any) {
    if (err.name === 'NoSuchEntityException' || err.name === 'NoSuchEntity') {
      console.log(`  Creating IAM Role: ${ROLE_NAME}...`);
      const trustPolicy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      });

      const createRes = await iam.send(
        new CreateRoleCommand({
          RoleName: ROLE_NAME,
          AssumeRolePolicyDocument: trustPolicy,
          Description: 'Splity Serverless API Lambda Execution Role (Free Tier)',
        })
      );
      const roleArn = createRes.Role!.Arn!;

      console.log('  Attaching AWSLambdaBasicExecutionRole...');
      await iam.send(
        new AttachRolePolicyCommand({
          RoleName: ROLE_NAME,
          PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        })
      );

      console.log('  Attaching DynamoDB & S3 policy...');
      const inlinePolicy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['dynamodb:*'],
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: ['s3:*'],
            Resource: '*',
          },
        ],
      });

      await iam.send(
        new PutRolePolicyCommand({
          RoleName: ROLE_NAME,
          PolicyName: 'SplityDynamoAccess',
          PolicyDocument: inlinePolicy,
        })
      );

      console.log('  Waiting 10s for IAM role replication across AWS...');
      await sleep(10000);
      return roleArn;
    }
    throw err;
  }
}

async function deployLambda(roleArn: string): Promise<string> {
  const zipPath = path.join(process.cwd(), 'dist', 'lambda.zip');
  if (!fs.existsSync(zipPath)) {
    console.log('Building Lambda zip bundle...');
    execSync('zip -j dist/lambda.zip dist/lambda.cjs', { stdio: 'inherit' });
  }

  const zipBuffer = fs.readFileSync(zipPath);
  console.log(`[Lambda] Deploying ${FUNCTION_NAME} (${(zipBuffer.length / 1024).toFixed(1)} KB)...`);

  let functionArn = '';
  try {
    const existing = await lambda.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    functionArn = existing.Configuration!.FunctionArn!;
    console.log(`  Updating code for existing function...`);
    await lambda.send(
      new UpdateFunctionCodeCommand({
        FunctionName: FUNCTION_NAME,
        ZipFile: zipBuffer,
        Architectures: ['arm64'],
      })
    );

    await sleep(2000);

    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: FUNCTION_NAME,
        Environment: {
          Variables: {
            NODE_ENV: 'production',
            USE_DYNAMODB: 'true',
            AWS_REGION: region,
            JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'splity_prod_jwt_access_secret_key_123',
            JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'splity_prod_jwt_refresh_secret_key_456',
            GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
          },
        },
        MemorySize: 256,
        Timeout: 15,
      })
    );
    console.log(`  ✓ Updated function code and configuration.`);
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`  Creating new Lambda function: ${FUNCTION_NAME}...`);
      let retries = 10;
      while (retries > 0) {
        try {
          const createRes = await lambda.send(
            new CreateFunctionCommand({
              FunctionName: FUNCTION_NAME,
              Runtime: 'nodejs20.x',
              Role: roleArn,
              Handler: 'lambda.handler',
              Code: { ZipFile: zipBuffer },
              Description: 'Splity Serverless API Backend (Node.js 20 on ARM64)',
              Timeout: 15,
              MemorySize: 256,
              Architectures: ['arm64'],
              Environment: {
                Variables: {
                  NODE_ENV: 'production',
                  USE_DYNAMODB: 'true',
                  AWS_REGION: region,
                  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'splity_prod_jwt_access_secret_key_123',
                  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'splity_prod_jwt_refresh_secret_key_456',
                  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
                },
              },
            })
          );
          functionArn = createRes.FunctionArn!;
          console.log(`  ✓ Lambda function created: ${functionArn}`);
          break;
        } catch (roleErr: any) {
          if (roleErr.message?.includes('cannot be assumed by Lambda') || roleErr.name === 'InvalidParameterValueException') {
            console.log('  Waiting 5s for IAM role activation...');
            await sleep(5000);
            retries--;
          } else if (roleErr.name === 'ResourceConflictException') {
            console.log('  Function already exists, fetching ARN...');
            const f = await lambda.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
            functionArn = f.Configuration!.FunctionArn!;
            break;
          } else {
            throw roleErr;
          }
        }
      }
    } else {
      throw err;
    }
  }

  return functionArn;
}

async function setupApiGateway(functionArn: string): Promise<string> {
  console.log(`[API Gateway] Setting up HTTP API: ${API_NAME}...`);
  const apis = await apigw.send(new GetApisCommand({}));
  const existingApi = apis.Items?.find((a) => a.Name === API_NAME);

  let apiId = '';
  let endpoint = '';

  if (existingApi) {
    apiId = existingApi.ApiId!;
    endpoint = existingApi.ApiEndpoint!;
    console.log(`  ✓ Found existing HTTP API: ${endpoint}`);
  } else {
    console.log(`  Creating HTTP API (v2) with direct Lambda target...`);
    const createRes = await apigw.send(
      new CreateApiCommand({
        Name: API_NAME,
        ProtocolType: 'HTTP',
        Target: functionArn,
        CorsConfiguration: {
          AllowOrigins: ['*'],
          AllowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          AllowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
          MaxAge: 3600,
        },
      })
    );
    apiId = createRes.ApiId!;
    endpoint = createRes.ApiEndpoint!;
    console.log(`  ✓ Created HTTP API Gateway: ${endpoint}`);

    // Grant API Gateway permission to invoke Lambda
    try {
      console.log('  Granting API Gateway permission to invoke Lambda...');
      await lambda.send(
        new AddPermissionCommand({
          FunctionName: FUNCTION_NAME,
          StatementId: `apigateway-invoke-${Date.now()}`,
          Action: 'lambda:InvokeFunction',
          Principal: 'apigateway.amazonaws.com',
          SourceArn: `arn:aws:execute-api:${region}:*:${apiId}/*`,
        })
      );
      console.log('  ✓ Permission granted.');
    } catch (permErr: any) {
      console.warn('  Notice adding permission:', permErr.message);
    }
  }

  return endpoint;
}

async function main() {
  console.log('==========================================================');
  console.log('🚀 Splity Serverless Cloud Deployment (AWS Free Tier)');
  console.log(`Region: ${region}`);
  console.log('==========================================================');

  // Step 1: IAM Role
  const roleArn = await getOrCreateIamRole();

  // Step 2: Lambda
  const functionArn = await deployLambda(roleArn);

  // Step 3: API Gateway
  const endpoint = await setupApiGateway(functionArn);

  console.log('\n==========================================================');
  console.log('🎉 SPLITY BACKEND IS LIVE ON AWS!');
  console.log(`Live API Base URL: ${endpoint}`);
  console.log('==========================================================');

  // Verify health check
  console.log('\nTesting live API Gateway health endpoint...');
  await sleep(2000);
  try {
    const res = await fetch(`${endpoint}/api/health`);
    const data = await res.json();
    console.log('✓ Health check response from AWS Lambda:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.log(`Endpoint is booting up (${err.message}). Ready in ~10 seconds!`);
  }
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
