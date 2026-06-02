import { Request } from 'express';
import { prisma } from '../lib/prisma';

/**
 * P2-SEC: Serviço de Auditoria (Audit Logging).
 * 
 * Este serviço registra ações críticas para fins de compliance,
 * debugging e segurança (SecOps).
 */
export class AuditService {
  /**
   * Registra uma ação de auditoria no banco de dados.
   */
  static async log(req: Request, action: string, resource?: string, payload?: any) {
    try {
      const authUser = (req as any).user;
      const userId = authUser?.id || null;

      // Sanitizar payload para não logar senhas ou dados sensíveis (Padrão PCI/LGPD)
      const sanitizedPayload = payload ? { ...payload } : null;
      if (sanitizedPayload?.password) delete sanitizedPayload.password;
      if (sanitizedPayload?.token) delete sanitizedPayload.token;

      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          payload: sanitizedPayload ? JSON.stringify(sanitizedPayload) : null,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      });
    } catch (error) {
      // Falha no log não deve travar a aplicação (fail-safe), 
      // mas deve ser reportada no log do sistema.
      console.error('[AuditService] Erro ao registrar log:', error);
    }
  }
}
