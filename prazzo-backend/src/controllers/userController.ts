import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const userId = authUser.id;
    console.log(`[UserController] Iniciando exclusão da conta do usuário ${userId}...`);

    // Com onDelete: Cascade configurado no Prisma, basta excluir o usuário.
    // Todos os Cases, Events, Deadlines e Notifications atrelados a ele serão excluídos automaticamente.
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log(`[UserController] Conta e dados do usuário ${userId} excluídos com sucesso (LGPD aplicável).`);
    res.status(200).json({ message: 'Conta e todos os dados associados foram excluídos com sucesso.' });
  } catch (error: any) {
    console.error('[UserController] Erro ao excluir conta:', error);
    res.status(500).json({ error: 'Erro ao excluir conta. Caso o erro persista, entre em contato com o suporte.' });
  }
};
