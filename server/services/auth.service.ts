import crypto from 'node:crypto';
import { db } from '../db.js';
import { hashPassword, verifyPassword, signJwt, hashRefreshToken, verifyJwt } from '../crypto.js';
import { User, Session } from '../../src/types.js';

export async function signupUser(phone: string, email: string, password: string) {
  const existingEmail = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existingEmail) {
    throw { status: 409, message: 'User with this email already exists' };
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  const newUser: User = {
    id: userId,
    email: email.toLowerCase(),
    phone: phone || '',
    name: '',
    spendingCeiling: 0,
    targetSavings: 0,
    profileSetupCompleted: false,
    createdAt: new Date().toISOString(),
  };

  db.data.users.push(newUser);
  db.data.userPasswords[userId] = passwordHash;

  // Initialize 5 general default categories for new user
  const defaultCats = [
    { name: 'Food & Dining', icon: 'Utensils', color: '#10B981' },
    { name: 'Shopping', icon: 'ShoppingBag', color: '#3B82F6' },
    { name: 'Housing & Rent', icon: 'Home', color: '#8B5CF6' },
    { name: 'Transport & Fuel', icon: 'Car', color: '#F59E0B' },
    { name: 'Entertainment', icon: 'Tv', color: '#EC4899' },
  ];

  defaultCats.forEach((c) => {
    db.data.categories.push({
      id: crypto.randomUUID(),
      userId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      createdAt: new Date().toISOString(),
    });
  });

  const accessToken = signJwt({ id: userId, email: newUser.email }, false, 15);
  const refreshToken = signJwt({ id: userId }, true, 30 * 24 * 60);

  const session: Session = {
    id: crypto.randomUUID(),
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.data.sessions.push(session);
  db.save();

  return { user: newUser, accessToken, refreshToken };
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

export async function loginUser(identifier: string, password: string) {
  const normPhone = normalizePhoneNumber(identifier);
  const user = db.data.users.find((u) => {
    if (u.email.toLowerCase() === identifier.toLowerCase()) return true;
    if (normPhone && u.phone && normalizePhoneNumber(u.phone) === normPhone) return true;
    return false;
  });
  if (!user) {
    throw { status: 401, message: 'Invalid credentials. Check email or mobile number.' };
  }

  const hash = db.data.userPasswords[user.id];
  const valid = await verifyPassword(password, hash);
  if (!valid) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  const accessToken = signJwt({ id: user.id, email: user.email }, false, 15);
  const refreshToken = signJwt({ id: user.id }, true, 30 * 24 * 60);

  const session: Session = {
    id: crypto.randomUUID(),
    userId: user.id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.data.sessions.push(session);
  db.save();

  return { user, accessToken, refreshToken };
}

export async function refreshSessionToken(rawRefreshToken: string) {
  const payload = verifyJwt<{ id: string }>(rawRefreshToken, true);
  if (!payload || !payload.id) {
    throw { status: 401, message: 'Invalid refresh token' };
  }

  const hashed = hashRefreshToken(rawRefreshToken);
  const user = db.data.users.find((u) => u.id === payload.id);
  if (!user) {
    throw { status: 401, message: 'User not found' };
  }

  const session = db.data.sessions.find(
    (s) => s.userId === payload.id && s.refreshTokenHash === hashed && !s.revokedAt
  );

  if (!session) {
    // Grace period: check if this token was revoked within the last 60 seconds (e.g. concurrent refresh calls)
    const recentlyRevoked = db.data.sessions.find(
      (s) =>
        s.userId === payload.id &&
        s.refreshTokenHash === hashed &&
        s.revokedAt &&
        Date.now() - new Date(s.revokedAt).getTime() < 60_000
    );

    if (recentlyRevoked) {
      // Find the active session or issue an access token for this user
      const accessToken = signJwt({ id: user.id, email: user.email }, false, 15);
      return { user, accessToken, refreshToken: rawRefreshToken };
    }

    throw { status: 401, message: 'Session revoked or expired' };
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw { status: 401, message: 'Session expired' };
  }

  // Revoke old session
  session.revokedAt = new Date().toISOString();

  // Rotate tokens
  const accessToken = signJwt({ id: user.id, email: user.email }, false, 15);
  const newRefreshToken = signJwt({ id: user.id }, true, 30 * 24 * 60);

  const newSession: Session = {
    id: crypto.randomUUID(),
    userId: user.id,
    refreshTokenHash: hashRefreshToken(newRefreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.data.sessions.push(newSession);

  // Prune dead sessions to keep data store healthy
  const now = Date.now();
  if (db.data.sessions.length > 50) {
    db.data.sessions = db.data.sessions.filter((s) => {
      if (new Date(s.expiresAt).getTime() < now) return false;
      if (s.revokedAt && now - new Date(s.revokedAt).getTime() > 5 * 60 * 1000) return false;
      return true;
    });
  }

  db.save();

  return { user, accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(rawRefreshToken?: string) {
  if (rawRefreshToken) {
    const hashed = hashRefreshToken(rawRefreshToken);
    const session = db.data.sessions.find((s) => s.refreshTokenHash === hashed);
    if (session) {
      session.revokedAt = new Date().toISOString();
      db.save();
    }
  }
}

export async function loginOrCreateOAuthUser(email: string, displayName?: string, photoURL?: string) {
  let user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    const userId = crypto.randomUUID();
    user = {
      id: userId,
      email: email.toLowerCase(),
      phone: '',
      name: displayName || '',
      spendingCeiling: 0,
      targetSavings: 0,
      profileSetupCompleted: false,
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);

    // Initialize 5 general default categories for new OAuth user
    const defaultCats = [
      { name: 'Food & Dining', icon: 'Utensils', color: '#10B981' },
      { name: 'Shopping', icon: 'ShoppingBag', color: '#3B82F6' },
      { name: 'Housing & Rent', icon: 'Home', color: '#8B5CF6' },
      { name: 'Transport & Fuel', icon: 'Car', color: '#F59E0B' },
      { name: 'Entertainment', icon: 'Tv', color: '#EC4899' },
    ];

    defaultCats.forEach((c) => {
      db.data.categories.push({
        id: crypto.randomUUID(),
        userId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        createdAt: new Date().toISOString(),
      });
    });
  }

  const accessToken = signJwt({ id: user.id, email: user.email }, false, 15);
  const refreshToken = signJwt({ id: user.id }, true, 30 * 24 * 60);

  const session: Session = {
    id: crypto.randomUUID(),
    userId: user.id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.data.sessions.push(session);
  db.save();

  return { user, accessToken, refreshToken };
}

export async function resetUserPassword(identifier: string, newPassword: string) {
  const normPhone = normalizePhoneNumber(identifier);
  const user = db.data.users.find((u) => {
    if (u.email.toLowerCase() === identifier.toLowerCase()) return true;
    if (normPhone && u.phone && normalizePhoneNumber(u.phone) === normPhone) return true;
    return false;
  });
  if (!user) {
    throw { status: 404, message: 'No registered account found with this email or mobile number.' };
  }
  if (!newPassword || newPassword.length < 8) {
    throw { status: 400, message: 'Password must be at least 8 characters long.' };
  }

  const newHash = await hashPassword(newPassword);
  db.data.userPasswords[user.id] = newHash;

  // Revoke existing sessions for security
  db.data.sessions.forEach((s) => {
    if (s.userId === user.id) {
      s.revokedAt = new Date().toISOString();
    }
  });

  db.save();
  return { success: true, message: 'Password has been successfully updated.' };
}

