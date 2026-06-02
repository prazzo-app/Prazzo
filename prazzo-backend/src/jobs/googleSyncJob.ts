import nodeCron from 'node-cron';
import { prisma } from '../lib/prisma';
import { googleCalendarService } from '../services/googleCalendarService';

/**
 * Cron Job para Sincronização Inbound (Google -> Prazzo)
 * Executa a cada 15 minutos para todos os usuários que conectaram o Google.
 */
export const startGoogleSyncJob = () => {
  console.log('[Cron] Configurando job de sincronização Google API (15 min)...');

  nodeCron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Iniciando ciclo de sincronização Google Calendar...');
    
    try {
      const usersWithGoogle = await prisma.user.findMany({
        where: { googleRefreshToken: { not: null } }
      });

      console.log(`[Cron] Sincronizando ${usersWithGoogle.length} usuários...`);

      for (const user of usersWithGoogle) {
        try {
          await googleCalendarService.syncFromGoogle(user.id);
        } catch (err) {
          console.error(`[Cron] Falha ao sincronizar usuário ${user.id}:`, err);
        }
      }
    } catch (error) {
      console.error('[Cron] Erro crítico no job de sincronização Google:', error);
    }
  });
};
