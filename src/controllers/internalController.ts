import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Tenant from '../models/Tenant.model';
import User from '../models/User.model';
import Feature from '../models/Feature.model';
import AdminUser from '../models/AdminUser.model';

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/tenant/:slug
// Returns tenant config by slug — used by Core backend and frontend routing.
// ─────────────────────────────────────────────────────────────────────────────
export const getTenantBySlug = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { slug } = req.params;

    const tenant = await Tenant.findOne({
      where: { slug: String(slug).trim().toLowerCase() },
      attributes: ['id', 'company_name', 'slug', 'plan', 'status', 'db_name', 'control_api_url', 'trial_ends_at'],
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    if (tenant.status !== 'active') {
      return res.status(403).json({
        success: false,
        error:   `Tenant account is ${tenant.status}`,
        status:  tenant.status,
      });
    }

    return res.status(200).json({
      success: true,
      tenant: {
        id:              tenant.id,
        company_name:    tenant.company_name,
        slug:            tenant.slug,
        plan:            tenant.plan,
        status:          tenant.status,
        db_name:         tenant.db_name,
        control_api_url: tenant.control_api_url,
        trial_ends_at:   tenant.trial_ends_at,
      },
    });
  } catch (error: any) {
    console.error('[public/tenant/slug]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/seed-admin
// Creates the first Avera admin user. Blocked if any admin already exists.
// Protected by X-Internal-Secret — never exposed to end users.
// ─────────────────────────────────────────────────────────────────────────────
export const seedAdmin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email and password are required' });
    }

    const existing = await AdminUser.count();
    if (existing > 0) {
      return res.status(409).json({ success: false, error: 'Admin users already exist. Use the admin panel to add more.' });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const admin = await AdminUser.create({
      name:     String(name).trim(),
      email:    String(email).trim().toLowerCase(),
      password: hash,
      active:   true,
    });

    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully.',
      user: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (error: any) {
    console.error('[internal/seed-admin]', error);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: error?.message });
  }
};