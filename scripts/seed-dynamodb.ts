import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDynamoTablesExist, dynamoDbRepo } from '../server/aws/dynamoDb.js';
import { AWS_CONFIG } from '../server/aws/config.js';

async function main() {
  console.log('==========================================================');
  console.log('🚀 Splity DynamoDB Seed Tool (AWS Free Tier)');
  console.log(`Region: ${AWS_CONFIG.region}`);
  console.log('==========================================================');

  const dataPath = path.join(process.cwd(), 'data_store.example.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`File not found: ${dataPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log('\n[1/3] Ensuring DynamoDB tables exist...');
  await ensureDynamoTablesExist();

  console.log('\n[2/3] Seeding data to AWS DynamoDB...');

  // 1. Seed Users
  let userCount = 0;
  for (const user of rawData.users || []) {
    const pwdHash = rawData.userPasswords ? rawData.userPasswords[user.id] : undefined;
    await dynamoDbRepo.putUser(user, pwdHash);
    userCount++;
  }
  console.log(`  ✓ Synced ${userCount} users to DynamoDB (${AWS_CONFIG.dynamoDb.usersTable})`);

  // 2. Seed Categories
  let catCount = 0;
  for (const cat of rawData.categories || []) {
    await dynamoDbRepo.putCategory(cat);
    catCount++;
  }
  console.log(`  ✓ Synced ${catCount} categories to DynamoDB (${AWS_CONFIG.dynamoDb.categoriesTable})`);

  // 3. Seed Transactions
  let txCount = 0;
  for (const tx of rawData.transactions || []) {
    await dynamoDbRepo.putTransaction(tx);
    txCount++;
  }
  console.log(`  ✓ Synced ${txCount} transactions to DynamoDB (${AWS_CONFIG.dynamoDb.transactionsTable})`);

  // 4. Seed Budgets
  let budgetCount = 0;
  for (const budget of rawData.categoryBudgets || []) {
    await dynamoDbRepo.putBudget(budget);
    budgetCount++;
  }
  console.log(`  ✓ Synced ${budgetCount} budgets to DynamoDB (${AWS_CONFIG.dynamoDb.budgetsTable})`);

  // 5. Seed Friends & Debts
  let friendCount = 0;
  for (const friend of rawData.friends || []) {
    await dynamoDbRepo.putFriend(friend);
    friendCount++;
  }
  console.log(`  ✓ Synced ${friendCount} friends to DynamoDB (${AWS_CONFIG.dynamoDb.friendsTable})`);

  let debtCount = 0;
  for (const debt of rawData.friendDebts || []) {
    await dynamoDbRepo.putDebt(debt);
    debtCount++;
  }
  console.log(`  ✓ Synced ${debtCount} shared debts to DynamoDB (${AWS_CONFIG.dynamoDb.debtsTable})`);

  console.log('\n[3/3] Done! All Splity data successfully synced to Amazon DynamoDB.');
  console.log('You can now open the AWS DynamoDB Console to inspect your live items!');
  console.log('==========================================================');
}

main().catch((err) => {
  console.error('DynamoDB Seed failed:', err);
  process.exit(1);
});
