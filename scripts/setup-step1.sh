#!/usr/bin/env bash
set -e

# ==============================================================================
# Splity - Step 1: AWS IAM Roles, Policies & DynamoDB Provisioning
# Free Tier Serverless Infrastructure Setup
# ==============================================================================

echo "=========================================================="
echo "   🛡️ Splity: Executing Step 1 (IAM & DynamoDB Setup)     "
echo "=========================================================="

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI is not installed. Please install it with:"
  echo "   curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg' && sudo installer -pkg AWSCLIV2.pkg -target /"
  exit 1
fi

# Verify Identity
echo "🔍 Checking AWS Credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text 2>/dev/null || echo "")

if [ -z "$ACCOUNT_ID" ]; then
  echo "⚠️ AWS CLI is not logged in or credentials not found."
  echo "👉 Please run: 'aws configure' and enter your AWS Access Key ID & Secret Access Key."
  exit 1
fi

REGION=${AWS_REGION:-$(aws configure get region || echo "us-east-1")}
echo "✅ Authenticated with AWS Account: $ACCOUNT_ID (Region: $REGION)"

# ------------------------------------------------------------------------------
# Part A: Create IAM Role & Policy for Splity Serverless
# ------------------------------------------------------------------------------
ROLE_NAME="SplityLambdaExecutionRole"
POLICY_NAME="SplityServerlessAccessPolicy"

echo -e "\n[1/3] Setting up IAM Role: $ROLE_NAME..."

# 1. Trust policy for AWS Lambda
cat > /tmp/lambda-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

if ! aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
  echo "  Creating IAM Role: $ROLE_NAME..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
    --description "Execution role for Splity Serverless Lambda API on AWS Free Tier"
  echo "  ✓ Role created."
else
  echo "  ✓ Role $ROLE_NAME already exists."
fi

# 2. Attach AWSLambdaBasicExecutionRole
echo "  Attaching basic CloudWatch logs execution policy..."
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

# 3. Create inline/attached policy for DynamoDB & S3
cat > /tmp/splity-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DescribeTable"
      ],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/Splity_*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::splity-receipts-*/*"
    }
  ]
}
EOF

echo "  Attaching DynamoDB & S3 permissions policy..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document file:///tmp/splity-policy.json

echo "  ✓ IAM Role & Permissions ready!"

# ------------------------------------------------------------------------------
# Part B: Provision DynamoDB Tables (Free Tier: 25GB Storage, PAY_PER_REQUEST)
# ------------------------------------------------------------------------------
echo -e "\n[2/3] Provisioning Amazon DynamoDB Tables..."

for TABLE in Splity_Users Splity_Transactions Splity_Categories Splity_Budgets Splity_Friends Splity_Debts; do
  if ! aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" &>/dev/null; then
    echo "  Creating table: $TABLE..."
    if [ "$TABLE" == "Splity_Users" ]; then
      aws dynamodb create-table \
        --table-name "$TABLE" \
        --attribute-definitions AttributeName=id,AttributeType=S AttributeName=email,AttributeType=S \
        --key-schema AttributeName=id,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --global-secondary-indexes "IndexName=EmailIndex,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL}" \
        --region "$REGION"
    else
      aws dynamodb create-table \
        --table-name "$TABLE" \
        --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=id,AttributeType=S \
        --key-schema AttributeName=userId,KeyType=HASH AttributeName=id,KeyType=RANGE \
        --billing-mode PAY_PER_REQUEST \
        --region "$REGION"
    fi
    echo "  ✓ $TABLE created."
  else
    echo "  ✓ Table $TABLE already exists."
  fi
done

# ------------------------------------------------------------------------------
# Part C: Seed Data into DynamoDB
# ------------------------------------------------------------------------------
echo -e "\n[3/3] Seeding initial data into DynamoDB..."
npm run seed:dynamo

echo "=========================================================="
echo "   🎉 Step 1 Complete! IAM & DynamoDB are live on AWS!    "
echo "=========================================================="
