#!/usr/bin/env bash
set -e

# ==============================================================================
# Splity AWS Free Tier Automated Deployment Script
# Deploys:
#   1. AWS Lambda + API Gateway (Serverless Node.js Express API)
#   2. Amazon DynamoDB (NoSQL Data Store - Free Tier)
#   3. Amazon S3 (Receipts & Static Frontend Hosting)
#   4. Amazon Cognito (User Authentication - Free Tier)
#   5. Amazon CloudFront (Global CDN Distribution)
# ==============================================================================

echo "=========================================================="
echo "   🚀 Starting Splity AWS Free Tier Serverless Deployment "
echo "=========================================================="

# 1. Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed. Please install it with:"
    echo "   curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg' && sudo installer -pkg AWSCLIV2.pkg -target /"
    exit 1
fi

echo "🔍 Verifying AWS Account and Credentials..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
AWS_REGION=${AWS_REGION:-$(aws configure get region || echo "us-east-1")}

echo "✅ Connected to AWS Account: $AWS_ACCOUNT_ID in region: $AWS_REGION"

# 2. Build Frontend & Serverless Lambda bundle
echo "📦 Building React frontend and Lambda backend..."
npm run build
npm run build:lambda

# 3. Create DynamoDB Tables (Free Tier: 25GB Storage, PAY_PER_REQUEST or 1 RCU/WCU)
echo "🗄️ Setting up Amazon DynamoDB Tables..."
for TABLE in Splity_Users Splity_Transactions Splity_Categories Splity_Budgets Splity_Friends Splity_Debts; do
  if ! aws dynamodb describe-table --table-name "$TABLE" --region "$AWS_REGION" &>/dev/null; then
    echo "  Creating table: $TABLE..."
    if [ "$TABLE" == "Splity_Users" ]; then
      aws dynamodb create-table \
        --table-name "$TABLE" \
        --attribute-definitions AttributeName=id,AttributeType=S AttributeName=email,AttributeType=S \
        --key-schema AttributeName=id,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --global-secondary-indexes "IndexName=EmailIndex,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL}" \
        --region "$AWS_REGION"
    else
      aws dynamodb create-table \
        --table-name "$TABLE" \
        --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=id,AttributeType=S \
        --key-schema AttributeName=userId,KeyType=HASH AttributeName=id,KeyType=RANGE \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION"
    fi
  else
    echo "  Table $TABLE already exists."
  fi
done

# 4. Create S3 Storage Bucket
RECEIPTS_BUCKET="splity-receipts-${AWS_ACCOUNT_ID}-${AWS_REGION}"
echo "🪣 Verifying Amazon S3 Receipts Bucket: $RECEIPTS_BUCKET..."
if ! aws s3api head-bucket --bucket "$RECEIPTS_BUCKET" 2>/dev/null; then
  echo "  Creating S3 Bucket: $RECEIPTS_BUCKET..."
  if [ "$AWS_REGION" == "us-east-1" ]; then
    aws s3api create-bucket --bucket "$RECEIPTS_BUCKET" --region "$AWS_REGION"
  else
    aws s3api create-bucket --bucket "$RECEIPTS_BUCKET" --region "$AWS_REGION" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi
fi

# 5. Deploy SAM Stack (if AWS SAM CLI is installed)
if command -v sam &> /dev/null; then
  echo "⚡ Deploying Serverless Stack via AWS SAM..."
  sam build
  sam deploy --stack-name splity-serverless-stack \
    --resolve-s3 \
    --capabilities CAPABILITY_IAM \
    --region "$AWS_REGION" \
    --no-fail-on-empty-changeset
else
  echo "ℹ️ AWS SAM CLI not detected. You can install it with 'brew install aws-sam-cli' to auto-deploy Lambda & CloudFront."
fi

echo "=========================================================="
echo "   🎉 Splity AWS Cloud Infrastructure Ready!"
echo "=========================================================="
