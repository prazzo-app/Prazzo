import { Router } from 'express';
import { createCase, listCases } from '../controllers/caseController';

import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken as any, createCase);
router.get('/', authenticateToken as any, listCases);

export default router;
