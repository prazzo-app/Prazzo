import { Router, raw } from 'express';
import { createCheckoutSession, handleStripeWebhook } from '../controllers/billingController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/checkout', authenticateToken as any, createCheckoutSession);
router.post('/webhook', raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
