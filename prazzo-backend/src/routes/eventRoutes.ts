import { Router } from 'express';
import { createEvent, listEvents, updateEvent, deleteEvent } from '../controllers/eventController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken as any, createEvent);
router.get('/', authenticateToken as any, listEvents);
router.put('/:id', authenticateToken as any, updateEvent);
router.delete('/:id', authenticateToken as any, deleteEvent);

export default router;
