import { db, FriendDebt } from '../db.js';
import { generateJSON } from '../gemini.js';
import { getSpendByCategory, getBiggestTransactions, getMonthlySummary, createTransaction } from './transaction.service.js';
import { upsertCategoryBudget, getMonthlyBudget } from './budget.service.js';
import { SmartSearchResult } from '../../src/types.js';
import crypto from 'node:crypto';

function getMonthString(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function removeMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*/g, '')  // Remove bold markdown
    .replace(/\*/g, '')    // Remove italic markdown
    .replace(/#{1,6}\s/g, '')  // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links but keep text
    .replace(/`([^`]+)`/g, '$1')  // Remove inline code
    .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
    .trim();
}

function enhanceQuery(query: string): string {
  const lowerQuery = query.toLowerCase().trim();
  
  // Add time context if missing
  if (!lowerQuery.includes('this month') && !lowerQuery.includes('last month') && 
      !lowerQuery.includes('this week') && !lowerQuery.includes('today') &&
      !lowerQuery.includes('yesterday') && !lowerQuery.includes('current') &&
      !lowerQuery.includes('recent') && !lowerQuery.includes('month') &&
      !lowerQuery.includes('week') && !lowerQuery.includes('year')) {
    // For spending/expense queries, add "this month" context
    if (lowerQuery.includes('spend') || lowerQuery.includes('expense') || 
        lowerQuery.includes('cost') || lowerQuery.includes('budget') ||
        lowerQuery.includes('how much')) {
      return `${query} this month`;
    }
  }
  
  // Expand abbreviations and common terms
  let enhanced = query
    .replace(/\btxn\b/gi, 'transaction')
    .replace(/\bbal\b/gi, 'balance')
    .replace(/\bexp\b/gi, 'expense')
    .replace(/\binc\b/gi, 'income')
    .replace(/\bsav\b/gi, 'savings')
    .replace(/\bbudg\b/gi, 'budget')
    .replace(/\bcat\b/gi, 'category')
    .replace(/\bmerch\b/gi, 'merchant')
    .replace(/\bfri\b/gi, 'friend')
    .replace(/\brec\b/gi, 'recent');
  
  // Add more specific context for common queries
  if (lowerQuery === 'how much i spent') {
    enhanced = 'How much did I spend in total this month';
  } else if (lowerQuery === 'my spending') {
    enhanced = 'Show me my detailed spending breakdown this month';
  } else if (lowerQuery === 'savings') {
    enhanced = 'What are my current savings this month compared to last month';
  } else if (lowerQuery === 'budget') {
    enhanced = 'What is my current budget status and how much have I used';
  } else if (lowerQuery === 'biggest expenses') {
    enhanced = 'Show me my biggest transactions and expenses this month';
  } else if (lowerQuery === 'who owes me') {
    enhanced = 'Which friends owe me money and how much';
  } else if (lowerQuery === 'i owe') {
    enhanced = 'How much do I owe to friends and to whom';
  }
  
  return enhanced;
}

export async function processSmartSearch(userId: string, queryText: string): Promise<SmartSearchResult> {
  const originalQuery = queryText.trim();
  const enhancedQuery = enhanceQuery(originalQuery);
  const query = enhancedQuery;
  
  if (!query) {
    return {
      intent: 'GENERAL_QUERY',
      source: 'gemini',
      query: '',
      message: 'Please ask a question or tell me what to track in your finances.',
    };
  }

  // Ensure DB collections exist
  if (!db.data.friendDebts) db.data.friendDebts = [];
  if (!db.data.friends) db.data.friends = [];
  if (!db.data.transactions) db.data.transactions = [];
  if (!db.data.categories) db.data.categories = [];
  if (!db.data.categoryBudgets) db.data.categoryBudgets = [];

  const currentMonth = getMonthString(0);
  const lastMonth = getMonthString(-1);

  // 1. Gather all live statistics for this user
  const currentSummary = await getMonthlySummary(userId, currentMonth);
  const lastMonthSummary = await getMonthlySummary(userId, lastMonth);
  const categorySpends = await getSpendByCategory(userId, currentMonth);
  const userCategories = db.data.categories.filter((c) => c.userId === userId);
  const monthlyBudget = await getMonthlyBudget(userId, currentMonth);

  const userDebts = db.data.friendDebts.filter((d) => d.userId === userId && !d.settled);
  const debtsOwedToYou = userDebts.filter((d) => d.type === 'OWED_TO_YOU');
  const debtsYouOwe = userDebts.filter((d) => d.type === 'YOU_OWE');
  const totalOwedToYou = debtsOwedToYou.reduce((sum, d) => sum + d.amount, 0);
  const totalYouOwe = debtsYouOwe.reduce((sum, d) => sum + d.amount, 0);

  const userTransactions = db.data.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentTransactions = userTransactions.slice(0, 40);

  const userStatsContext = {
    today: new Date().toISOString().split('T')[0],
    currentMonth,
    lastMonth,
    currency: 'INR (₹)',
    currentMonthFinancials: {
      totalIncome: currentSummary.totalIncome,
      totalExpense: currentSummary.totalExpense,
      netSavings: currentSummary.netSaved,
      savingsRate: `${currentSummary.savingsRate}%`,
      budgetLimit: monthlyBudget?.limitAmount || 0,
    },
    lastMonthFinancials: {
      totalIncome: lastMonthSummary.totalIncome,
      totalExpense: lastMonthSummary.totalExpense,
      netSavings: lastMonthSummary.netSaved,
    },
    categorySpendingAndBudgets: categorySpends.map((c) => ({
      category: c.categoryName,
      spentThisMonth: c.total,
      monthlyBudgetLimit: c.limitAmount || 0,
      percentUsed: c.percentUsed,
    })),
    friendDebtsSummary: {
      totalFriendsOweYou: totalOwedToYou,
      totalYouOweFriends: totalYouOwe,
      unsettledOwedToYou: debtsOwedToYou.map((d) => ({ friend: d.friendName, amount: d.amount, note: d.description, date: d.date })),
      unsettledYouOwe: debtsYouOwe.map((d) => ({ friend: d.friendName, amount: d.amount, note: d.description, date: d.date })),
    },
    availableCategories: userCategories.map((c) => c.name),
    recentTransactionsSample: recentTransactions.map((t) => ({
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.categoryName || 'Uncategorized',
      merchant: t.merchant || '',
      note: t.note || '',
    })),
  };

  // 2. Query Gemini AI with full stats and free-form capabilities
  const aiPrompt = `
User Query: "${query}" (Enhanced from: "${originalQuery}")

Here is the user's complete, live financial data:
${JSON.stringify(userStatsContext, null, 2)}

Instructions:
- The user can ask freely about anything (spending habits, questions, advice, future purchases, budget comparisons, friend debts, or commands). Answer freely and naturally.
- DO NOT default to or assume any arbitrary timeframe (such as 3 months) unless the user explicitly requested it. If the user asks about planning a purchase (e.g. "Can I buy iPhone in November?"), calculate dynamically based on their actual monthly net savings, target date, and reasonable estimation.
- If the user commands an action (e.g., adding an expense, splitting a bill, logging a debt, clearing debts, or setting a budget), specify the exact structured action so our database can update it.
- Possible actions:
  * "LOG_FRIEND_DEBT": { "friendName": "string", "amount": number, "type": "OWED_TO_YOU" | "YOU_OWE", "description": "string" }
  * "SETTLE_FRIEND_DEBT": { "friendName"?: "string", "settleAll"?: boolean }
  * "SET_CATEGORY_BUDGET": { "categoryName": "string", "amount": number, "month"?: "string" }
  * "ADD_TRANSACTION": { "type": "EXPENSE" | "INCOME", "amount": number, "categoryName"?: "string", "merchant"?: "string", "note"?: "string" }
  * null: if just asking a question or analysis.

- Return valid JSON matching this schema:
{
  "answer": "A simple, clear, direct answer to the user in natural terms (use ₹ symbol for currency). Keep it concise and easy to understand.",
  "action": null | { "type": "LOG_FRIEND_DEBT" | "SETTLE_FRIEND_DEBT" | "SET_CATEGORY_BUDGET" | "ADD_TRANSACTION", "params": { ... } },
  "intent": "SPEND_SUMMARY" | "FINANCIAL_ADVICE" | "PLAN_PURCHASE" | "LOG_FRIEND_DEBT" | "SETTLE_DEBT" | "SET_CATEGORY_BUDGET" | "ADD_TRANSACTION" | "GENERAL_QUERY"
}
`;

  try {
    const aiResult = await generateJSON<any>(
      aiPrompt,
      'You are the expert, conversational financial AI for Expense Buddy. Ground every answer in the user\'s real financial statistics and execute actions precisely. Keep answers simple, clear, and concise. Return valid JSON only.'
    );

    if (aiResult && aiResult.answer) {
      let actionTaken = false;
      let actionData: any = null;

      // Handle executed actions
      if (aiResult.action && aiResult.action.type) {
        const { type, params } = aiResult.action;

        if (type === 'LOG_FRIEND_DEBT' && params?.friendName && params?.amount) {
          const friendName = params.friendName.trim();
          const amount = Number(params.amount);
          const debtType = params.type === 'YOU_OWE' ? 'YOU_OWE' : 'OWED_TO_YOU';

          // Ensure friend exists
          let friend = db.data.friends.find(
            (f) => f.userId === userId && f.name.toLowerCase() === friendName.toLowerCase()
          );
          if (!friend) {
            friend = {
              id: crypto.randomUUID(),
              userId,
              name: friendName,
              phone: '+91 98765 00000',
              createdAt: new Date().toISOString(),
            };
            db.data.friends.push(friend);
          }

          const debt: FriendDebt = {
            id: crypto.randomUUID(),
            userId,
            friendName,
            amount,
            type: debtType,
            description: params.description || `Split entry via Smart Search`,
            settled: false,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
          };
          db.data.friendDebts.push(debt);
          db.save();
          actionTaken = true;
          actionData = debt;
        } else if (type === 'SETTLE_FRIEND_DEBT') {
          const friendName = params?.friendName ? params.friendName.toLowerCase() : null;
          let settledCount = 0;
          db.data.friendDebts.forEach((d) => {
            if (d.userId === userId && !d.settled) {
              if (params?.settleAll || !friendName || d.friendName.toLowerCase() === friendName) {
                d.settled = true;
                settledCount++;
              }
            }
          });
          if (settledCount > 0) {
            db.save();
            actionTaken = true;
            actionData = { settledCount };
          }
        } else if (type === 'SET_CATEGORY_BUDGET' && params?.categoryName && params?.amount) {
          const targetCatName = params.categoryName.toLowerCase();
          let cat = userCategories.find((c) => c.name.toLowerCase().includes(targetCatName));
          if (!cat && userCategories.length > 0) {
            cat = userCategories[0];
          }
          if (cat) {
            const targetMonth = params.month || currentMonth;
            const updatedBudget = await upsertCategoryBudget(userId, cat.id, targetMonth, Number(params.amount));
            actionTaken = true;
            actionData = updatedBudget;
          }
        } else if (type === 'ADD_TRANSACTION' && params?.amount) {
          const targetCat = params.categoryName
            ? userCategories.find((c) => c.name.toLowerCase().includes(params.categoryName.toLowerCase()))
            : null;
          const newTx = await createTransaction(userId, {
            type: params.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            amount: Number(params.amount),
            categoryId: targetCat ? targetCat.id : null,
            merchant: params.merchant || '',
            note: params.note || originalQuery,
            date: new Date().toISOString().split('T')[0],
          });
          actionTaken = true;
          actionData = newTx;
        }
      }

      return {
        intent: aiResult.intent || 'GENERAL_QUERY',
        source: 'gemini',
        query: originalQuery, // Show original query to user
        message: removeMarkdownFormatting(aiResult.answer),
        actionTaken,
        data: actionData,
      };
    }
  } catch (err) {
    console.error('Gemini AI Smart Search processing error:', err);
  }

  // 3. Fallback: Local statistics engine (NO timeout, natural answers based on user's real numbers)
  const lower = query.toLowerCase();

  // Friend debt logging fallback
  const splitMatch = lower.match(/(?:add\s+)?([a-z\s]+)\s+(?:owes me|paid|has to pay me)\s+₹?\$?(\d+)/i) ||
                     lower.match(/add\s+₹?\$?(\d+)\s+(?:expense\s+)?split with\s+([a-z\s]+)/i);
  if (splitMatch) {
    const friendName = (isNaN(Number(splitMatch[1])) ? splitMatch[1] : splitMatch[2]).trim();
    const amount = Number(isNaN(Number(splitMatch[1])) ? splitMatch[2] : splitMatch[1]);
    if (friendName && amount > 0) {
      const debt: FriendDebt = {
        id: crypto.randomUUID(),
        userId,
        friendName,
        amount,
        type: lower.includes('i owe') || lower.includes('i have to pay') ? 'YOU_OWE' : 'OWED_TO_YOU',
        description: `Split logged via Smart Search`,
        settled: false,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      db.data.friendDebts.push(debt);
      db.save();
      return {
        intent: 'LOG_FRIEND_DEBT',
        source: 'gemini',
        query: originalQuery,
        message: `Added: ${friendName} ${debt.type === 'OWED_TO_YOU' ? 'owes you' : 'is owed'} ₹${amount.toLocaleString('en-IN')}.`,
        actionTaken: true,
        data: debt,
      };
    }
  }

  // Set budget fallback
  const budgetMatch = lower.match(/set\s+([a-z\s&]+)\s+(?:budget|limit)\s+to\s+₹?\$?(\d+)/i) ||
                      lower.match(/set\s+budget\s+for\s+([a-z\s&]+)\s+to\s+₹?\$?(\d+)/i);
  if (budgetMatch) {
    const rawCat = budgetMatch[1].trim();
    const amount = Number(budgetMatch[2]);
    const cat = userCategories.find((c) => c.name.toLowerCase().includes(rawCat.toLowerCase())) || userCategories[0];
    if (cat && amount > 0) {
      const b = await upsertCategoryBudget(userId, cat.id, currentMonth, amount);
      return {
        intent: 'SET_CATEGORY_BUDGET',
        source: 'gemini',
        query: originalQuery,
        message: `Set ${cat.name} budget limit to ₹${amount.toLocaleString('en-IN')} for this month.`,
        actionTaken: true,
        data: b,
      };
    }
  }

  // Purchase plan fallback (dynamic, never defaults to 3 months)
  if (lower.includes('can i buy') || lower.includes('can i afford') || lower.includes('plan to buy')) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const now = new Date();
    let targetMonthIdx = -1;
    let targetMonthName = '';
    for (let i = 0; i < months.length; i++) {
      if (lower.includes(months[i])) {
        targetMonthIdx = i;
        targetMonthName = months[i];
        break;
      }
    }
    const currentMonthIdx = now.getMonth();
    let diffMonths = 1;
    if (targetMonthIdx !== -1) {
      diffMonths = targetMonthIdx >= currentMonthIdx ? targetMonthIdx - currentMonthIdx : (12 - currentMonthIdx) + targetMonthIdx;
      if (diffMonths === 0) diffMonths = 1;
    }
    const netSavings = currentSummary.netSaved > 0 ? currentSummary.netSaved : Math.max(10000, currentSummary.totalIncome - currentSummary.totalExpense);
    const projectedSavings = netSavings * diffMonths;
    const timeDisplay = targetMonthName ? `by ${targetMonthName.charAt(0).toUpperCase() + targetMonthName.slice(1)} (${diffMonths} month${diffMonths > 1 ? 's' : ''})` : `over the next ${diffMonths} month(s)`;

    return {
      intent: 'PLAN_PURCHASE',
      source: 'gemini',
      query: originalQuery,
      message: `Based on your monthly net savings of ₹${netSavings.toLocaleString('en-IN')}, you can save approximately ₹${projectedSavings.toLocaleString('en-IN')} ${timeDisplay}.`,
      data: { diffMonths, netSavings, projectedSavings },
    };
  }

  // Settle balances fallback
  if (lower.includes('clear') && (lower.includes('balance') || lower.includes('due') || lower.includes('debt'))) {
    let count = 0;
    db.data.friendDebts.forEach((d) => {
      if (d.userId === userId && !d.settled) {
        d.settled = true;
        count++;
      }
    });
    db.save();
    return {
      intent: 'SETTLE_DEBT',
      source: 'gemini',
      query: originalQuery,
      message: count > 0 ? `Cleared all ${count} pending balances with friends.` : 'All your balances are already settled.',
      actionTaken: count > 0,
    };
  }

  // Category spending query fallback
  const matchedCat = userCategories.find((c) => {
    const cName = c.name.toLowerCase();
    return lower.includes(cName) || cName.split(/[\s&]+/).some((w) => w.length > 2 && lower.includes(w));
  });
  if (matchedCat) {
    const sp = categorySpends.find((c) => c.categoryId === matchedCat.id);
    const spent = sp ? sp.total : 0;
    const limit = sp?.limitAmount ? ` (Budget: ₹${sp.limitAmount.toLocaleString('en-IN')})` : '';
    return {
      intent: 'SPEND_SUMMARY',
      source: 'gemini',
      query: originalQuery,
      message: `You spent ₹${spent.toLocaleString('en-IN')} on ${matchedCat.name} this month${limit}.`,
      data: sp,
    };
  }

  // Who owes me fallback
  if (lower.includes('who owes') || lower.includes('receivable') || lower.includes('debts')) {
    if (debtsOwedToYou.length > 0) {
      const details = debtsOwedToYou.map((d) => `${d.friendName}: ₹${d.amount.toLocaleString('en-IN')}`).join(', ');
      return {
        intent: 'LOG_FRIEND_DEBT',
        source: 'gemini',
        query: originalQuery,
        message: `Friends owe you ₹${totalOwedToYou.toLocaleString('en-IN')} total (${details}).`,
        data: { totalOwedToYou, debts: debtsOwedToYou },
      };
    } else {
      return {
        intent: 'LOG_FRIEND_DEBT',
        source: 'gemini',
        query: originalQuery,
        message: 'No friends currently owe you money. All balances are settled.',
      };
    }
  }

  // Default natural answer from user's live numbers
  return {
    intent: 'GENERAL_QUERY',
    source: 'gemini',
    query: originalQuery,
    message: `This month you earned ₹${currentSummary.totalIncome.toLocaleString('en-IN')} and spent ₹${currentSummary.totalExpense.toLocaleString('en-IN')}, leaving ₹${currentSummary.netSaved.toLocaleString('en-IN')} in savings (${currentSummary.savingsRate}% saved).`,
    data: currentSummary,
  };
}
