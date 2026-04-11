import { Router } from 'express';
import { sendOtp, verifyEmail, register, resendOtp } from '../controllers/signupController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Signup
 *   description: Fluxo de cadastro em 3 chamadas
 */

/**
 * @swagger
 * /signup/send-otp:
 *   post:
 *     summary: "Step 1 — Envia OTP para o e-mail (após preencher Administrador)"
 *     tags: [Signup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código enviado
 *       409:
 *         description: E-mail já cadastrado
 */
router.post('/send-otp', sendOtp);

/**
 * @swagger
 * /signup/verify-email:
 *   post:
 *     summary: "Step 2 — Valida o OTP. Não cria cadastro ainda."
 *     tags: [Signup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: E-mail verificado
 *       400:
 *         description: Código inválido ou expirado
 */
router.post('/verify-email', verifyEmail);

/**
 * @swagger
 * /signup/register:
 *   post:
 *     summary: "Step 4 — Confirmação: salva tudo e retorna JWT"
 *     tags: [Signup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cnpj, segment, city, courts_count, plan, name, email, phone]
 *             properties:
 *               cnpj:
 *                 type: string
 *               segment:
 *                 type: string
 *               city:
 *                 type: string
 *               courts_count:
 *                 type: string
 *               plan:
 *                 type: string
 *                 enum: [starter, professional, enterprise]
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cadastro realizado. Retorna JWT.
 *       403:
 *         description: E-mail não verificado
 *       409:
 *         description: E-mail ou CNPJ já cadastrado
 */
router.post('/register', register);

/**
 * @swagger
 * /signup/resend-otp:
 *   post:
 *     summary: Reenvia código OTP
 *     tags: [Signup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código reenviado
 */
router.post('/resend-otp', resendOtp);

export default router;