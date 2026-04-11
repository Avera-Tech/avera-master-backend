import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import AdminUser from '../models/AdminUser.model';
import generateAuthToken from '../core/token/generateAuthToken';

const normalizeEmail = (e?: string) => String(e || '').trim().toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/auth/login
// Login for Avera admin panel — only AdminUser accounts
// ─────────────────────────────────────────────────────────────────────────────
export const adminLogin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios' });
    }

    const admin = await AdminUser.findOne({
      where: { email: normalizeEmail(email) },
    });

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    if (!admin.active) {
      return res.status(403).json({ success: false, error: 'Conta inativa' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const token = generateAuthToken({
      id:       admin.id,
      tenantId: 0,        // 0 = Avera admin, no tenant
      name:     admin.name,
      role:     'avera_admin',
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id:    admin.id,
        name:  admin.name,
        email: admin.email,
        role:  'avera_admin',
      },
    });
  } catch (error: any) {
    console.error('[admin/auth/login]', error);
    return res.status(500).json({ success: false, error: 'Falha ao realizar login', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/auth/me
// Retorna os dados do admin logado
// ─────────────────────────────────────────────────────────────────────────────
export const adminMe = async (req: Request, res: Response): Promise<Response> => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const admin = await AdminUser.findByPk(adminId, {
      attributes: ['id', 'name', 'email', 'active', 'createdAt'],
    });

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Administrador não encontrado' });
    }

    return res.status(200).json({ success: true, user: admin });
  } catch (error: any) {
    console.error('[admin/auth/me]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};