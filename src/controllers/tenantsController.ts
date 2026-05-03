import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Tenant from '../models/Tenant.model';
import User   from '../models/User.model';
import Feature from '../models/Feature.model';
import { decrypt } from '../utils/crypto';

// ─── Valores permitidos ───────────────────────────────────────────────────────

const ALLOWED_PLANS   = ['starter', 'professional', 'enterprise'] as const;
const ALLOWED_STATUSES = ['pending', 'active', 'pending_provision', 'suspended', 'cancelled'] as const;

type AllowedPlan   = typeof ALLOWED_PLANS[number];
type AllowedStatus = typeof ALLOWED_STATUSES[number];

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/tenants
// Lista todos os tenants com paginação e filtros opcionais
// Query params: page, limit, search, plan, status
// ─────────────────────────────────────────────────────────────────────────────
export const listTenants = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page   = 1,
      limit  = 20,
      search,
      plan,
      status,
    } = req.query;

    // ── Validação dos filtros ─────────────────────────────────────────────────
    if (plan && !ALLOWED_PLANS.includes(plan as AllowedPlan)) {
      return res.status(400).json({
        success: false,
        error: `Plano inválido. Permitidos: ${ALLOWED_PLANS.join(', ')}`,
      });
    }

    if (status && !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
      return res.status(400).json({
        success: false,
        error: `Status inválido. Permitidos: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    // ── Montagem do filtro ────────────────────────────────────────────────────
    const where: any = {};

    if (plan)   where.plan   = plan;
    if (status) where.status = status;

    if (search) {
      where[Op.or] = [
        { company_name: { [Op.like]: `%${search}%` } },
        { cnpj:         { [Op.like]: `%${search}%` } },
        { city:         { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows: tenants, count: total } = await Tenant.findAndCountAll({
      where,
      attributes: [
        'id', 'company_name', 'cnpj', 'segment', 'city',
        'courts_count', 'plan', 'status', 'trial_ends_at', 'createdAt',
      ],
      order:  [['createdAt', 'DESC']],
      limit:  Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data: tenants,
      meta: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('[admin/tenants/list]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/tenants/:id
// Retorna os dados completos de um tenant: cnpj, segment, city,
// courts_count, plan, status + usuário admin + features habilitadas
// ─────────────────────────────────────────────────────────────────────────────
export const getTenant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id, {
      attributes: [
        'id', 'company_name', 'cnpj', 'slug', 'segment', 'city',
        'phone', 'courts_count', 'plan', 'status',
        'trial_starts_at', 'trial_ends_at', 'db_name', 'db_password', 'createdAt', 'updatedAt',
      ],
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
    }

    const adminUser = await User.findOne({
      where:      { tenant_id: tenant.id, role: 'admin' },
      attributes: ['id', 'name', 'email', 'phone', 'active', 'createdAt'],
    });

    const features = await Feature.findAll({
      where:      { tenant_id: tenant.id },
      attributes: ['feature_name', 'enabled'],
      order:      [['feature_name', 'ASC']],
    });

    const tenantData = tenant.toJSON() as Record<string, unknown>;
    if (tenantData.db_password) {
      try { tenantData.db_password = decrypt(tenantData.db_password as string); }
      catch { /* mantém o valor se falhar a descriptografia */ }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...tenantData,
        admin_user: adminUser,
        features,
      },
    });
  } catch (error: any) {
    console.error('[admin/tenants/get]', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', detail: error?.message });
  }
};