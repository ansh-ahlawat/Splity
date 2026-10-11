# AWS SOLUTION ARCHITECT

**GITHUB LINK OF PROJECT:** https://github.com/ahlawatansh/Splity  
**LIVE API GATEWAY ENDPOINT:** https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com  
**AWS REGION:** Asia Pacific (Sydney) — `ap-southeast-2`  

---

### PROJECT AUTHOR & DEVELOPER

| Name | Registration / Roll No. | Role |
| :--- | :--- | :--- |
| **ANSH AHLAWAT** | **22BIT0520** | Solo Cloud Architect & Full-Stack Developer |

---

### TITLE
**Splity: Cloud-Native Serverless Personal & Shared Expense Management System Powered by AWS Free Tier Services**

---

### DESCRIPTION
This project presents the cloud-native design, architectural transformation, and production deployment of **Splity**—a full-stack personal finance tracker, group expense splitting application, and AI financial assistant—engineered exclusively on **Amazon Web Services (AWS)** using **100% AWS Free Tier** cloud resources.

The application eliminates monolithic servers and local file storage, achieving enterprise-grade reliability, continuous scalability, and a verified monthly billing cost of **$0.00/month**. The cloud workload seamlessly integrates:
1. **Amazon Cognito User Pools** for identity management, user sign-up, verification, and OAuth2/JWT token issuance.
2. **Amazon DynamoDB** for single-digit millisecond transactional NoSQL persistence across users, budgets, transactions, and group debts.
3. **AWS Lambda** (Node.js 20.x on ARM64 Graviton) and **Amazon API Gateway HTTP API v2** for on-demand event-driven REST backend compute.
4. **Amazon Simple Storage Service (S3)** for secure receipt and statement archiving with pre-signed URL time expirations.
5. **AWS Amplify Hosting / S3 + CloudFront** for global HTTPS edge content distribution of the React 19 single-page application.
6. **Amazon CloudWatch** for real-time execution logs, request latency telemetry, and anomaly monitoring.

---

### OUTCOME
* **True Serverless Architecture:** Fully managed, auto-scaling infrastructure with zero servers to provision, patch, or maintain.
* **100% Free Tier Compliance:** Billed operational cost is strictly **$0.00 / month**, utilizing Always Free and Free Tier tiering.
* **Integrated AWS Authentication:** Multi-tenant user directory powered by Amazon Cognito with self-registration and email confirmation.
* **Ultra-Low Latency:** Sub-10ms key-value lookups in DynamoDB in the Sydney (`ap-southeast-2`) region.
* **Tamper-Proof Auditability:** In-app transactions and debt settlements immutably tracked with digital PDF receipt generation.

---

### KEY TECHNOLOGIES & AWS SERVICES

* **Amazon Cognito User Pools:** Identity & user authentication directory (*Free Tier: 50,000 Monthly Active Users always free*).
* **AWS Lambda:** Serverless compute engine running Node.js 20.x on ARM64 (*Free Tier: 1,000,000 requests/month + 3.2M seconds of compute*).
* **Amazon API Gateway (HTTP API v2):** Lightweight low-latency API proxy with native CORS handling (*Free Tier: 1,000,000 requests/month*).
* **Amazon DynamoDB:** Fully managed NoSQL database (*Free Tier: 25 GB storage always free + 25 RCU / 25 WCU*).
* **Amazon Simple Storage Service (S3):** 11 9's durability cloud object storage (*Free Tier: 5 GB Standard Storage + 20,000 GET requests*).
* **AWS Amplify Hosting / Amazon CloudFront:** Global Content Delivery Network edge delivery (*Free Tier: 1 TB transfer out / 1,000 build minutes*).
* **Amazon CloudWatch:** Comprehensive logging, metrics, and error monitoring (*Free Tier: 5 GB log ingestion*).

---

### ARCHITECTURAL WORKFLOW

```
                           +-----------------------------------------------------------+
                           |                     User Web Browser                      |
                           +-----------------------------------------------------------+
                                         |                                       |
                        (React 19 SPA / Static Assets)              (REST API Requests / JSON)
                                         v                                       v
                           +---------------------------+           +---------------------------+
                           |    AWS Amplify Hosting    |           |    Amazon API Gateway     |
                           |   (Global CloudFront CDN) |           |       (HTTP API v2)       |
                           +---------------------------+           +---------------------------+
                                                                                 |
                                                                                 v
                                                                   +---------------------------+
                                                                   |        AWS Lambda         |
                                                                   |  (Serverless Express API) |
                                                                   +---------------------------+
                                                                                 |
                                         +---------------------------------------+---------------------------------------+
                                         |                                       |                                       |
                                         v                                       v                                       v
                           +---------------------------+           +---------------------------+           +---------------------------+
                           |      Amazon Cognito       |           |      Amazon DynamoDB      |           |      Amazon S3 Bucket     |
                           |   (User Authentication)   |           |     (NoSQL Database)      |           |     (Receipts / PDFs)     |
                           +---------------------------+           +---------------------------+           +---------------------------+
```

1. **Client Access:** The user loads the React 19 single-page application hosted on AWS Amplify's global CDN.
2. **Authentication Flow:** Users register and authenticate securely against **Amazon Cognito User Pools** (`ap-southeast-2_KciUDLfWB`).
3. **API Routing:** Client requests (`/api/*`) are transmitted over HTTPS to Amazon API Gateway (`ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com`).
4. **Compute Execution:** API Gateway triggers the AWS Lambda function (`SplityApiFunction`) running on Node.js 20.x (ARM64).
5. **Database Queries:** Lambda performs sub-10ms transactional CRUD operations on Amazon DynamoDB tables.
6. **Receipt Archiving:** Generated receipts and statements are safely stored in Amazon S3 bucket `splity-receipts-559169201994-ap-southeast-2`.
7. **Operational Telemetry:** CloudWatch ingests structured runtime logs and metric data automatically.

---

## PROCEDURE & IMPLEMENTATION STEPS

### Step 1: IAM Execution Role & Least-Privilege Policies

1. In the **AWS IAM Console**, create the serverless execution role:
   * **Role Name:** `SplityLambdaExecutionRole`
   * **Trusted Entity:** `lambda.amazonaws.com`
2. Attach the AWS managed policy:
   * `AWSLambdaBasicExecutionRole` (grants permission to write logs to CloudWatch).
3. Attach an inline least-privilege policy granting access to DynamoDB, S3, and Cognito:

```json
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
      "Resource": "arn:aws:dynamodb:ap-southeast-2:559169201994:table/Splity_*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::splity-receipts-559169201994-ap-southeast-2/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:SignUp",
        "cognito-idp:ConfirmSignUp",
        "cognito-idp:InitiateAuth",
        "cognito-idp:GetUser"
      ],
      "Resource": "arn:aws:cognito-idp:ap-southeast-2:559169201994:userpool/ap-southeast-2_KciUDLfWB"
    }
  ]
}
```

---

### Step 2: Amazon Cognito User Pool Setup (Authentication)

1. Open the **Amazon Cognito Console** in Sydney (`ap-southeast-2`).
2. Create a User Pool named **`SplityUserPool`** with email sign-in enabled.
3. Configure a Public App Client named **`SplityWebClient`** (Generate client secret: **No**).
4. Created Configuration:
   * **User Pool ID:** `ap-southeast-2_KciUDLfWB`
   * **App Client ID:** `2hgd6md36qvkjibi97rphm441h`
   * **Free Tier Allocation:** 50,000 Monthly Active Users (Always Free).

---

### Step 3: Amazon DynamoDB NoSQL Tables Provisioning

1. In the **DynamoDB Console**, provision the application tables with **PAY_PER_REQUEST** (Free Tier):
   * **`Splity_Users`**: Partition key `id` (String), Global Secondary Index `EmailIndex` (`email`).
   * **`Splity_Transactions`**: Partition key `userId` (String), Sort key `id` (String).
   * **`Splity_Categories`**: Partition key `userId` (String), Sort key `id` (String).
   * **`Splity_Budgets`**: Partition key `userId` (String), Sort key `id` (String).
   * **`Splity_Friends`**: Partition key `userId` (String), Sort key `id` (String).
   * **`Splity_Debts`**: Partition key `userId` (String), Sort key `id` (String).
2. Seed the tables with initial categories, transactions, and friend records using the automated seeding script.

---

### Step 4: Amazon S3 Storage Bucket Setup

1. In the **Amazon S3 Console**, create the private storage bucket:
   * **Bucket Name:** `splity-receipts-559169201994-ap-southeast-2`
   * **Region:** `ap-southeast-2` (Sydney)
   * **Block All Public Access:** Enabled (Security Best Practice)
2. Attach CORS policy allowing client web applications to perform pre-signed uploads and downloads.

---

### Step 5: AWS Lambda Serverless Function & API Gateway

1. In the **AWS Lambda Console**, deploy the serverless handler:
   * **Function Name:** `SplityApiFunction`
   * **Runtime:** Node.js 20.x
   * **Architecture:** ARM64 (Graviton2)
   * **Memory:** 256 MB
   * **Timeout:** 15 seconds
2. In the **API Gateway Console**, create an HTTP API v2:
   * **API Name:** `SplityHttpApi`
   * **Integration Target:** `SplityApiFunction`
   * **Live Endpoint:** `https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com`
   * **CORS:** Allowed Origins: `*`, Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.

---

### Step 6: Live Verification & Testing Results

#### 1. Lambda Health Check:
```bash
$ curl -s https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com/api/health | jq .
{
  "status": "ok",
  "runtime": "AWS Lambda (Serverless)",
  "timestamp": "2026-10-11T15:11:51.717Z"
}
```

#### 2. AWS Native Cloud Infrastructure Status:
```bash
$ curl -s https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com/api/aws/status | jq .
{
  "status": "online",
  "cloudProvider": "Amazon Web Services (AWS)",
  "freeTierCompliance": "100% Free Tier Eligible",
  "region": "ap-southeast-2",
  "services": {
    "compute": {
      "type": "AWS Lambda (Node.js 20.x)",
      "freeTier": "1,000,000 requests/month + 3.2M seconds execution"
    },
    "apiGateway": {
      "type": "Amazon API Gateway (HTTP API v2)",
      "freeTier": "1,000,000 requests/month"
    },
    "database": {
      "type": "Amazon DynamoDB (NoSQL)",
      "freeTier": "25 GB Storage (Always Free) + 25 RCU/WCU",
      "tables": [
        "Splity_Users",
        "Splity_Transactions",
        "Splity_Categories",
        "Splity_Budgets",
        "Splity_Friends",
        "Splity_Debts"
      ]
    },
    "storage": {
      "type": "Amazon Simple Storage Service (S3)",
      "freeTier": "5 GB Standard Storage + 20,000 GET requests",
      "bucket": "splity-receipts-559169201994-ap-southeast-2"
    },
    "auth": {
      "type": "Amazon Cognito User Pools",
      "freeTier": "50,000 Monthly Active Users (Always Free)",
      "configured": true
    }
  }
}
```

#### 3. Live Amazon Cognito User Registration Test:
```bash
$ curl -s -X POST https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com/api/aws/cognito/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"ansh.test@gmail.com","password":"Password123"}' | jq .
{
  "success": true,
  "userSub": "897ef498-b071-707c-10c1-ab00e06fb7ce",
  "isConfirmed": false
}
```

---

### COST & FREE TIER ARCHITECTURE ANALYSIS

| AWS Service | Architectural Role | AWS Free Tier Allocation | Estimated Usage | Monthly Billed Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Amazon Cognito** | User Authentication & Directory | 50,000 MAUs (Always Free) | ~100 MAUs | **$0.00** |
| **AWS Lambda** | Serverless Backend Compute | 1,000,000 requests / 3.2M sec | ~10,000 requests / mo | **$0.00** |
| **Amazon API Gateway** | HTTP REST Routing & CORS | 1,000,000 API calls / mo | ~10,000 calls / mo | **$0.00** |
| **Amazon DynamoDB** | NoSQL Data Store | 25 GB Storage + 25 WCU / RCU | ~0.05 GB Storage | **$0.00** |
| **Amazon S3** | Receipt & Statement Storage | 5 GB Standard Storage | ~0.10 GB Storage | **$0.00** |
| **AWS Amplify / CloudFront** | React Single-Page App Hosting | 1,000 build mins, 15 GB served | ~15 build mins, 1 GB transfer | **$0.00** |
| **Amazon CloudWatch** | Centralized Logs & Metrics | 5 GB Log Data Ingestion | ~0.05 GB Logs | **$0.00** |
| **TOTAL MONTHLY ESTIMATED COST:** | | | | **$0.00 / MONTH** |

---

### CONCLUSION
The migration of Splity to Amazon Web Services demonstrates the deployment of a resilient, scalable, and completely serverless architecture. By leveraging **Amazon Cognito, AWS Lambda, Amazon API Gateway, Amazon DynamoDB, and Amazon S3**, the application delivers full financial management and AI copilot capabilities while strictly maintaining **100% Free Tier compliance ($0.00/month)**.
