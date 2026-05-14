import { Router } from 'express';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/clientController';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

router.get   ('/',    adminAuth, listClients);
router.get   ('/:id', adminAuth, getClient);
router.post  ('/',    adminAuth, createClient);
router.put   ('/:id', adminAuth, updateClient);
router.delete('/:id', adminAuth, deleteClient);

export default router;
