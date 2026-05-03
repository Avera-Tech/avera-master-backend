import { Request, Response } from 'express';
import sequelize from '../config/database';
import Tenant, { TenantPlan } from '../models/Tenant.model';
import Plan from '../models/Plan.model';
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
import { acceptInviteToken } from './inviteController';
import { sendEmail } from '../core/email/emailService';
import Invite from '../models/Invite.model';
import { syncControlTenantConfig } from '../services/controlSyncService';

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
      plan_id,
      name,
      email,
      invite_token,
    } = req.body;

    // ── Required fields validation ────────────────────────────────────────────
    const missing: string[] = [];
    if (!cnpj)         missing.push('cnpj');
    if (!company_name) missing.push('company_name');
    if (!segment)      missing.push('segment');
    if (!city)         missing.push('city');
    if (!courts_count) missing.push('courts_count');
    if (!plan_id)      missing.push('plan_id');
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

    // ── Buscar plano pelo ID ──────────────────────────────────────────────────
    const selectedPlan = await Plan.findOne({ where: { id: plan_id, status: 'active' } });
    if (!selectedPlan) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Plano inválido ou inativo.' });
    }
    const normalizedPlan = selectedPlan.name;

    // ── Verificar email — OTP ou invite token ─────────────────────────────────
    if (invite_token) {
      const invite = await Invite.findOne({
        where: { token: String(invite_token), status: 'pending' },
      });

      if (!invite || invite.email !== normalizedEmail) {
        await t.rollback();
        return res.status(403).json({ success: false, error: 'Invalid or expired invite token.' });
      }

      if (new Date() > invite.expires_at) {
        await invite.update({ status: 'expired' });
        await t.rollback();
        return res.status(403).json({ success: false, error: 'Invite has expired. Request a new one.' });
      }
    } else {
      const emailVerified = await isEmailVerified(normalizedEmail);
      if (!emailVerified) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          error: 'Email not verified. Go back to the verification step.',
        });
      }
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

    // ── Set trial period (from plan) ─────────────────────────────────────────
    const now         = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + selectedPlan.trial_days);

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
        plan:            normalizedPlan as TenantPlan,
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

    // ── Mark invite as accepted (if signup came from an invite link) ──────────
    if (invite_token) {
      await acceptInviteToken(String(invite_token));
    }

    // ── Provision features for this plan (outside transaction — safe to retry)
    await provisionFeatures(tenant.id, normalizedPlan as TenantPlan);

    // ── Provision tenant database (semi-automatic — alerts admin if it fails)
    await provisionTenantDatabase(tenant.id);

    // ── Reload tenant to get updated status (provisionService may have set pending_provision)
    const updatedTenant = await Tenant.findByPk(tenant.id);

    // ── Sync config to Control backend (fire-and-forget) ─────────────────────
    if (updatedTenant) {
      syncControlTenantConfig(updatedTenant).catch((err) =>
        console.error('[signup] controlSync error:', err?.message)
      );
    }

    // ── Notify Avera team about the new registration ──────────────────────────
    await sendNewTenantNotification({
      companyName:  tenant.company_name,
      cnpj:         normalizedCnpj,
      segment:      tenant.segment,
      city:         tenant.city,
      plan:         tenant.plan,
      adminName:    user.name,
      adminEmail:   user.email,
      tenantId:     tenant.id,
      fromInvite:   !!invite_token,
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// sendNewTenantNotification (private)
// Notifica a equipe Avera quando um novo tenant completa o cadastro.
// ─────────────────────────────────────────────────────────────────────────────
interface NewTenantNotificationParams {
  companyName:  string;
  cnpj:         string;
  segment:      string;
  city:         string;
  plan:         string;
  adminName:    string;
  adminEmail:   string;
  tenantId:     number;
  fromInvite:   boolean;
}

const sendNewTenantNotification = async (params: NewTenantNotificationParams): Promise<void> => {
  const teamEmail = process.env.AVERA_TEAM_EMAIL;

  if (!teamEmail) {
    console.warn('[signup] AVERA_TEAM_EMAIL not set — skipping team notification');
    return;
  }

  const {
    companyName, cnpj, segment, city,
    plan, adminName, adminEmail, tenantId, fromInvite,
  } = params;

  const planLabel: Record<string, string> = {
    starter:      'Starter',
    professional: 'Professional',
    enterprise:   'Enterprise',
  };

  const adminPanelUrl = `${process.env.FRONTEND_URL}/admin/tenants/${tenantId}`;

  try {
    await sendEmail({
      to:      teamEmail,
      subject: `[Avera] Novo cadastro — ${companyName}`,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo Cadastro</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#317a52;padding:24px 32px;">
              <img
                src="https://averatech.com.br/assets/avera-logo-white-fFM6UW1P.svg"
                alt="Avera"
                width="120"
                style="display:block;height:auto;border:0;"
              />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827;">
                Novo cadastro realizado!
              </h1>
              ${fromInvite ? `<p style="margin:0 0 24px;font-size:12px;color:#317a52;font-weight:600;">✓ Veio de um convite</p>` : `<p style="margin:0 0 24px;font-size:12px;color:#6b7280;">Cadastro orgânico</p>`}

              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;width:40%;border-bottom:1px solid #e5e7eb;">Empresa</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">CNPJ</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;font-family:monospace;border-bottom:1px solid #e5e7eb;">${cnpj}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">Segmento</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${segment}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">Cidade</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${city}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">Plano</td>
                  <td style="padding:10px 16px;font-size:13px;color:#317a52;font-weight:600;border-bottom:1px solid #e5e7eb;">${planLabel[plan] ?? plan}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">Responsável</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${adminName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f9fafb;font-size:12px;font-weight:700;color:#374151;">Email</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;">${adminEmail}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${adminPanelUrl}"
                       style="display:inline-block;background-color:#317a52;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Ver no painel admin
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                © ${new Date().getFullYear()} Avera. Notificação interna.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    console.log(`[signup] Team notification sent to ${teamEmail}`);
  } catch (err: any) {
    console.error('[signup] Failed to send team notification:', err?.message);
  }
};