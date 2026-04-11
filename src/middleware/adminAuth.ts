import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// adminAuth middleware
// Protects admin routes — only tokens with role 'avera_admin' are allowed
// ─────────────────────────────────────────────────────────────────────────────
export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const decoded = jwt.verify(token, secret) as AuthTokenPayload;

    if (decoded.role !== 'avera_admin') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};