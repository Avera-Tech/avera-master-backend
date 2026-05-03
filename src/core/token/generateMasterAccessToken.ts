import jwt from 'jsonwebtoken';

export interface MasterAccessPayload {
  type:     'master_access';
  clientId: string;
  tenantId: number;
}

export function generateMasterAccessToken(clientId: string, tenantId: number): string {
  const secret = process.env.MASTER_ACCESS_SECRET;
  if (!secret) throw new Error('MASTER_ACCESS_SECRET não definido no .env');

  const payload: MasterAccessPayload = { type: 'master_access', clientId, tenantId };
  return jwt.sign(payload, secret, { expiresIn: '10m' });
}
