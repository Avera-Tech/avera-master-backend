import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

router.get('/', adminAuth, getSettings);
router.put('/', adminAuth, updateSettings);

export default router;
