import { Request, Response, NextFunction } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// internalAuth middleware
//
// Protects routes that are only meant for backend-to-backend communication.
// The Core backend must send the shared secret in the request header:
//   X-Internal-Secret: <INTERNAL_API_SECRET>
//
// Set INTERNAL_API_SECRET in .env — use a strong random string (32+ chars).
// This secret must be the same in both Master and Core .env files.
// ─────────────────────────────────────────────────────────────────────────────
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const secret = req.headers['x-internal-secret'];
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error('[internalAuth] INTERNAL_API_SECRET is not set in environment');
    res.status(500).json({ success: false, error: 'Server misconfiguration' });
    return;
  }

  if (!secret || secret !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  next();
};