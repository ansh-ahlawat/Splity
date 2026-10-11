#!/usr/bin/env bash
set -e

# ==============================================================================
# Splity - Local Mac Setup & Build Automation
# Region: ap-southeast-2 (Sydney) - 100% AWS Free Tier
# ==============================================================================

echo "=========================================================="
echo "⚡ Starting Local Splity Build & AWS Preparation on Mac"
echo "=========================================================="

# 1. Safe Git Branch
echo -e "\n📌 [1/4] Ensuring Safe Git Migration Branch..."
git checkout -b feature/aws-serverless-migration 2>/dev/null || git checkout feature/aws-serverless-migration
echo "  ✓ On branch: feature/aws-serverless-migration"

# 2. Install Packages
echo -e "\n📦 [2/4] Installing Required AWS SDK & Serverless Dependencies..."
npm install

# 3. Build Frontend & Serverless Backend
echo -e "\n🔨 [3/4] Building React 19 Frontend & AWS Lambda Backend..."
npm run build
npm run build:lambda
echo "  ✓ Frontend built to dist/"
echo "  ✓ Serverless Lambda bundle built to dist/lambda.cjs"

# 4. Configure AWS & Seed DynamoDB Tables in Sydney (ap-southeast-2)
echo -e "\n☁️ [4/4] Connecting to AWS (Region: ap-southeast-2) & Seeding DynamoDB..."
if command -v aws &> /dev/null; then
  aws configure set aws_access_key_id "AKIAYEMIU45FDEKQHZUF"
  aws configure set aws_secret_access_key "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"
  aws configure set default.region "ap-southeast-2"
  aws configure set default.output "json"
  echo "  ✓ AWS CLI configured with admin credentials."
fi

echo "  🌱 Provisioning DynamoDB tables & migrating data to Sydney..."
npm run seed:dynamo

echo -e "\n=========================================================="
echo "🎉 Laptop tasks finished! Ready for AWS deployment."
echo "=========================================================="
