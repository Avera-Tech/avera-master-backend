import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import OtpCode, { OtpPurpose } from '../../models/OtpCode.model';
import PendingOtp from '../../models/PendingOtp.model';
import { sendEmail } from './emailService';

// ─────────────────────────────────────────────────────────────────────────────
// OTP por EMAIL (sem user criado — usado no fluxo de signup)
// ─────────────────────────────────────────────────────────────────────────────
export const sendPendingOtp = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  await PendingOtp.destroy({ where: { email: normalizedEmail } });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await PendingOtp.create({ email: normalizedEmail, code_hash: codeHash, verified: false, expires_at: expiresAt });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[OTP] Código de signup para ${normalizedEmail}: ${code}`);
  }

  try {
    await sendEmail({ to: normalizedEmail, subject: 'Verificação de e-mail — Avera', html: buildOtpEmail(code) });
  } catch (err: any) {
    console.warn(`[OTP] Falha ao enviar e-mail para ${normalizedEmail}:`, err?.message);
  }
};

export const verifyPendingOtp = async (email: string, code: string): Promise<{ valid: boolean; error?: string }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = await PendingOtp.findOne({
    where: { email: normalizedEmail, expires_at: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });

  if (!otp) return { valid: false, error: 'Código expirado ou não encontrado. Solicite um novo.' };
  if (otp.attempts >= 5) return { valid: false, error: 'Muitas tentativas. Solicite um novo código.' };

  const match = await bcrypt.compare(String(code), otp.code_hash);
  await otp.update({ attempts: otp.attempts + 1 });
  if (!match) return { valid: false, error: 'Código inválido' };

  await otp.update({ verified: true });
  return { valid: true };
};

export const isEmailVerified = async (email: string): Promise<boolean> => {
  const otp = await PendingOtp.findOne({
    where: { email: email.trim().toLowerCase(), verified: true, expires_at: { [Op.gt]: new Date() } },
  });
  return !!otp;
};

export const consumePendingOtp = async (email: string): Promise<void> => {
  await PendingOtp.destroy({ where: { email: email.trim().toLowerCase() } });
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP por USER_ID (reset de senha)
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtpFor = async (userId: number, email: string, purpose: OtpPurpose = 'password_reset'): Promise<void> => {
  await OtpCode.destroy({ where: { user_id: userId, purpose } });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await OtpCode.create({ user_id: userId, code_hash: codeHash, purpose, expires_at: expiresAt });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[OTP] Código de ${purpose} para ${email}: ${code}`);
  }

  try {
    await sendEmail({ to: email, subject: 'Redefinição de senha — Avera', html: buildOtpEmail(code) });
  } catch (err: any) {
    console.warn(`[OTP] Falha ao enviar e-mail para ${email}:`, err?.message);
  }
};

const buildOtpEmail = (code: string): string => `
  <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #fafafa; border-radius: 12px;">
    <h2 style="color: #1a1a1a; margin-bottom: 8px;">Confirme seu e-mail</h2>
    <p style="color: #555; margin-bottom: 24px;">Use o código abaixo para verificar seu e-mail e continuar o cadastro na Avera.</p>
    <div style="background: #fff; border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #111;">${code}</span>
    </div>
    <p style="color: #888; font-size: 13px;">Este código expira em <strong>15 minutos</strong>. Não compartilhe com ninguém.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #aaa; font-size: 12px;">Se você não solicitou isso, ignore este e-mail.</p>
  </div>
`;