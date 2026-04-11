import { Request, Response } from 'express';
import User from '../models/User.model';
import Tenant from '../models/Tenant.model';

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/me  (rota protegida)
// ─────────────────────────────────────────────────────────────────────────────
export const me = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const tenant = await Tenant.findByPk(user.tenant_id);

    return res.status(200).json({
      success: true,
      user: {
        ...user.toJSON(),
        tenant: tenant?.toJSON() ?? null,
      },
    });
  } catch (error: any) {
    console.error('[auth/me]', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar usuário' });
  }
};
