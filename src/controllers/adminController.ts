import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { encrypt } from '../utils/crypto';
import Tenant from '../models/Tenant.model';
import User from '../models/User.model';
import Feature from '../models/Feature.model';
import { provisionFeatures } from '../services/featureService';
import { syncControlTenantConfig } from '../services/controlSyncService';

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/tenants
// List all tenants with pagination and optional filters
// ─────────────────────────────────────────────────────────────────────────────
export const listTenants = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page     = 1,
      limit    = 20,
      status,
      plan,
      search,
    } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (plan)   where.plan   = plan;
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
        'plan', 'status', 'trial_ends_at', 'db_name', 'createdAt',
      ],
      order: [['createdAt', 'DESC']],
      limit:  Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data:    tenants,
      meta: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('[admin/tenants/list]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/tenants/:id
// Get tenant details including admin user and features
// ─────────────────────────────────────────────────────────────────────────────
export const getTenant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const adminUser = await User.findOne({
      where: { tenant_id: tenant.id, role: 'admin' },
      attributes: ['id', 'name', 'email', 'phone', 'active', 'createdAt'],
    });

    const features = await Feature.findAll({
      where: { tenant_id: tenant.id },
      attributes: ['feature_name', 'enabled'],
    });

    return res.status(200).json({
      success: true,
      data: {
        ...tenant.toJSON(),
        admin_user: adminUser,
        features,
      },
    });
  } catch (error: any) {
    console.error('[admin/tenants/get]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/tenants/:id/status
// Change tenant status: active | suspended | cancelled
// ─────────────────────────────────────────────────────────────────────────────
export const updateTenantStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['active', 'suspended', 'cancelled', 'pending_provision'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    await tenant.update({ status });
    syncControlTenantConfig(tenant).catch((err) =>
      console.error('[admin/status] controlSync error:', err?.message)
    );

    return res.status(200).json({
      success: true,
      message: `Tenant status updated to "${status}"`,
      data: { id: tenant.id, company_name: tenant.company_name, status },
    });
  } catch (error: any) {
    console.error('[admin/tenants/status]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/tenants/:id/plan
// Change tenant plan and re-sync features automatically
// ─────────────────────────────────────────────────────────────────────────────
export const updateTenantPlan = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    const allowed = ['starter', 'professional', 'enterprise'];
    if (!allowed.includes(plan)) {
      return res.status(400).json({ success: false, error: `Invalid plan. Allowed: ${allowed.join(', ')}` });
    }

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const previousPlan = tenant.plan;
    await tenant.update({ plan });

    // Re-sync features for the new plan
    await provisionFeatures(tenant.id, plan);
    syncControlTenantConfig(tenant).catch((err) =>
      console.error('[admin/plan] controlSync error:', err?.message)
    );

    return res.status(200).json({
      success: true,
      message: `Plan updated from "${previousPlan}" to "${plan}" — features synced`,
      data: { id: tenant.id, company_name: tenant.company_name, plan },
    });
  } catch (error: any) {
    console.error('[admin/tenants/plan]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/tenants/:id/settings
// Update db_name and/or db_password
// ─────────────────────────────────────────────────────────────────────────────
export const updateTenantSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { db_name, db_password } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const updates: Partial<{ db_name: string | null; db_password: string | null }> = {};
    if (db_name !== undefined)        updates.db_name        = db_name        || null;
    if (db_password !== undefined) updates.db_password = db_password ? encrypt(db_password) : null;

    await tenant.update(updates);
    syncControlTenantConfig(tenant).catch((err) =>
      console.error('[admin/settings] controlSync error:', err?.message)
    );

    return res.status(200).json({
      success: true,
      message: 'Tenant settings updated',
      data: { id: tenant.id, db_name: tenant.db_name, db_password: tenant.db_password },
    });
  } catch (error: any) {
    console.error('[admin/tenants/settings]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/dashboard
// Platform overview metrics
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboard = async (req: Request, res: Response): Promise<Response> => {
  try {
    const [total, active, suspended, pendingProvision, byPlan] = await Promise.all([
      Tenant.count(),
      Tenant.count({ where: { status: 'active' } }),
      Tenant.count({ where: { status: 'suspended' } }),
      Tenant.count({ where: { status: 'pending_provision' } }),
      Tenant.findAll({
        attributes: [
          'plan',
          [Tenant.sequelize!.fn('COUNT', Tenant.sequelize!.col('id')), 'count'],
        ],
        group: ['plan'],
        raw: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        tenants: {
          total,
          active,
          suspended,
          pending_provision: pendingProvision,
        },
        by_plan: byPlan,
      },
    });
  } catch (error: any) {
    console.error('[admin/dashboard]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};