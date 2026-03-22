import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database';
import Tenant from '../models/Tenant.model';
import User from '../models/User.model';
import { sendPendingOtp, verifyPendingOtp, isEmailVerified, consumePendingOtp } from '../core/email/otpService';
import generateAuthToken from '../core/token/generateAuthToken';

const normalizeEmail = (e?: string) => String(e || '').trim().toLowerCase();
const normalizeCnpj  = (c?: string) => String(c || '').replace(/\D/g, '');

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/send-otp
// Step 1 → Após preencher o Administrador, envia OTP para o e-mail
// Não salva nada no banco ainda
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'E-mail é obrigatório' });

    const normalizedEmail = normalizeEmail(email);

    // Verifica se o e-mail já existe no banco (ativo ou não)
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado. Tente fazer login.' });
    }

    await sendPendingOtp(normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Código de verificação enviado para seu e-mail.',
    });
  } catch (error: any) {
    console.error('[signup/send-otp]', error);
    return res.status(500).json({ success: false, error: 'Erro ao enviar código', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/verify-email
// Step 2 → Valida o OTP. Não cria user ainda, só marca o e-mail como verificado
// ─────────────────────────────────────────────────────────────────────────────
export const verifyEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: 'E-mail e código são obrigatórios' });

    const result = await verifyPendingOtp(normalizeEmail(email), String(code));

    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: 'E-mail verificado com sucesso. Continue o cadastro.',
    });
  } catch (error: any) {
    console.error('[signup/verify-email]', error);
    return res.status(500).json({ success: false, error: 'Erro ao verificar código', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/register
// Step 4 → Confirmação: salva Tenant + User e ativa a conta
// Só executa se o e-mail foi verificado no Step 2
// ─────────────────────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<Response> => {
  const t = await sequelize.transaction();
  let committed = false;

  try {
    const { cnpj, segment, city, courts_count, plan, name, email, phone, password } = req.body;

    // ── Validação básica ──────────────────────────────────────────────────────
    const missing: string[] = [];
    if (!cnpj)         missing.push('cnpj');
    if (!segment)      missing.push('segment');
    if (!city)         missing.push('city');
    if (!courts_count) missing.push('courts_count');
    if (!plan)         missing.push('plan');
    if (!name)         missing.push('name');
    if (!email)        missing.push('email');
    if (!phone)        missing.push('phone');
    if (!password)     missing.push('password');

    if (missing.length > 0) {
      await t.rollback();
      return res.status(400).json({ success: false, error: `Campos obrigatórios ausentes: ${missing.join(', ')}` });
    }

    if (password.length < 6) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedCnpj  = normalizeCnpj(cnpj);

    // ── Garante que o e-mail foi verificado ───────────────────────────────────
    const emailOk = await isEmailVerified(normalizedEmail);
    if (!emailOk) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'E-mail não verificado. Volte ao passo de verificação.' });
    }

    // ── Verifica duplicatas ───────────────────────────────────────────────────
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
    }

    const existingTenant = await Tenant.findOne({ where: { cnpj: normalizedCnpj } });
    if (existingTenant) {
      await t.rollback();
      return res.status(409).json({ success: false, error: 'CNPJ já cadastrado' });
    }

    // ── Cria Tenant (já ativo pois o e-mail foi verificado) ───────────────────
    const tenant = await Tenant.create(
      { cnpj: normalizedCnpj, segment, city, courts_count, plan, status: 'active' },
      { transaction: t }
    );

    // ── Cria User (já ativo) ──────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create(
      { tenant_id: tenant.id, name, email: normalizedEmail, phone, password: passwordHash, role: 'admin', active: 1 },
      { transaction: t }
    );

    await t.commit();
    committed = true;

    // ── Remove o PendingOtp usado ─────────────────────────────────────────────
    await consumePendingOtp(normalizedEmail);

    // ── Gera JWT direto — usuário já pode entrar ──────────────────────────────
    const token = generateAuthToken({ id: user.id, tenantId: tenant.id, name: user.name, role: user.role });

    return res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: tenant.id },
    });
  } catch (error: any) {
    if (!committed) await t.rollback();
    console.error('[signup/register]', error);
    return res.status(500).json({ success: false, error: 'Erro ao realizar cadastro', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup/resend-otp
// Reenvia o código para um e-mail pendente
// ─────────────────────────────────────────────────────────────────────────────
export const resendOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'E-mail é obrigatório' });

    await sendPendingOtp(normalizeEmail(email));

    return res.status(200).json({ success: true, message: 'Novo código enviado para seu e-mail.' });
  } catch (error: any) {
    console.error('[signup/resend-otp]', error);
    return res.status(500).json({ success: false, error: 'Erro ao reenviar código', detail: error?.message });
  }
};