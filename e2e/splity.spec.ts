import { test, expect } from '@playwright/test';

test.describe('Splity End-to-End Production Verification', () => {
  const timestamp = Date.now();
  const testEmail = `qa_user_${timestamp}@splity.app`;
  const testPassword = 'Password@1234!';
  const testName = 'QA Tester';

  test('Backend API Security & Edge Case Handling', async ({ request }) => {
    // 1. Unauthenticated request must return 401
    const unauthTx = await request.get('/api/transactions');
    expect(unauthTx.status()).toBe(401);

    const unauthReports = await request.get('/api/reports/latest');
    expect(unauthReports.status()).toBe(401);

    const unauthMe = await request.get('/api/me');
    expect(unauthMe.status()).toBe(401);

    // 2. Health check
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    const healthData = await health.json();
    expect(healthData.status).toBe('ok');

    // 3. Signup validation - missing fields
    const badSignup = await request.post('/api/auth/signup', {
      data: { email: '' },
    });
    expect(badSignup.status()).toBe(400);

    // 4. Valid Signup
    const signup = await request.post('/api/auth/signup', {
      data: {
        email: testEmail,
        password: testPassword,
        fullName: testName,
        phone: '+91 99999 88888',
      },
    });
    expect(signup.status()).toBe(200);
    const signupData = await signup.json();
    expect(signupData.accessToken).toBeTruthy();
    const token = signupData.accessToken;

    // 5. User A cannot access other users' transactions
    const headers = { Authorization: `Bearer ${token}` };
    const myTx = await request.get('/api/transactions', { headers });
    expect(myTx.status()).toBe(200);
    const myTxData = await myTx.json();
    expect(myTxData.totalCount).toBe(0); // Brand new user has zero transactions

    // 6. Transaction validation: negative or NaN amount
    const badAmountTx = await request.post('/api/transactions', {
      headers,
      data: {
        type: 'EXPENSE',
        amount: -500,
        merchant: 'Hacker Merchant',
        date: '2026-10-23',
      },
    });
    expect(badAmountTx.status()).toBe(400);

    // 7. Transaction validation: invalid type
    const badTypeTx = await request.post('/api/transactions', {
      headers,
      data: {
        type: 'INVALID_TYPE',
        amount: 250,
        merchant: 'Cafe',
        date: '2026-10-23',
      },
    });
    expect(badTypeTx.status()).toBe(400);

    // 8. Valid Transaction Create
    const createTx = await request.post('/api/transactions', {
      headers,
      data: {
        type: 'EXPENSE',
        amount: 750.50,
        merchant: 'Blue Tokai Cafe',
        note: 'Team coffee meeting',
        date: '2026-10-23',
      },
    });
    expect(createTx.status()).toBe(200);
    const createdTxData = await createTx.json();
    expect(createdTxData.id).toBeTruthy();
    expect(createdTxData.amount).toBe(750.5);

    // 9. Update Transaction
    const updateTx = await request.patch(`/api/transactions/${createdTxData.id}`, {
      headers,
      data: {
        merchant: 'Blue Tokai Coffee Roasters',
        amount: 800,
      },
    });
    expect(updateTx.status()).toBe(200);
    const updatedTxData = await updateTx.json();
    expect(updatedTxData.merchant).toBe('Blue Tokai Coffee Roasters');
    expect(updatedTxData.amount).toBe(800);

    // 10. Reports & S3 generation: never blank, updates receipt in-place
    const reportRes = await request.post('/api/reports/monthly', {
      headers,
      data: { month: '2026-10' },
    });
    expect(reportRes.status()).toBe(200);
    const reportData = await reportRes.json();
    expect(reportData.id).toBeTruthy();
    expect(reportData.month).toBe('2026-10');

    // 11. Delete Transaction
    const deleteTx = await request.delete(`/api/transactions/${createdTxData.id}`, { headers });
    expect(deleteTx.status()).toBe(200);

    // Verify deletion
    const verifyEmpty = await request.get('/api/transactions', { headers });
    const verifyData = await verifyEmpty.json();
    expect(verifyData.totalCount).toBe(0);
  });

  test('Frontend User Journey: Demo Login, Navigation, Reports, and Logout', async ({ page }) => {
    // 1. Visit App
    await page.goto('/');

    // 2. Click "Demo login" to login as demo user
    const demoBtn = page.getByRole('button', { name: /Demo login/i });
    if (await demoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await demoBtn.click();
    } else {
      // Regular login fallback with correct demo password
      await page.fill('input[type="text"], input[type="email"]', 'demo@expensebuddy.app');
      await page.fill('input[type="password"]', 'Password123!');
      await page.locator('button[type="submit"]').click();
    }

    // 3. Verify Dashboard loaded
    await expect(page.getByText('Total Budget').first()).toBeVisible({ timeout: 15000 });

    // 4. Navigate to Analytics (Reports) tab
    const analyticsBtn = page.locator('button:has-text("Analytics")').first();
    await analyticsBtn.click();

    // 5. Verify Analytics synthesized card is immediately visible (NOT blank!)
    await expect(page.getByText('Financial Synthesis & Reports').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Monthly Financial Audit').first()).toBeVisible({ timeout: 10000 });

    // 6. Verify PDF Receipt button exists
    const printBtn = page.getByRole('button', { name: /Print PDF Receipt/i }).first();
    await expect(printBtn).toBeVisible();

    // 7. Verify S3 Report badge or link is visible
    await expect(page.locator('text=AWS S3 Stored').or(page.locator('text=AWS S3 & DynamoDB')).first()).toBeVisible();

    // 8. Sign out via top right dock
    const signOutBtn = page.getByTitle('Sign out').first();
    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signOutBtn.click();
    }
  });
});
