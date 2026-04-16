import { Router } from 'express';
import { validateInviteToken } from '../controllers/inviteController';

const router = Router();

// ─── Public — no auth required ───────────────────────────────────────────────
// GET /invites/validate?token=xxx
router.get('/validate', validateInviteToken);

export default router;
