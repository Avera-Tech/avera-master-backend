import { Router } from 'express';
import { getTenantByEmail, seedAdmin } from '../controllers/internalController';
import { internalAuth } from '../middleware/internalAuth';

const router = Router();

/**
 * @route  GET /internal/tenant/:email
 * @desc   Returns tenant + user + features for a given email
 * @access Internal — backend-to-backend only (X-Internal-Secret header required)
 *
 * Used by the Core backend during login to:
 *  - Validate the tenant exists and is active
 *  - Get the db_name to connect to the right database
 *  - Get enabled features to include in the JWT
 */
router.get ('/tenant/:email', internalAuth, getTenantByEmail);
router.post('/seed-admin',    seedAdmin);

export default router;