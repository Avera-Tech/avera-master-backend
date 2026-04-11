import { Router } from 'express';
import { adminLogin, adminMe, createAdminUser } from '../controllers/adminAuthController';
import {
  listTenants,
  getTenant,
  updateTenantStatus,
  updateTenantPlan,
  getDashboard,
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/authenticateToken';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', adminLogin);
router.get('/auth/me',     adminAuth, adminMe);

// ─── Admin Users ──────────────────────────────────────────────────────────────
router.post('/users', adminAuth, createAdminUser);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', adminAuth, getDashboard);

// ─── Tenants ──────────────────────────────────────────────────────────────────
router.get('/',                        adminAuth, listTenants);
router.get('/:id',                     adminAuth, getTenant);
router.patch('/:id/status',            adminAuth, updateTenantStatus);
router.patch('/:id/plan',              adminAuth, updateTenantPlan);

export default router;