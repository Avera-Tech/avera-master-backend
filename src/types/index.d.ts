import { JwtPayload } from 'jsonwebtoken';

export interface AuthTokenPayload {
  id: number;
  tenantId: number;
  name: string;
  role: 'admin' | 'member' | 'avera_admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
