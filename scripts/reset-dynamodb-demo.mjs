import { DynamoDBClient, ScanCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';
dotenv.config();

const client = new DynamoDBClient({
  region: 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const DEMO_USER_ID = 'demo-user-123';

async function resetDemoDataInDynamo() {
  const tables = [
    'Splity_Categories',
    'Splity_Friends',
    'Splity_Debts',
    'Splity_Transactions',
    'Splity_Budgets'
  ];

  console.log('1. Deleting old demo records from DynamoDB tables in ap-southeast-2...');
  for (const table of tables) {
    const scanRes = await client.send(new ScanCommand({ TableName: table }));
    const demoItems = (scanRes.Items || []).filter(item => item.userId?.S === DEMO_USER_ID);
    console.log(`Deleting ${demoItems.length} old records from ${table}...`);
    for (const item of demoItems) {
      await client.send(new DeleteItemCommand({
        TableName: table,
        Key: {
          userId: { S: DEMO_USER_ID },
          id: item.id
        }
      }));
    }
  }

  console.log('2. Inserting 3 clean categories with semantic IDs...');
  const categories = [
    { id: 'cat-housing-rent', name: 'Housing & Rent', icon: 'Home', color: '#8B5CF6' },
    { id: 'cat-food-dining', name: 'Food & Dining', icon: 'Utensils', color: '#10B981' },
    { id: 'cat-shopping-lifestyle', name: 'Shopping & Lifestyle', icon: 'ShoppingBag', color: '#3B82F6' }
  ];
  for (const cat of categories) {
    await client.send(new PutItemCommand({
      TableName: 'Splity_Categories',
      Item: {
        userId: { S: DEMO_USER_ID },
        id: { S: cat.id },
        name: { S: cat.name },
        icon: { S: cat.icon },
        color: { S: cat.color },
        createdAt: { S: '2026-10-01T00:00:00.000Z' }
      }
    }));
  }

  console.log('3. Inserting 3 clean friends with semantic IDs...');
  const friends = [
    { id: 'friend-rohan-sharma', name: 'Rohan Sharma', phone: '+91 98765 11111' },
    { id: 'friend-priya-patel', name: 'Priya Patel', phone: '+91 98765 22222' },
    { id: 'friend-aman-verma', name: 'Aman Verma', phone: '+91 98765 33333' }
  ];
  for (const f of friends) {
    await client.send(new PutItemCommand({
      TableName: 'Splity_Friends',
      Item: {
        userId: { S: DEMO_USER_ID },
        id: { S: f.id },
        name: { S: f.name },
        phone: { S: f.phone },
        createdAt: { S: '2026-10-01T00:00:00.000Z' }
      }
    }));
  }

  console.log('4. Inserting 3 clean debts (1 owe, 2 owed)...');
  const debts = [
    {
      id: 'debt-goa-villa-dinner',
      friendName: 'Rohan Sharma',
      groupId: 'group-goa-trip',
      groupName: 'Goa Weekend Trip',
      amount: '1450',
      type: 'YOU_OWE',
      description: 'Seafood dinner & drinks bill split at Fisherman Wharf',
      date: '2026-10-18'
    },
    {
      id: 'debt-concert-pass-booking',
      friendName: 'Priya Patel',
      groupId: null,
      groupName: null,
      amount: '3200',
      type: 'OWED_TO_YOU',
      description: 'Advance booking for live music concert passes',
      date: '2026-10-19'
    },
    {
      id: 'debt-flat-wifi-groceries',
      friendName: 'Aman Verma',
      groupId: 'group-roommates-flat',
      groupName: 'Roommates & Flat 402',
      amount: '1850',
      type: 'OWED_TO_YOU',
      description: 'Airtel Xstream fiber WiFi & pantry staples monthly split',
      date: '2026-10-20'
    }
  ];
  for (const d of debts) {
    const item = {
      userId: { S: DEMO_USER_ID },
      id: { S: d.id },
      friendName: { S: d.friendName },
      amount: { N: d.amount },
      type: { S: d.type },
      description: { S: d.description },
      settled: { BOOL: false },
      date: { S: d.date },
      createdAt: { S: '2026-10-18T00:00:00.000Z' }
    };
    if (d.groupId) {
      item.groupId = { S: d.groupId };
      item.groupName = { S: d.groupName };
    } else {
      item.groupId = { NULL: true };
      item.groupName = { NULL: true };
    }
    await client.send(new PutItemCommand({
      TableName: 'Splity_Debts',
      Item: item
    }));
  }

  console.log('5. Inserting 5 clean transactions...');
  const txns = [
    {
      id: 'txn-salary-deposit-oct',
      categoryId: null,
      categoryName: 'Salary / Income',
      type: 'INCOME',
      amount: '82000',
      merchant: 'Acme Technologies',
      note: 'Monthly Senior Engineer salary direct credit',
      date: '2026-10-01'
    },
    {
      id: 'txn-apartment-rent-oct',
      categoryId: 'cat-housing-rent',
      categoryName: 'Housing & Rent',
      type: 'EXPENSE',
      amount: '12000',
      merchant: 'Prestige Living Properties',
      note: 'Monthly 2BHK apartment rent payment',
      date: '2026-10-02'
    },
    {
      id: 'txn-groceries-supermarket',
      categoryId: 'cat-food-dining',
      categoryName: 'Food & Dining',
      type: 'EXPENSE',
      amount: '3200',
      merchant: "Nature's Basket Gourmet",
      note: 'Monthly organic pantry supplies & olive oil',
      date: '2026-10-06'
    },
    {
      id: 'txn-coffee-roasters',
      categoryId: 'cat-food-dining',
      categoryName: 'Food & Dining',
      type: 'EXPENSE',
      amount: '850',
      merchant: 'Blue Tokai Coffee Roasters',
      note: 'Artisan pour-over coffee & breakfast croissant',
      date: '2026-10-12'
    },
    {
      id: 'txn-work-desk-accessories',
      categoryId: 'cat-shopping-lifestyle',
      categoryName: 'Shopping & Lifestyle',
      type: 'EXPENSE',
      amount: '2450',
      merchant: 'Amazon India',
      note: 'Ergonomic aluminum laptop stand & wireless mouse',
      date: '2026-10-17'
    }
  ];
  for (const t of txns) {
    const item = {
      userId: { S: DEMO_USER_ID },
      id: { S: t.id },
      categoryName: { S: t.categoryName },
      type: { S: t.type },
      amount: { N: t.amount },
      merchant: { S: t.merchant },
      note: { S: t.note },
      date: { S: t.date },
      source: { S: 'MANUAL' },
      createdAt: { S: `${t.date}T10:00:00.000Z` }
    };
    if (t.categoryId) {
      item.categoryId = { S: t.categoryId };
    } else {
      item.categoryId = { NULL: true };
    }
    await client.send(new PutItemCommand({
      TableName: 'Splity_Transactions',
      Item: item
    }));
  }

  console.log('6. Inserting clean budgets for the 3 categories...');
  const budgets = [
    { id: 'mbudget-demo-2026-10', limitAmount: '45000', month: '2026-10', categoryId: null },
    { id: 'cbudget-housing-rent-2026-10', limitAmount: '15000', month: '2026-10', categoryId: 'cat-housing-rent' },
    { id: 'cbudget-food-dining-2026-10', limitAmount: '14000', month: '2026-10', categoryId: 'cat-food-dining' },
    { id: 'cbudget-shopping-lifestyle-2026-10', limitAmount: '8000', month: '2026-10', categoryId: 'cat-shopping-lifestyle' }
  ];
  for (const b of budgets) {
    const item = {
      userId: { S: DEMO_USER_ID },
      id: { S: b.id },
      month: { S: b.month },
      limitAmount: { N: b.limitAmount },
      createdAt: { S: '2026-10-01T00:00:00.000Z' }
    };
    if (b.categoryId) {
      item.categoryId = { S: b.categoryId };
    } else {
      item.categoryId = { NULL: true };
    }
    await client.send(new PutItemCommand({
      TableName: 'Splity_Budgets',
      Item: item
    }));
  }

  console.log('SUCCESS: All DynamoDB tables in ap-southeast-2 populated with exact requested demo data!');
}

resetDemoDataInDynamo().catch(console.error);
