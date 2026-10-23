import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../crypto.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Access token missing' });
  }

  const payload = verifyJwt<{ id: string; email: string }>(token, false);
  if (!payload || !payload.id) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
  }

  req.user = { id: payload.id, email: payload.email };
  next();
}
