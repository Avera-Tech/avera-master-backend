import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import AdminUser from '../models/AdminUser.model';

const normalizeEmail = (e?: string) => String(e || '').trim().toLowerCase();

const SAFE_ATTRIBUTES = ['id', 'name', 'email', 'active', 'createdAt', 'updatedAt'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users
// Lista todos os usuários admin da Avera com paginação e busca opcionais
// ─────────────────────────────────────────────────────────────────────────────
export const listAdminUsers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { page = 1, limit = 20, search, active } = req.query;

    const where: any = {};

    if (search) {
      where[Op.or] = [
        { name:  { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows: users, count: total } = await AdminUser.findAndCountAll({
      where,
      attributes: [...SAFE_ATTRIBUTES],
      order:  [['createdAt', 'DESC']],
      limit:  Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data: users,
      meta: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('[admin/users/list]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users/:id
// Retorna os dados de um único usuário admin pelo ID
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const admin = await AdminUser.findByPk(id, {
      attributes: [...SAFE_ATTRIBUTES],
    });

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Usuário admin não encontrado' });
    }

    return res.status(200).json({ success: true, data: admin });
  } catch (error: any) {
    console.error('[admin/users/get]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users
// Cria um novo usuário admin da Avera
// ─────────────────────────────────────────────────────────────────────────────
export const createAdminUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Nome, e-mail e senha são obrigatórios' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 8 caracteres' });
    }

    const normalizedEmail = normalizeEmail(email);

    const existing = await AdminUser.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await AdminUser.create({
      name:     name.trim(),
      email:    normalizedEmail,
      password: passwordHash,
      active:   true,
    });

    return res.status(201).json({
      success: true,
      message: `Usuário criado com sucesso`,
      data: {
        id:     admin.id,
        name:   admin.name,
        email:  admin.email,
        active: admin.active,
      },
    });
  } catch (error: any) {
    console.error('[admin/users/create]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /admin/users/:id
// Atualiza nome, e-mail, senha ou status ativo de um usuário admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateAdminUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, email, password, active } = req.body;

    const admin = await AdminUser.findByPk(id);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    if (active === false && req.user?.id === admin.id) {
      return res.status(400).json({ success: false, error: 'Você não pode desativar a sua própria conta' });
    }

    const updates: Partial<{ name: string; email: string; password: string; active: boolean }> = {};

    if (name)              updates.name   = name.trim();
    if (active !== undefined) updates.active = active;

    if (email) {
      const normalizedEmail = normalizeEmail(email);
      const conflict = await AdminUser.findOne({
        where: { email: normalizedEmail, id: { [Op.ne]: id } },
      });
      if (conflict) {
        return res.status(409).json({ success: false, error: 'E-mail já está em uso por outro administrador' });
      }
      updates.email = normalizedEmail;
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 8 caracteres' });
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo válido informado para atualização' });
    }

    await admin.update(updates);

    return res.status(200).json({
      success: true,
      message: `Usuário atualizado com sucesso`,
      data: {
        id:        admin.id,
        name:      admin.name,
        email:     admin.email,
        active:    admin.active,
        updatedAt: admin.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[admin/users/update]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/users/:id
// Remove permanentemente um usuário admin — não é possível deletar a própria conta
// ─────────────────────────────────────────────────────────────────────────────
export const deleteAdminUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    if (req.user?.id === Number(id)) {
      return res.status(400).json({ success: false, error: 'Você não pode excluir a sua própria conta' });
    }

    const admin = await AdminUser.findByPk(id);

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    await admin.destroy();

    return res.status(200).json({
      success: true,
      message: `Usuário excluído com sucesso`,
    });
  } catch (error: any) {
    console.error('[admin/users/delete]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};