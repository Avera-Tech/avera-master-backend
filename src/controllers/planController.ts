import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Plan from '../models/Plan.model';

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/plans
// Lista todos os planos com paginação e filtro opcional por status
// ─────────────────────────────────────────────────────────────────────────────
export const listPlans = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;

    const where: any = {};

    if (status) where.status = status;

    if (search) {
      where[Op.or] = [
        { name:        { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows: plans, count: total } = await Plan.findAndCountAll({
      where,
      order:  [['price', 'ASC']],
      limit:  Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data: plans,
      meta: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('[admin/plans/list]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/plans/:id
// Retorna os dados de um único plano
// ─────────────────────────────────────────────────────────────────────────────
export const getPlan = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const plan = await Plan.findByPk(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plano não encontrado' });
    }

    return res.status(200).json({ success: true, data: plan });
  } catch (error: any) {
    console.error('[admin/plans/get]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/plans
// Cria um novo plano
// ─────────────────────────────────────────────────────────────────────────────
export const createPlan = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, price, trial_days = 0, description, status = 'active' } = req.body;

    if (!name || price === undefined || price === null) {
      return res.status(400).json({ success: false, error: 'Nome e preço são obrigatórios' });
    }

    if (isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ success: false, error: 'Preço inválido' });
    }

    if (isNaN(Number(trial_days)) || Number(trial_days) < 0) {
      return res.status(400).json({ success: false, error: 'Dias de trial inválido' });
    }

    const allowedStatus = ['active', 'inactive'];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ success: false, error: `Status inválido. Permitidos: ${allowedStatus.join(', ')}` });
    }

    const existing = await Plan.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Já existe um plano com esse nome' });
    }

    const plan = await Plan.create({
      name:        name.trim(),
      price:       Number(price),
      trial_days:  Number(trial_days),
      description: description?.trim() || null,
      status,
    });

    return res.status(201).json({
      success: true,
      message: `Plano criado com sucesso`,
      data: plan,
    });
  } catch (error: any) {
    console.error('[admin/plans/create]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /admin/plans/:id
// Atualiza os dados de um plano existente
// ─────────────────────────────────────────────────────────────────────────────
export const updatePlan = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, price, trial_days, description, status } = req.body;

    const plan = await Plan.findByPk(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plano não encontrado' });
    }

    const updates: Partial<{
      name: string;
      price: number;
      trial_days: number;
      description: string | null;
      status: 'active' | 'inactive';
    }> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, error: 'Nome não pode ser vazio' });
      }
      // Verifica conflito de nome com outro plano
      const conflict = await Plan.findOne({
        where: { name: name.trim(), id: { [Op.ne]: id } },
      });
      if (conflict) {
        return res.status(409).json({ success: false, error: 'Já existe um plano com esse nome' });
      }
      updates.name = name.trim();
    }

    if (price !== undefined) {
      if (isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ success: false, error: 'Preço inválido' });
      }
      updates.price = Number(price);
    }

    if (trial_days !== undefined) {
      if (isNaN(Number(trial_days)) || Number(trial_days) < 0) {
        return res.status(400).json({ success: false, error: 'Dias de trial inválido' });
      }
      updates.trial_days = Number(trial_days);
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (status !== undefined) {
      const allowedStatus = ['active', 'inactive'];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ success: false, error: `Status inválido. Permitidos: ${allowedStatus.join(', ')}` });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo válido informado para atualização' });
    }

    await plan.update(updates);

    return res.status(200).json({
      success: true,
      message: `Plano atualizado com sucesso`,
      data: plan,
    });
  } catch (error: any) {
    console.error('[admin/plans/update]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/plans/:id
// Remove permanentemente um plano
// ─────────────────────────────────────────────────────────────────────────────
export const deletePlan = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const plan = await Plan.findByPk(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plano não encontrado' });
    }

    await plan.destroy();

    return res.status(200).json({
      success: true,
      message: `Plano excluído com sucesso`,
    });
  } catch (error: any) {
    console.error('[admin/plans/delete]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};