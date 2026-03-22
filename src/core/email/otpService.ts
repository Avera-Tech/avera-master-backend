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
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

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
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

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
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificação de Email - Avera</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #16a34a;
      font-size: 32px;
      margin: 0;
    }
    .code-box {
      background: #f8f9fa;
      border: 2px solid #16a34a;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #16a34a;
      font-family: 'Courier New', monospace;
    }
    .code-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .expiry {
      color: #6b7280;
      font-size: 14px;
      text-align: center;
      margin-top: 10px;
    }
    .info {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    @media only screen and (max-width: 600px) {
      .container { padding: 20px; }
      .code { font-size: 24px; letter-spacing: 4px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Avera</h1>
    </div>

    <h2 style="color: #1f2937; margin-bottom: 10px;">Confirme seu e-mail</h2>
    <p style="color: #6b7280; margin-bottom: 20px;">
      Para continuar o cadastro na Avera, use o código de verificação abaixo:
    </p>

    <div class="code-box">
      <div class="code-label">Seu código de verificação:</div>
      <div class="code">${code}</div>
      <div class="expiry">⏱️ Válido por 10 minutos</div>
    </div>

    <div class="info">
      <strong>💡 Atenção:</strong> Não compartilhe este código com ninguém. A Avera nunca solicita seu código por telefone ou chat.
    </div>

    <div class="footer">
      <p>Se você não solicitou este código, ignore este e-mail.</p>
      <p style="margin-top: 10px;">© ${new Date().getFullYear()} Avera. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
`;