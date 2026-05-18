import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Tenant from '../models/Tenant.model';
import User   from '../models/User.model';
import Feature from '../models/Feature.model';
import { decrypt } from '../utils/crypto';
import { sendEmail } from '../core/email/emailService';

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

    if (typeof search === 'string' && search) {
      const s = search;
      where[Op.or] = [
        { company_name: { [Op.like]: `%${s}%` } },
        { cnpj:         { [Op.like]: `%${s}%` } },
        { city:         { [Op.like]: `%${s}%` } },
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
// DELETE /admin/tenants/:id
// Remove um tenant e seus dados associados (users, features)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTenant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
    }

    // Apaga usuários e features associados antes de remover o tenant
    await User.destroy({ where: { tenant_id: tenant.id } });
    await Feature.destroy({ where: { tenant_id: tenant.id } });
    await tenant.destroy();

    return res.json({ success: true, message: 'Cliente removido com sucesso.' });
  } catch (error: any) {
    console.error('[admin/tenants/delete]', error);
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/tenants/:id/notify-ready
// Envia e-mail ao admin do tenant informando que o servidor está pronto
// ─────────────────────────────────────────────────────────────────────────────
export const notifyTenantReady = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id, {
      attributes: ['id', 'company_name', 'slug'],
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
    }

    const adminUser = await User.findOne({
      where:      { tenant_id: tenant.id, role: 'admin' },
      attributes: ['name', 'email'],
    });

    if (!adminUser) {
      return res.status(422).json({
        success: false,
        error:   'Este tenant ainda não possui um usuário administrador. Inicialize-o primeiro.',
      });
    }

    const appBase  = (process.env.CLIENT_APP_URL ?? 'https://averafit.app').replace(/\/$/, '');
    const loginUrl = `${appBase}/login`;
    const ano      = new Date().getFullYear();

    await sendEmail({
      to:      adminUser.email,
      subject: 'Seu servidor está pronto! 🚀',
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Servidor pronto</title>
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
                src="https://averafit.app/assets/avera-logo-white-fFM6UW1P.svg"
                alt="Avera"
                width="120"
                style="display:block;height:auto;border:0;"
              />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">
                Seu servidor está pronto! 🚀
              </h1>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b7280;">
                Olá <strong style="color:#111827;">${adminUser.name}</strong>,
              </p>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b7280;">
                Temos uma ótima notícia! O ambiente da
                <strong style="color:#111827;">${tenant.company_name}</strong>
                na <strong style="color:#317a52;">Avera</strong> foi configurado e está pronto para uso.
              </p>

              <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#6b7280;">
                Agora você já pode acessar o painel e começar a explorar todas as funcionalidades da plataforma.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}"
                       style="display:inline-block;background-color:#317a52;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Acessar meu painel
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.6;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#317a52;word-break:break-all;background-color:#f3f4f6;padding:10px 12px;border-radius:6px;">
                ${loginUrl}
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px;" />

              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                Em caso de dúvidas, entre em contato com nosso suporte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                © ${ano} Avera. Todos os direitos reservados.
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

    return res.status(200).json({
      success: true,
      message: `E-mail enviado para ${adminUser.email}`,
    });
  } catch (error: any) {
    console.error('[admin/tenants/notify-ready]', error);
    return res.status(500).json({ success: false, error: 'Erro ao enviar e-mail', detail: error?.message });
  }
};