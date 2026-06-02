import { Router } from 'express';
import { generateShareMessage } from '../controllers/shareController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/whatsapp', authenticateToken, generateShareMessage);

export default router;
