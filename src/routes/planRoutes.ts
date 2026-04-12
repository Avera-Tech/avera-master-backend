import { Router } from 'express';
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
} from '../controllers/planController';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

// ─── Plans ────────────────────────────────────────────────────────────────────
router.get   ('/',    adminAuth, listPlans);
router.get   ('/:id', adminAuth, getPlan);
router.post  ('/',    adminAuth, createPlan);
router.put   ('/:id', adminAuth, updatePlan);
router.delete('/:id', adminAuth, deletePlan);

export default router;