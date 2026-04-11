import { Router } from 'express';
import { me } from '../controllers/authController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticação de usuários de tenant
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Retorna dados do usuário autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário e tenant
 *       401:
 *         description: Não autenticado
 */
router.get('/me', authenticateToken, me);

export default router;
