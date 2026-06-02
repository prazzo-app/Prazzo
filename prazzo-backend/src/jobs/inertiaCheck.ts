import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendWhatsAppSummary } from '../services/notificationService';

// Agendar para rodar todos os dias às 09:00 AM
export const startInertiaCheckJob = () => {
  console.log('[Inertia Job] Serviço de Verificação de Inércia agendado (09:00 AM daily)');
  
  cron.schedule('0 9 * * *', async () => {
    console.log('[Inertia Job] Iniciando verificação diária de prazos críticos...');
    
    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      // 1. Buscar prazos PENDENTES que vencem nos próximos 3 dias
      const criticalDeadlines = await prisma.deadline.findMany({
        where: {
          status: 'PENDING',
          calculatedDueDate: {
            lte: threeDaysFromNow,
            gte: now
          }
        },
        include: {
          event: {
            include: { user: true }
          }
        }
      });

      console.log(`[Inertia Job] Encontrados ${criticalDeadlines.length} prazos em zona crítica.`);

      for (const deadline of criticalDeadlines) {
        const user = deadline.event.user;
        if (!user || !user.phone) continue;

        // Regra RF08: Notificar se houver inércia
        const alertMsg = `⚠️ ALERTA DE URGÊNCIA PRAZZO!\n\nDr(a). ${user.name}, o prazo "${deadline.event.title}" vence em menos de 72h e ainda não detectamos nenhuma movimentação sua na agenda para este item.\n\nEvite a perda de prazo! Deseja que eu sugira um *Bloco de Foco* para hoje?`;

        await sendWhatsAppSummary(user.phone, deadline.event.relatedCaseId || 'Geral', alertMsg);
        
        console.log(`[Inertia Job] Alerta enviado para ${user.email} sobre o prazo ${deadline.id}`);
      }

    } catch (error) {
      console.error('[Inertia Job] Erro ao processar check de inércia:', error);
    }
  });
};
