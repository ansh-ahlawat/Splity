import { db, Friend, FriendGroup, FriendDebt } from '../db.js';
import crypto from 'node:crypto';
import { createNotification } from './notification.service.js';
import { normalizePhoneNumber } from './auth.service.js';

// Get all friends for user (including reciprocal friends linked by phone)
export async function getFriends(userId: string): Promise<Friend[]> {
  if (!db.data.friends) db.data.friends = [];
  const currentUser = db.data.users.find((u) => u.id === userId);
  const myNormPhone = currentUser?.phone ? normalizePhoneNumber(currentUser.phone) : '';

  // Direct friends added by this user
  const directFriends = db.data.friends.filter((f) => f.userId === userId);

  // Reciprocal inbound friends: other users who added this user's mobile number
  const inboundFriends: Friend[] = [];
  if (myNormPhone) {
    const matchingFriendsFromOthers = db.data.friends.filter(
      (f) => f.userId !== userId && f.phone && normalizePhoneNumber(f.phone) === myNormPhone
    );

    for (const mf of matchingFriendsFromOthers) {
      const creatorUser = db.data.users.find((u) => u.id === mf.userId);
      if (creatorUser) {
        const creatorNormPhone = creatorUser.phone ? normalizePhoneNumber(creatorUser.phone) : '';
        const creatorDisplayName = creatorUser.email.split('@')[0] || 'Friend';

        const alreadyExists = directFriends.some(
          (df) =>
            (creatorNormPhone && df.phone && normalizePhoneNumber(df.phone) === creatorNormPhone) ||
            df.name.toLowerCase() === creatorDisplayName.toLowerCase()
        );

        if (!alreadyExists && !inboundFriends.some((ib) => ib.phone && normalizePhoneNumber(ib.phone) === creatorNormPhone)) {
          inboundFriends.push({
            id: `reciprocal-${mf.id}`,
            userId,
            name: creatorDisplayName,
            phone: creatorUser.phone || '+91 98765 00000',
            createdAt: mf.createdAt,
          });
        }
      }
    }
  }

  return [...directFriends, ...inboundFriends];
}

// Add a friend
export async function createFriend(userId: string, name: string, phone?: string): Promise<Friend> {
  if (!db.data.friends) db.data.friends = [];
  const friendPhone = phone || '+91 98765 00000';
  const normPhone = normalizePhoneNumber(friendPhone);

  // Avoid creating duplicate friends with same phone
  const existing = db.data.friends.find(
    (f) => f.userId === userId && (f.name.toLowerCase() === name.toLowerCase() || (normPhone && f.phone && normalizePhoneNumber(f.phone) === normPhone))
  );
  if (existing) {
    return existing;
  }

  const friend: Friend = {
    id: crypto.randomUUID(),
    userId,
    name,
    phone: friendPhone,
    createdAt: new Date().toISOString(),
  };
  db.data.friends.push(friend);
  db.save();

  createNotification(userId, {
    type: 'FRIEND_ADDED',
    category: 'Friends',
    message: `Added ${friend.name} (${friend.phone}) to your friends list.`,
  });

  // If the friend already has an account by this mobile number, notify them too
  if (normPhone) {
    const friendUser = db.data.users.find((u) => u.phone && normalizePhoneNumber(u.phone) === normPhone);
    const currentUser = db.data.users.find((u) => u.id === userId);
    if (friendUser && currentUser && friendUser.id !== userId) {
      createNotification(friendUser.id, {
        type: 'FRIEND_ADDED',
        category: 'Friends',
        message: `${currentUser.email.split('@')[0]} added you as a friend on Splity!`,
      });
    }
  }

  return friend;
}

// Delete a friend
export async function deleteFriend(userId: string, friendId: string): Promise<Friend> {
  if (!db.data.friends) db.data.friends = [];
  const idx = db.data.friends.findIndex((f) => f.id === friendId && f.userId === userId);
  if (idx === -1) {
    // If it's a virtual reciprocal friend, just return a dummy
    return { id: friendId, userId, name: 'Friend', createdAt: new Date().toISOString() };
  }
  const [removed] = db.data.friends.splice(idx, 1);
  db.save();

  createNotification(userId, {
    type: 'FRIEND_DELETED',
    category: 'Friends',
    message: `Removed ${removed.name} from your friends list.`,
  });

  return removed;
}

// Get all groups for user
export async function getFriendGroups(userId: string): Promise<FriendGroup[]> {
  if (!db.data.friendGroups) db.data.friendGroups = [];
  return db.data.friendGroups.filter((g) => g.userId === userId);
}

// Create a group
export async function createFriendGroup(userId: string, name: string, members: string[], description?: string): Promise<FriendGroup> {
  if (!db.data.friendGroups) db.data.friendGroups = [];
  const group: FriendGroup = {
    id: crypto.randomUUID(),
    userId,
    name,
    description,
    members,
    createdAt: new Date().toISOString(),
  };
  db.data.friendGroups.push(group);
  db.save();
  return group;
}

// Get all debts for user (including reciprocal debts from other users by mobile number)
export async function getFriendDebts(userId: string): Promise<FriendDebt[]> {
  if (!db.data.friendDebts) db.data.friendDebts = [];
  const currentUser = db.data.users.find((u) => u.id === userId);
  const myNormPhone = currentUser?.phone ? normalizePhoneNumber(currentUser.phone) : '';

  // Direct debts created by this user
  const directDebts = db.data.friendDebts.filter((d) => d.userId === userId);

  // Reciprocal debts created by other users who referenced this user's mobile number
  const inboundDebts: FriendDebt[] = [];
  if (myNormPhone) {
    const matchingOthers = db.data.friendDebts.filter(
      (d) => d.userId !== userId && d.friendPhone && normalizePhoneNumber(d.friendPhone) === myNormPhone
    );

    for (const od of matchingOthers) {
      // Invert type for recipient:
      // If creator logged YOU_OWE (creator owes friend), friend is OWED_TO_YOU (creator owes you)
      // If creator logged OWED_TO_YOU (friend owes creator), friend is YOU_OWE (you owe creator)
      const reciprocalType: 'YOU_OWE' | 'OWED_TO_YOU' =
        od.type === 'YOU_OWE' ? 'OWED_TO_YOU' : 'YOU_OWE';

      inboundDebts.push({
        ...od,
        id: `reciprocal-${od.id}`,
        userId,
        friendName: od.creatorName || 'Friend',
        type: reciprocalType,
      });
    }
  }

  return [...directDebts, ...inboundDebts];
}

// Get debt summary (total you owe vs owed to you)
export async function getDebtSummary(userId: string) {
  const allDebts = await getFriendDebts(userId);
  const activeDebts = allDebts.filter((d) => !d.settled);

  let youOweTotal = 0;
  let owedToYouTotal = 0;

  activeDebts.forEach((d) => {
    if (d.type === 'YOU_OWE') {
      youOweTotal += d.amount;
    } else {
      owedToYouTotal += d.amount;
    }
  });

  const friends = await getFriends(userId);

  return {
    youOweTotal,
    owedToYouTotal,
    netBalance: owedToYouTotal - youOweTotal,
    debts: activeDebts,
    settledCount: friends.length,
  };
}

// Add a debt entry
export async function createFriendDebt(
  userId: string,
  friendName: string,
  amount: number,
  type: 'YOU_OWE' | 'OWED_TO_YOU',
  description: string,
  groupId?: string
): Promise<FriendDebt> {
  if (!db.data.friendDebts) db.data.friendDebts = [];
  if (!db.data.friends) db.data.friends = [];

  const currentUser = db.data.users.find((u) => u.id === userId);
  const creatorName = currentUser?.email.split('@')[0] || 'Friend';

  // Find if friendName has a phone number registered
  const matchedFriend = db.data.friends.find(
    (f) => f.userId === userId && f.name.toLowerCase() === friendName.toLowerCase()
  );
  const friendPhone = matchedFriend?.phone || null;
  const matchedGroup = groupId ? db.data.friendGroups.find((g) => g.id === groupId) : null;

  const debt: FriendDebt = {
    id: crypto.randomUUID(),
    userId,
    friendName,
    friendPhone,
    creatorName,
    groupId: groupId || null,
    groupName: matchedGroup ? matchedGroup.name : null,
    amount,
    type,
    description,
    settled: false,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

  db.data.friendDebts.push(debt);
  db.save();

  if (debt.type === 'YOU_OWE') {
    createNotification(userId, {
      type: 'EXPENSE_ADDED',
      category: 'Expenses',
      message: `Split expense: You owe ${friendName} ₹${amount.toLocaleString('en-IN')} for ${description}.`,
    });
  } else {
    createNotification(userId, {
      type: 'FRIEND_ACTIVITY',
      category: 'Friends',
      message: `Split balance: ${friendName} owes you ₹${amount.toLocaleString('en-IN')} for ${description}.`,
    });
  }

  // Also notify the friend in real time if they have an account by this mobile number
  if (friendPhone) {
    const normPhone = normalizePhoneNumber(friendPhone);
    const friendUser = db.data.users.find((u) => u.phone && normalizePhoneNumber(u.phone) === normPhone);
    if (friendUser && friendUser.id !== userId) {
      createNotification(friendUser.id, {
        type: debt.type === 'YOU_OWE' ? 'FRIEND_ACTIVITY' : 'EXPENSE_ADDED',
        category: 'Expenses',
        message:
          debt.type === 'YOU_OWE'
            ? `${creatorName} recorded that they owe you ₹${amount.toLocaleString('en-IN')} for ${description}.`
            : `${creatorName} added a split: You owe ₹${amount.toLocaleString('en-IN')} for ${description}.`,
      });
    }
  }

  return debt;
}

// Settle a debt
export async function settleFriendDebt(userId: string, debtId: string): Promise<FriendDebt> {
  if (!db.data.friendDebts) db.data.friendDebts = [];
  const currentUser = db.data.users.find((u) => u.id === userId);
  const myNormPhone = currentUser?.phone ? normalizePhoneNumber(currentUser.phone) : '';

  // Clean reciprocal prefix if present
  const cleanId = debtId.startsWith('reciprocal-') ? debtId.replace('reciprocal-', '') : debtId;

  const debt = db.data.friendDebts.find((d) => {
    if (d.id === cleanId) {
      if (d.userId === userId) return true;
      if (myNormPhone && d.friendPhone && normalizePhoneNumber(d.friendPhone) === myNormPhone) return true;
    }
    return false;
  });

  if (!debt) throw { status: 404, message: 'Debt record not found' };

  debt.settled = true;
  db.save();

  createNotification(userId, {
    type: 'EXPENSE_SETTLED',
    category: 'Expenses',
    message: `Settled split balance of ₹${debt.amount.toLocaleString('en-IN')} with ${debt.friendName}.`,
  });

  // Also notify creator/friend if reciprocal
  if (debt.userId !== userId) {
    createNotification(debt.userId, {
      type: 'EXPENSE_SETTLED',
      category: 'Expenses',
      message: `${currentUser?.email.split('@')[0] || 'Friend'} marked the ₹${debt.amount.toLocaleString('en-IN')} split as settled.`,
    });
  }

  return debt;
}
