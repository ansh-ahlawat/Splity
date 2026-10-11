import 'dotenv/config';
import crypto from 'node:crypto';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    'FATAL SECURITY CONFIGURATION ERROR: Both JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables (.env). Ensure secure random secrets are configured.'
  );
}

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`scrypt:808080:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = hash.split(':');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return resolve(false);
    }
    const salt = parts[2];
    const originalKeyHex = parts[3];
    const originalKey = Buffer.from(originalKeyHex, 'hex');

    if (originalKey.length === 0) return resolve(false);

    crypto.scrypt(password, salt, originalKey.length, (err, derivedKey) => {
      if (err) return resolve(false);
      if (originalKey.length !== derivedKey.length) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(originalKey, derivedKey));
      } catch {
        resolve(false);
      }
    });
  });
}

export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHmac('sha256', JWT_REFRESH_SECRET).update(refreshToken).digest('hex');
}

export function signJwt(payload: object, isRefresh = false, expiresInMinutes = 15): string {
  const secret = isRefresh ? JWT_REFRESH_SECRET : JWT_ACCESS_SECRET;
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + (isRefresh ? 30 * 24 * 60 * 60 : expiresInMinutes * 60);

  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

export function verifyJwt<T = any>(token: string, isRefresh = false): T | null {
  try {
    const secret = isRefresh ? JWT_REFRESH_SECRET : JWT_ACCESS_SECRET;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload as T;
  } catch (err) {
    return null;
  }
}
