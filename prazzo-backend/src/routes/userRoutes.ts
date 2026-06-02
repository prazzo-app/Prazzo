import { Router } from 'express';
import { deleteAccount } from '../controllers/userController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Aplica o middleware de autenticacao para garantir que apenas o dono pode deletar sua conta
router.delete('/me', authenticateToken as any, deleteAccount);

export default router;
