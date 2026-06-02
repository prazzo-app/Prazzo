import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * SEGURANÇA P0: JWT_SECRET nunca deve ter fallback hardcoded.
 * Razão: Se o .env não for carregado em produção (erro de deploy, container mal configurado),
 * um valor padrão público permite que qualquer pessoa com acesso ao código-fonte forje
 * tokens JWT válidos para QUALQUER userId, obtendo acesso total ao sistema.
 * Decisão: Fail-fast na inicialização (process.exit) é sempre preferível a fail-silent em auth.
 */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET não está configurado no ambiente. Encerrando servidor por segurança.');
  process.exit(1);
}

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];

  // Exige o formato padrão Bearer: 'Authorization: Bearer <token>'
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      // Diferencia token inválido (adulterado) de token expirado para melhor DX no cliente
      const isExpired = err.name === 'TokenExpiredError';
      res.status(403).json({ 
        error: isExpired ? 'Sessão expirada. Faça login novamente.' : 'Token inválido.',
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
      });
      return;
    }
    req.user = user;
    next();
  });
};
