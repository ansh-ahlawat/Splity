export const AWS_CONFIG = {
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2',
  dynamoDb: {
    usersTable: process.env.DYNAMODB_USERS_TABLE || 'Splity_Users',
    transactionsTable: process.env.DYNAMODB_TRANSACTIONS_TABLE || 'Splity_Transactions',
    categoriesTable: process.env.DYNAMODB_CATEGORIES_TABLE || 'Splity_Categories',
    budgetsTable: process.env.DYNAMODB_BUDGETS_TABLE || 'Splity_Budgets',
    friendsTable: process.env.DYNAMODB_FRIENDS_TABLE || 'Splity_Friends',
    debtsTable: process.env.DYNAMODB_DEBTS_TABLE || 'Splity_Debts',
    notificationsTable: process.env.DYNAMODB_NOTIFICATIONS_TABLE || 'Splity_Notifications',
  },
  s3: {
    bucketName: process.env.S3_STORAGE_BUCKET || 'splity-app-storage-bucket',
  },
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    clientId: process.env.COGNITO_CLIENT_ID || '',
  },
  useDynamoDb: process.env.USE_DYNAMODB === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME),
};
