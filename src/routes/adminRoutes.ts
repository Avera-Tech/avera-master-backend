import { Router } from 'express';
import { adminLogin, adminMe } from '../controllers/adminAuthController';
import {
  listAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from '../controllers/adminUsersController';
import {
  listTenants,
  getTenant,
  updateTenantStatus,
  updateTenantPlan,
  getDashboard,
} from '../controllers/adminController';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', adminLogin);
router.get('/auth/me',     adminAuth, adminMe);

// ─── Admin Users ──────────────────────────────────────────────────────────────
router.get   ('/users',     adminAuth, listAdminUsers);
router.get   ('/users/:id', adminAuth, getAdminUser);
router.post  ('/users',     adminAuth, createAdminUser);
router.put   ('/users/:id', adminAuth, updateAdminUser);
router.delete('/users/:id', adminAuth, deleteAdminUser);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', adminAuth, getDashboard);

// ─── Tenants ──────────────────────────────────────────────────────────────────
router.get   ('/tenants',              adminAuth, listTenants);
router.get   ('/tenants/:id',          adminAuth, getTenant);
router.patch ('/tenants/:id/status',   adminAuth, updateTenantStatus);
router.patch ('/tenants/:id/plan',     adminAuth, updateTenantPlan);

export default router;