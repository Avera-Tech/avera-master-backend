import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '../../types';

require('dotenv').config();

const generateAuthToken = (payload: AuthTokenPayload): string => {
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

export default generateAuthToken;
