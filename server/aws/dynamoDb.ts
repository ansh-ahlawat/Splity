import 'dotenv/config';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWS_CONFIG } from './config.js';
import fs from 'node:fs';
import path from 'node:path';

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

// Initialize low-level client
export const dynamoRawClient = new DynamoDBClient({
  region: AWS_CONFIG.region,
  credentials,
});

// Initialize DocumentClient with marshalling options
export const docClient = DynamoDBDocumentClient.from(dynamoRawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

/**
 * Ensure DynamoDB tables exist for Splity.
 * Uses AWS Free Tier settings (PAY_PER_REQUEST or 1 RCU / 1 WCU).
 */
export async function ensureDynamoTablesExist() {
  const tables = [
    {
      TableName: AWS_CONFIG.dynamoDb.usersTable,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'EmailIndex',
          KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: AWS_CONFIG.dynamoDb.transactionsTable,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: AWS_CONFIG.dynamoDb.categoriesTable,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: AWS_CONFIG.dynamoDb.budgetsTable,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: AWS_CONFIG.dynamoDb.friendsTable,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: AWS_CONFIG.dynamoDb.debtsTable,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  ];

  for (const table of tables) {
    try {
      await dynamoRawClient.send(new DescribeTableCommand({ TableName: table.TableName }));
      console.log(`[DynamoDB] Table ${table.TableName} already exists.`);
    } catch (err: any) {
      if (err.name === 'ResourceNotFoundException') {
        console.log(`[DynamoDB] Creating Table ${table.TableName}...`);
        await dynamoRawClient.send(new CreateTableCommand(table as any));
        console.log(`[DynamoDB] Table ${table.TableName} creation initiated. Waiting for ACTIVE state...`);
        let isActive = false;
        while (!isActive) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          try {
            const desc = await dynamoRawClient.send(new DescribeTableCommand({ TableName: table.TableName }));
            if (desc.Table?.TableStatus === 'ACTIVE') {
              isActive = true;
            }
          } catch {}
        }
        console.log(`[DynamoDB] Table ${table.TableName} is now ACTIVE.`);
      } else {
        console.warn(`[DynamoDB] Table check notice for ${table.TableName}:`, err.message);
      }
    }
  }
}

/**
 * DynamoDB Repository providing typed CRUD operations for all Splity entities.
 */
export const dynamoDbRepo = {
  // --- USERS ---
  async getUser(id: string) {
    const res = await docClient.send(
      new GetCommand({
        TableName: AWS_CONFIG.dynamoDb.usersTable,
        Key: { id },
      })
    );
    return res.Item || null;
  },

  async getUserByEmail(email: string) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: AWS_CONFIG.dynamoDb.usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email.toLowerCase() },
      })
    );
    return res.Items && res.Items.length > 0 ? res.Items[0] : null;
  },

  async putUser(user: any, passwordHash?: string) {
    const item = { ...user, email: user.email.toLowerCase() };
    if (passwordHash) {
      item.passwordHash = passwordHash;
    }
    await docClient.send(
      new PutCommand({
        TableName: AWS_CONFIG.dynamoDb.usersTable,
        Item: item,
      })
    );
    return item;
  },

  // --- TRANSACTIONS ---
  async getTransactionsByUser(userId: string) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: AWS_CONFIG.dynamoDb.transactionsTable,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return res.Items || [];
  },

  async putTransaction(transaction: any) {
    await docClient.send(
      new PutCommand({
        TableName: AWS_CONFIG.dynamoDb.transactionsTable,
        Item: transaction,
      })
    );
    return transaction;
  },

  async deleteTransaction(userId: string, id: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: AWS_CONFIG.dynamoDb.transactionsTable,
        Key: { userId, id },
      })
    );
  },

  // --- CATEGORIES ---
  async getCategoriesByUser(userId: string) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: AWS_CONFIG.dynamoDb.categoriesTable,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return res.Items || [];
  },

  async putCategory(category: any) {
    await docClient.send(
      new PutCommand({
        TableName: AWS_CONFIG.dynamoDb.categoriesTable,
        Item: category,
      })
    );
    return category;
  },

  async deleteCategory(userId: string, id: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: AWS_CONFIG.dynamoDb.categoriesTable,
        Key: { userId, id },
      })
    );
  },

  // --- BUDGETS ---
  async getBudgetsByUser(userId: string) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: AWS_CONFIG.dynamoDb.budgetsTable,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return res.Items || [];
  },

  async putBudget(budget: any) {
    await docClient.send(
      new PutCommand({
        TableName: AWS_CONFIG.dynamoDb.budgetsTable,
        Item: budget,
      })
    );
    return budget;
  },

  // --- FRIENDS & DEBTS ---
  async getFriendsByUser(userId: string) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: AWS_CONFIG.dynamoDb.friendsTable,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return res.Items || [];
  },

  async putFriend(friend: any) {
    await docClient.send(
      new PutCommand({
        TableName: AWS_CONFIG.dynamoDb.friendsTable,
        Item: friend,
      })
    );
    return friend;
  },

  async deleteFriend(userId: string, id: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: AWS_CONFIG.dynamoDb.friendsTable,
        Key: { userId, id },
      })
    );
  },

  async getDebtsByUser(userId: string) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: AWS_CONFIG.dynamoDb.debtsTable,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return res.Items || [];
  },

  async putDebt(debt: any) {
    await docClient.send(
      new PutCommand({
        TableName: AWS_CONFIG.dynamoDb.debtsTable,
        Item: debt,
      })
    );
    return debt;
  },
};
