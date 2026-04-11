import { Request, Response } from 'express';
import sequelize from '../config/database';
import Tenant from '../models/Tenant.model';
import User from '../models/User.model';
import { provisionFeatures } from '../services/featureService';
import { provisionTenantDatabase } from '../services/provisionService';
import { slugify, slugToDbName } from '../utils/slugify';
import {
  sendPendingOtp,
  verifyPendingOtp,
  isEmailVerified,
  consumePendingOtp,
} from '../core/email/otpService';
import generateAuthToken from '../core/token/generateAuthToken';

const normalizeEmail = (e?: string) => String(e || '').trim().toLowerCase();
const normalizeCnpj  = (c?: string) => String(c || '').replace(/\D/g, '');

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/send-otp
// Step 1 → Validates email + company_name uniqueness, then sends OTP.
//          Slug conflict is caught here — early, before the user fills all steps.
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, company_name } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    if (!company_name) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    const slug = slugify(company_name);

    if (!slug) {
      return res.status(400).json({ success: false, error: 'Invalid company name. Please use letters and numbers only.' });
    }

    // ── Check email duplicate ─────────────────────────────────────────────────
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already registered. Try logging in.' });
    }

    // ── Check slug duplicate — early conflict detection ───────────────────────
    const existingSlug = await Tenant.findOne({ where: { slug } });
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        error: `The name "${company_name}" is already taken. Please choose a different company name.`,
        field: 'company_name',
        slug,
      });
    }

    await sendPendingOtp(normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email.',
      slug,
      url_preview: `app.averafit.com.br/${slug}`,
    });
  } catch (error: any) {
    console.error('[signup/send-otp]', error);
    return res.status(500).json({ success: false, error: 'Failed to send code', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/verify-email
// Step 2 → Validate OTP. Marks email as verified, creates nothing yet.
// ─────────────────────────────────────────────────────────────────────────────
export const verifyEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and code are required' });
    }

    const result = await verifyPendingOtp(normalizeEmail(email), String(code));

    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Continue with registration.',
    });
  } catch (error: any) {
    console.error('[signup/verify-email]', error);
    return res.status(500).json({ success: false, error: 'Failed to verify code', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/resend-otp
// Resend OTP to a pending email
// ─────────────────────────────────────────────────────────────────────────────
export const resendOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    await sendPendingOtp(normalizeEmail(email));

    return res.status(200).json({ success: true, message: 'New code sent to your email.' });
  } catch (error: any) {
    console.error('[signup/resend-otp]', error);
    return res.status(500).json({ success: false, error: 'Failed to resend code', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/register
// Step 3 → Final confirmation: creates Tenant + User → JWT
//          Feature provisioning is handled separately by featureService
// ─────────────────────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<Response> => {
  const t = await sequelize.transaction();
  let committed = false;

  try {
    const {
      cnpj,
      company_name,
      segment,
      city,
      phone,
      courts_count,
      plan,
      name,
      email,
    } = req.body;

    // ── Required fields validation ────────────────────────────────────────────
    const missing: string[] = [];
    if (!cnpj)         missing.push('cnpj');
    if (!company_name) missing.push('company_name');
    if (!segment)      missing.push('segment');
    if (!city)         missing.push('city');
    if (!courts_count) missing.push('courts_count');
    if (!plan)         missing.push('plan');
    if (!name)         missing.push('name');
    if (!email)        missing.push('email');

    if (missing.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedCnpj  = normalizeCnpj(cnpj);

    // ── Ensure email was verified ─────────────────────────────────────────────
    const emailVerified = await isEmailVerified(normalizedEmail);
    if (!emailVerified) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        error: 'Email not verified. Go back to the verification step.',
      });
    }

    // ── Check for duplicates ──────────────────────────────────────────────────
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const existingTenant = await Tenant.findOne({ where: { cnpj: normalizedCnpj } });
    if (existingTenant) {
      await t.rollback();
      return res.status(409).json({ success: false, error: 'CNPJ already registered' });
    }

    // ── Set trial period (14 days) ────────────────────────────────────────────
    const now         = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // ── Generate slug and db_name ─────────────────────────────────────────────
    const slug   = slugify(company_name);
    const dbName = slugToDbName(slug);

    // ── Double-check slug is still available (race condition guard) ───────────
    const slugTaken = await Tenant.findOne({ where: { slug } });
    if (slugTaken) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        error: `The name "${company_name}" was just taken. Please choose a different company name.`,
        field: 'company_name',
      });
    }

    // ── Create Tenant ─────────────────────────────────────────────────────────
    const tenant = await Tenant.create(
      {
        cnpj:            normalizedCnpj,
        company_name:    company_name.trim(),
        slug,
        segment,
        city,
        phone:           phone ? String(phone).trim() : null,
        courts_count,
        plan,
        status:          'active',
        trial_starts_at: now,
        trial_ends_at:   trialEndsAt,
        db_name:         dbName,
      },
      { transaction: t }
    );

    // ── Create admin User ─────────────────────────────────────────────────────
    const user = await User.create(
      {
        tenant_id: tenant.id,
        name,
        email:     normalizedEmail,
        phone:     phone ? String(phone).trim() : null,
        role:      'admin',
        active:    1,
      },
      { transaction: t }
    );

    await t.commit();
    committed = true;

    // ── Consume used PendingOtp ───────────────────────────────────────────────
    await consumePendingOtp(normalizedEmail);

    // ── Provision features for this plan (outside transaction — safe to retry)
    await provisionFeatures(tenant.id, plan);

    // ── Provision tenant database (semi-automatic — alerts admin if it fails)
    await provisionTenantDatabase(tenant.id);

    // ── Reload tenant to get updated status (provisionService may have set pending_provision)
    const updatedTenant = await Tenant.findByPk(tenant.id);

    // ── Generate JWT ──────────────────────────────────────────────────────────
    const token = generateAuthToken({
      id:       user.id,
      tenantId: tenant.id,
      name:     user.name,
      role:     user.role,
    });

    return res.status(201).json({
      success: true,
      message: 'Registration completed successfully!',
      token,
      user: {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        tenantId: tenant.id,
      },
      tenant: {
        id:            tenant.id,
        company_name:  tenant.company_name,
        slug:          tenant.slug,
        url:           `app.averafit.com.br/${tenant.slug}`,
        plan:          tenant.plan,
        status:        updatedTenant?.status ?? tenant.status,  // ← status atualizado
        db_name:       dbName,
        trial_ends_at: trialEndsAt,
      },
    });
  } catch (error: any) {
    if (!committed) await t.rollback();
    console.error('[signup/register]', error);
    return res.status(500).json({ success: false, error: 'Registration failed', detail: error?.message });
  }
};