import { Request, Response } from 'express';
import Tenant from '../models/Tenant.model';
import User from '../models/User.model';
import Feature from '../models/Feature.model';

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/tenant/:email
//
// Called by the Core backend during login to:
//   1. Find the tenant associated with this email
//   2. Confirm the tenant is active
//   3. Return db_name, plan and features so Core can connect to the right DB
//
// Protected by a shared internal secret (INTERNAL_API_SECRET env var)
// Never exposed to end users — internal backend-to-backend only
// ─────────────────────────────────────────────────────────────────────────────
export const getTenantByEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // ── Find user by email ────────────────────────────────────────────────────
    const user = await User.findOne({
      where: { email: normalizedEmail },
      attributes: ['id', 'tenant_id', 'name', 'role', 'active'],
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.active) {
      return res.status(403).json({ success: false, error: 'User account is inactive' });
    }

    // ── Find tenant ───────────────────────────────────────────────────────────
    const tenant = await Tenant.findByPk(user.tenant_id, {
      attributes: [
        'id', 'company_name', 'plan', 'status',
        'db_name', 'trial_ends_at',
      ],
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    if (tenant.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Tenant account is ${tenant.status}`,
        status: tenant.status,
      });
    }

    if (!tenant.db_name) {
      return res.status(503).json({
        success: false,
        error: 'Tenant database not provisioned yet',
      });
    }

    // ── Load enabled features ─────────────────────────────────────────────────
    const features = await Feature.findAll({
      where: { tenant_id: tenant.id, enabled: true },
      attributes: ['feature_name'],
    });

    const enabledFeatures = features.map((f) => f.feature_name);

    // ── Return everything Core needs to connect and build the JWT ─────────────
    return res.status(200).json({
      success: true,
      user: {
        id:   user.id,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id:            tenant.id,
        company_name:  tenant.company_name,
        plan:          tenant.plan,
        status:        tenant.status,
        db_name:       tenant.db_name,
        trial_ends_at: tenant.trial_ends_at,
      },
      features: enabledFeatures,
    });
  } catch (error: any) {
    console.error('[internal/tenant]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};