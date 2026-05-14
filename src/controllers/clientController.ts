import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Client from '../models/Client.model';

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/clients
// ─────────────────────────────────────────────────────────────────────────────
export const listClients = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    const where: any = {};
    if (search) {
      where[Op.or] = [
        { name:    { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } },
        { email:   { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows: clients, count: total } = await Client.findAndCountAll({
      where,
      order:  [['name', 'ASC']],
      limit:  Number(limit),
      offset,
    });

    return res.json({
      success: true,
      data:    clients,
      meta:    { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    console.error('[clients/list]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getClient = async (req: Request, res: Response): Promise<Response> => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    return res.json({ success: true, data: client });
  } catch (error: any) {
    console.error('[clients/get]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/clients
// ─────────────────────────────────────────────────────────────────────────────
export const createClient = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, phone, company, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name é obrigatório' });
    }

    const client = await Client.create({
      name,
      email:   email   ?? null,
      phone:   phone   ?? null,
      company: company ?? null,
      notes:   notes   ?? null,
    });

    return res.status(201).json({ success: true, data: client });
  } catch (error: any) {
    console.error('[clients/create]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /admin/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateClient = async (req: Request, res: Response): Promise<Response> => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    const { name, email, phone, company, notes } = req.body;

    await client.update({
      ...(name    !== undefined && { name }),
      ...(email   !== undefined && { email:   email   ?? null }),
      ...(phone   !== undefined && { phone:   phone   ?? null }),
      ...(company !== undefined && { company: company ?? null }),
      ...(notes   !== undefined && { notes:   notes   ?? null }),
    });

    return res.json({ success: true, data: client });
  } catch (error: any) {
    console.error('[clients/update]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteClient = async (req: Request, res: Response): Promise<Response> => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    await client.destroy();
    return res.json({ success: true, message: 'Cliente removido' });
  } catch (error: any) {
    console.error('[clients/delete]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};
