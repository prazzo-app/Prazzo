import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { sendWhatsAppSummary } from '../services/notificationService';

// Conexão com o Redis via variável de ambiente (Upstash ou Local)
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,         // Só conecta quando houver jobs, não na inicialização
  retryStrategy: (times) => {
    if (times > 3) return null; // Para de tentar após 3 falhas (evita loop infinito no log)
    return Math.min(times * 500, 2000);
  },
});

// Criando a Fila de Movimentações
export const movementQueue = new Queue('case-movements', { connection });

// Função para adicionar Item na Fila (Producer)
export async function enqueueMovement(payload: any) {
  await movementQueue.add('process-movement', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
}

// Configurando o Worker (Operário que processa as filas no background)
export const movementWorker = new Worker(
  'case-movements',
  async (job: Job) => {
    // Lazy-init dos serviços: evita dependência circular e carrega apenas quando há jobs
    const { geminiService } = await import('../services/geminiService');

    console.log(`[Worker] Processando Webhook ID ${job.id}`);
    const data = job.data; // Dados brutos que chegaram do Escavador/Jusbrasil
    const rawMovementText = data.rawPayload || JSON.stringify(data);
    
    console.log(`[Worker] Traduzindo andamento via Gemini 1.5 Flash...`);
    
    const prompt = `Você é um secretário jurídico sênior altamente preventivo.
    Seu cliente acaba de receber uma movimentação oficial no processo.
    Traduza este juridiquês pesado a seguir em uma mensagem MÁXIMA de 2 frases objetivas.
    Formato OBRIGATÓRIO: Inicie com "Dr(a)., movimento novo no processo [Número do Processo]".
    Se houver qualquer indício de Prazo, deixe o alerta EM *NEGRITO* dizendo a quantidade de dias para ele não perder!
    Mantenha tom conversacional de ZapZap.
    
    Movimentação Bruta:
    ${rawMovementText}`;

    const aiSummary = await geminiService.generateText(prompt);

    const { prisma } = await import('../lib/prisma');
    const { deadlineService } = await import('../services/deadlineService');
    console.log(`[Worker] Atualizando banco de dados com a tradução...`);
    
    // Tenta encontrar o caso pelo número. Inclui o usuário para buscar o telefone real.
    const relatedCase = await prisma.case.findFirst({
      where: { caseNumber: data.caseNumber },
      include: { user: true } // Necessário para obter o phone do advogado
    });

    if (relatedCase) {
      console.log(`[Worker] Vinculando movimento ao caso: ${relatedCase.caseNumber}`);
      
      await prisma.caseMovement.create({
        data: {
          caseId: relatedCase.id,
          date: new Date(),
          rawPayload: JSON.stringify(data),
          shortSummaryAi: aiSummary,
          movementType: "WEBHOOK_AI"
        }
      });

      // Acionar Motor de Prazos Inteligente (RF07)
      await deadlineService.processMovementForDeadlines(relatedCase.id, rawMovementText);

      /**
       * P0-BUG CORRIGIDO: Usar o telefone REAL do advogado dono do processo.
       * Razão do problema anterior: '+5511999998888' era um número mock de desenvolvimento
       * que nunca foi removido. Em produção, TODAS as notificações iam para um número fictício
       * e os advogados reais não recebiam NADA, tornando o diferencial do produto inoperante.
       *
       * Comportamento atual:
       * - Se o usuário tem telefone cadastrado → dispara o WhatsApp (RF09/RF10)
       * - Se não tem telefone → loga um aviso e continua sem crashar
       *   (o advogado ainda recebe push notification como fallback do plano Free)
       */
      if (relatedCase.user?.phone) {
        const { sendWhatsAppSummary } = await import('../services/notificationService');
        await sendWhatsAppSummary(relatedCase.user.phone, relatedCase.id, aiSummary);
      } else {
        console.warn(`[Worker] Usuário ${relatedCase.userId} sem telefone cadastrado. WhatsApp omitido.`);
      }
    } else {
      // Caso não encontrado: pode ser webhook de processo não monitorado pelo Prazzo.
      // Log para auditoria, mas não é um erro — o webhook pode vir de qualquer processo.
      console.warn(`[Worker] Caso ${data.caseNumber} não encontrado no banco. Webhook ignorado graciosamente.`);
    }

    return { success: true, processedAi: true };
  },
  { connection }
);

console.log('[Queue] Worker de Movimentações inicializado e ouvindo...');

movementWorker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} concluído com sucesso!`);
});

movementWorker.on('failed', (job, err) => {
  console.log(`[Worker] Falha no Job ${job?.id}: ${err.message}`);
});
