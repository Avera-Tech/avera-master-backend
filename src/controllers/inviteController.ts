import { Request, Response } from 'express';
import crypto from 'crypto';
import Invite from '../models/Invite.model';
import { sendEmail } from '../core/email/emailService';

const INVITE_EXPIRY_HOURS = 48;

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/invites
// Creates an invite, stores token, and sends the email to the prospect.
// ─────────────────────────────────────────────────────────────────────────────
export const createInvite = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, nome, nomeRemetente } = req.body;
    const adminId = req.user?.id;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const nomeConvidado   = nome         ? String(nome).trim()         : null;
    const nomeSender      = nomeRemetente ? String(nomeRemetente).trim() : 'Equipe Avera';

    // ── Revoke any previous pending invite for this email ────────────────────
    await Invite.update(
      { status: 'revoked' },
      { where: { email: normalizedEmail, status: 'pending' } }
    );

    // ── Generate secure random token ─────────────────────────────────────────
    const token     = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS);

    // ── Persist invite ───────────────────────────────────────────────────────
    const invite = await Invite.create({
      email:      normalizedEmail,
      nome:       nomeConvidado,
      token,
      status:     'pending',
      expires_at: expiresAt,
      created_by: adminId!,
    });

    // ── Send invite email ────────────────────────────────────────────────────
    const signupUrl = `${process.env.FRONTEND_URL}/signup?token=${token}`;
    await sendInviteEmail({ email: normalizedEmail, nomeConvidado, nomeRemetente: nomeSender, signupUrl });

    return res.status(201).json({
      success: true,
      message: `Invite sent to ${normalizedEmail}`,
      invite: {
        id:         invite.id,
        email:      invite.email,
        nome:       invite.nome,
        status:     invite.status,
        expires_at: invite.expires_at,
        created_at: invite.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[invites/create]', error);
    return res.status(500).json({ success: false, error: 'Failed to create invite', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/invites
// Lists all invites with optional status filter.
// ─────────────────────────────────────────────────────────────────────────────
export const listInvites = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { status } = req.query;

    const where: Record<string, any> = {};
    if (status) where.status = status;

    const invites = await Invite.findAll({
      where,
      attributes: ['id', 'email', 'status', 'expires_at', 'created_by', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ success: true, invites });
  } catch (error: any) {
    console.error('[invites/list]', error);
    return res.status(500).json({ success: false, error: 'Failed to list invites', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/invites/:id
// Revokes an invite (marks as revoked — does not delete from DB).
// ─────────────────────────────────────────────────────────────────────────────
export const revokeInvite = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const invite = await Invite.findByPk(id);

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invite not found' });
    }

    if (invite.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Cannot revoke an invite with status "${invite.status}"`,
      });
    }

    await invite.update({ status: 'revoked' });

    return res.status(200).json({ success: true, message: 'Invite revoked successfully' });
  } catch (error: any) {
    console.error('[invites/revoke]', error);
    return res.status(500).json({ success: false, error: 'Failed to revoke invite', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /invites/validate?token=xxx
// Public endpoint — frontend calls this to validate the token before signup.
// ─────────────────────────────────────────────────────────────────────────────
export const validateInviteToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const invite = await Invite.findOne({ where: { token } });

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invalid invite token' });
    }

    // ── Check if already expired in DB ───────────────────────────────────────
    if (invite.status === 'expired' || invite.status === 'revoked') {
      return res.status(410).json({
        success: false,
        error:   `Invite is ${invite.status}`,
        status:  invite.status,
      });
    }

    if (invite.status === 'accepted') {
      return res.status(409).json({
        success: false,
        error:   'Invite has already been used',
        status:  'accepted',
      });
    }

    // ── Check expiry by date ─────────────────────────────────────────────────
    if (new Date() > invite.expires_at) {
      await invite.update({ status: 'expired' });
      return res.status(410).json({
        success: false,
        error:   'Invite has expired',
        status:  'expired',
      });
    }

    return res.status(200).json({
      success: true,
      valid:   true,
      invite: {
        email:      invite.email,
        expires_at: invite.expires_at,
      },
    });
  } catch (error: any) {
    console.error('[invites/validate]', error);
    return res.status(500).json({ success: false, error: 'Failed to validate token', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// acceptInviteToken (internal helper)
// Called by the signup flow after successful registration.
// ─────────────────────────────────────────────────────────────────────────────
export const acceptInviteToken = async (token: string): Promise<void> => {
  await Invite.update(
    { status: 'accepted' },
    { where: { token, status: 'pending' } }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// sendInviteEmail (private)
// ─────────────────────────────────────────────────────────────────────────────
interface InviteEmailParams {
  email:         string;
  nomeConvidado: string | null;
  nomeRemetente: string;
  signupUrl:     string;
}

const sendInviteEmail = async ({
  email,
  nomeConvidado,
  nomeRemetente,
  signupUrl,
}: InviteEmailParams): Promise<void> => {
  const ano            = new Date().getFullYear();
  const saudacao       = nomeConvidado ? nomeConvidado : 'convidado(a)';

  await sendEmail({
    to:      email,
    subject: 'Você foi convidado para a Avera!',
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Convite Avera</title>
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
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">
                Você foi convidado! 🎉
              </h1>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b7280;">
                Olá <strong style="color:#111827;">${saudacao}</strong>,
              </p>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b7280;">
                <strong style="color:#111827;">${nomeRemetente}</strong> convidou você para fazer parte da
                <strong style="color:#317a52;">Avera</strong> — a plataforma completa de gestão para centros esportivos.
              </p>

              <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#6b7280;">
                Com a Avera, você terá acesso a agendamento inteligente, gestão de alunos,
                cobranças automáticas e muito mais. Tudo em um só lugar.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${signupUrl}"
                       style="display:inline-block;background-color:#317a52;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Criar minha conta
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.6;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#317a52;word-break:break-all;background-color:#f3f4f6;padding:10px 12px;border-radius:6px;">
                ${signupUrl}
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px;" />

              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                Se você não esperava este convite, pode ignorar este e-mail com segurança.
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
};
