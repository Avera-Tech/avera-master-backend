import jwt from 'jsonwebtoken';

require('dotenv').config();

const generateResetToken = (userId: number): string => {
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  return jwt.sign({ id: userId, purpose: 'password_reset' }, secret, { expiresIn: '1h' });
};

export default generateResetToken;
