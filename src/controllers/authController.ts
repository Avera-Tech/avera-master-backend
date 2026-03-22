import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import User from '../models/User.model';
import Tenant from '../models/Tenant.model';
import OtpCode from '../models/OtpCode.model';
import generateAuthToken from '../core/token/generateAuthToken';
import generateResetToken from '../core/token/generateResetToken';
import { sendOtpFor } from '../core/email/otpService';
import { sendEmail } from '../core/email/emailService';

const normalizeEmail = (e?: string) => String(e || '').trim().toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios' });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos' });
    }

    if (user.active !== 1) {
      // Reenvia OTP silenciosamente
      await sendOtpFor(user.id, user.email, 'signup');
      return res.status(403).json({
        success: false,
        error: 'Conta pendente de verificação. Enviamos um novo código para seu e-mail.',
        requiresVerification: true,
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos' });
    }

    const tenant = await Tenant.findByPk(user.tenant_id);

    const token = generateAuthToken({
      id: user.id,
      tenantId: user.tenant_id,
      name: user.name,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        tenantPlan: tenant?.plan ?? null,
        tenantStatus: tenant?.status ?? null,
      },
    });
  } catch (error: any) {
    console.error('[auth/login]', error);
    return res.status(500).json({ success: false, error: 'Erro ao realizar login', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/forgot-password
// Envia link/código de recuperação de senha
// ─────────────────────────────────────────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'E-mail é obrigatório' });

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ where: { email: normalizedEmail } });

    // Resposta genérica para não revelar cadastros
    const generic = { success: true, message: 'Se o e-mail existir, você receberá as instruções.' };

    if (!user) return res.status(200).json(generic);

    await sendOtpFor(user.id, normalizedEmail, 'password_reset');

    return res.status(200).json(generic);
  } catch (error: any) {
    console.error('[auth/forgot-password]', error);
    return res.status(500).json({ success: false, error: 'Erro ao processar solicitação' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password
// Valida OTP de reset e aplica nova senha
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: 'E-mail, código e nova senha são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ where: { email: normalizedEmail } });

    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const otp = await OtpCode.findOne({
      where: {
        user_id: user.id,
        purpose: 'password_reset',
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otp) return res.status(400).json({ success: false, error: 'Código expirado ou inválido' });
    if (otp.attempts >= 5) return res.status(429).json({ success: false, error: 'Muitas tentativas. Solicite um novo código.' });

    const valid = await bcrypt.compare(String(code), otp.code_hash);
    await otp.update({ attempts: otp.attempts + 1 });

    if (!valid) return res.status(400).json({ success: false, error: 'Código inválido' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: passwordHash, token_version: user.token_version + 1 });
    await otp.destroy();

    return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (error: any) {
    console.error('[auth/reset-password]', error);
    return res.status(500).json({ success: false, error: 'Erro ao redefinir senha' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/me  (rota protegida — exemplo)
// ─────────────────────────────────────────────────────────────────────────────
export const me = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password', 'reset_token'] },
    });

    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const tenant = await Tenant.findByPk(user.tenant_id);

    return res.status(200).json({
      success: true,
      user: {
        ...user.toJSON(),
        tenant: tenant?.toJSON() ?? null,
      },
    });
  } catch (error: any) {
    console.error('[auth/me]', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar usuário' });
  }
};