import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Payment, { PaymentStatus } from '../models/Payment.model';
import Tenant from '../models/Tenant.model';
import Plan from '../models/Plan.model';
import { createPaymentLink } from '../services/cieloService';

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/payments
// Lista cobranças com filtros opcionais: status, tenant_id, search, page, limit
// ─────────────────────────────────────────────────────────────────────────────
export const listPayments = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { status, tenant_id, search, page = 1, limit = 20 } = req.query;

    const where: any = {};

    if (status)    where.status    = status;
    if (tenant_id) where.tenant_id = Number(tenant_id);

    if (search) {
      where.description = { [Op.like]: `%${search}%` };
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows: payments, count: total } = await Payment.findAndCountAll({
      where,
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'slug'] }],
      order:   [['due_date', 'DESC']],
      limit:   Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data:    payments,
      meta:    { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    console.error('[payments/list]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/payments/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'slug', 'plan'] }],
    });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Cobrança não encontrada' });
    }

    return res.status(200).json({ success: true, data: payment });
  } catch (error: any) {
    console.error('[payments/get]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/payments
// Cria uma cobrança para um tenant.
// Se plan_id for informado, usa o valor do plano automaticamente.
// ─────────────────────────────────────────────────────────────────────────────
export const createPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { tenant_id, amount, description, due_date, plan_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id é obrigatório' });
    }
    if (!due_date) {
      return res.status(400).json({ success: false, error: 'due_date é obrigatório' });
    }

    const tenant = await Tenant.findByPk(tenant_id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
    }

    let finalAmount  = Number(amount);
    let finalDesc    = description ?? null;

    if (plan_id) {
      const plan = await Plan.findByPk(plan_id);
      if (!plan) {
        return res.status(404).json({ success: false, error: 'Plano não encontrado' });
      }
      if (!finalAmount)  finalAmount = Number(plan.price);
      if (!finalDesc)    finalDesc   = `Mensalidade — ${plan.name}`;
    }

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valor inválido' });
    }

    const payment = await Payment.create({
      tenant_id: Number(tenant_id),
      amount:    finalAmount,
      due_date:  new Date(due_date),
      status:    'pending',
      description: finalDesc,
    });

    // Gera link de pagamento (stub — retorna null até Cielo ser configurado)
    const paymentLink = await createPaymentLink(payment);

    return res.status(201).json({
      success:      true,
      data:         payment,
      payment_link: paymentLink,
    });
  } catch (error: any) {
    console.error('[payments/create]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/payments/:id/status
// Atualiza o status de uma cobrança (pago, cancelado, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export const updatePaymentStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { status, payment_method, paid_at } = req.body;

    const validStatuses: PaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled', 'refunded'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status inválido. Use: ${validStatuses.join(', ')}` });
    }

    const payment = await Payment.findByPk(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Cobrança não encontrada' });
    }

    const updates: Partial<{ status: PaymentStatus; payment_method: any; paid_at: Date | null }> = { status };

    if (payment_method) updates.payment_method = payment_method;

    if (status === 'paid') {
      updates.paid_at = paid_at ? new Date(paid_at) : new Date();
    } else {
      updates.paid_at = null;
    }

    await payment.update(updates);

    return res.status(200).json({ success: true, data: payment });
  } catch (error: any) {
    console.error('[payments/status]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/payments/:id
// Cancela uma cobrança (soft delete — só muda status para cancelled)
// ─────────────────────────────────────────────────────────────────────────────
export const cancelPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    const payment = await Payment.findByPk(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Cobrança não encontrada' });
    }

    if (payment.status === 'paid') {
      return res.status(409).json({ success: false, error: 'Não é possível cancelar uma cobrança já paga' });
    }

    await payment.update({ status: 'cancelled' });

    return res.status(200).json({ success: true, message: 'Cobrança cancelada' });
  } catch (error: any) {
    console.error('[payments/cancel]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/payments/:id/payment-link
// Gera (ou regera) o link de pagamento via Cielo
// ─────────────────────────────────────────────────────────────────────────────
export const generatePaymentLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const payment = await Payment.findByPk(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Cobrança não encontrada' });
    }

    if (payment.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Só é possível gerar link para cobranças pendentes' });
    }

    const link = await createPaymentLink(payment);

    return res.status(200).json({
      success:      true,
      payment_link: link,
      message:      link ? 'Link gerado com sucesso' : 'Cielo ainda não configurada — link indisponível',
    });
  } catch (error: any) {
    console.error('[payments/link]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};
