import { Router } from 'express';
import {
  listPayments,
  getPayment,
  createPayment,
  updatePaymentStatus,
  cancelPayment,
  generatePaymentLink,
} from '../controllers/paymentController';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

router.get   ('/',               adminAuth, listPayments);
router.get   ('/:id',            adminAuth, getPayment);
router.post  ('/',               adminAuth, createPayment);
router.patch ('/:id/status',     adminAuth, updatePaymentStatus);
router.delete('/:id',            adminAuth, cancelPayment);
router.post  ('/:id/payment-link', adminAuth, generatePaymentLink);

export default router;
