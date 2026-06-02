import { holidayService } from './holidayService';
import { prisma } from '../lib/prisma';

// ==============================================================
// MOTOR DE PRAZOS — Prazzo (RF07)
//
// Implementa a contagem de prazos processuais conforme o CPC 2015:
//
//   Art. 219: Na contagem de prazos processuais, são computados
//   somente os dias úteis.
//
//   Art. 224, §1º: O prazo começa a correr no primeiro dia útil
//   seguinte ao da publicação/intimação (exclui o dia do começo,
//   inclui o do vencimento).
//
//   Art. 216: Os dias de paralisação (feriados, recesso) suspendem
//   a contagem — o prazo retoma no próximo dia útil.
//
// Integração com HolidayService (BrasilAPI): os feriados nacionais
// são buscados dinamicamente para o ano corrente, com cache em
// memória para evitar chamadas repetidas à API externa.
// ==============================================================

/** Mapeamento de tipo de movimentação → dias de prazo (CPC/legislação processual) */
const PRAZO_POR_MOVIMENTO: Record<string, number> = {
  // Contestação e resposta
  'CITACAO':                           15,  // Art. 335 CPC — contestação
  'CITACAO_FAZENDA_PUBLICA':           30,  // Art. 335, §4 CPC — Fazenda Pública
  'INTIMACAO_MANIFESTACAO':            15,  // Prazo geral de manifestação
  'INTIMACAO_RECURSO':                 15,  // Art. 1.003 CPC — apelação/agravo
  'INTIMACAO_EMBARGOS_DECLARACAO':      5,  // Art. 1.023 CPC — embargos de declaração
  'SENTENCA':                          15,  // Art. 1.003 — prazo para apelar
  'ACORDAO':                           15,  // Art. 1.003 — prazo para recurso especial/extraordinário
  'DESPACHO_REGULARIZACAO':             5,  // Prazo curto para cumprimento de despacho
  'PUBLICACAO_EDITAL':                 20,  // Art. 257 CPC — citação por edital (padrão)
  // Execução
  'INTIMACAO_PAGAMENTO_EXECUCAO':      15,  // Art. 829 CPC — pagamento ou embargos em execução
  'ARREMATACAO':                       10,  // Prazo para manifestação pós-arrematação
};

/** Número de dias de prazo padrão quando o tipo de movimentação não é mapeado */
const PRAZO_PADRAO_DIAS = 15;

export class DeadlineService {
  /**
   * Calcula a data de vencimento de um prazo processual a partir de uma data
   * de publicação/intimação, contando somente dias úteis (CPC Art. 219).
   *
   * Regras implementadas:
   * - Exclui o dia do começo (dia da publicação) — CPC Art. 224 §1º
   * - Inclui o dia do vencimento
   * - Pula fins de semana (sábado e domingo)
   * - Pula feriados nacionais (via BrasilAPI, com cache em memória)
   * - Atualiza o cache de feriados ao cruzar a virada de ano
   *
   * @param startDate - Data da publicação/intimação (dia do início, não contado)
   * @param days - Número de dias úteis do prazo
   * @param state - Sigla do estado para feriados estaduais (padrão: 'SP')
   * @returns Promise<Date> com a data de vencimento do prazo
   */
  async calculateLegalDeadline(startDate: Date, days: number, state: string = 'SP'): Promise<Date> {
    let currentYear = startDate.getFullYear();
    let holidays = await holidayService.getHolidays(currentYear, state);
    let holidayDates = new Set(holidays.map(h => h.date));

    // CPC Art. 224, §1º: O prazo NÃO conta o dia da publicação.
    // Começamos a partir do dia seguinte.
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1);

    // Avança até o primeiro dia útil após a publicação (não conta fins de semana/feriados iniciais)
    while (!isBusinessDaySync(currentDate, holidayDates)) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Já estamos no 1º dia útil — conta como 1
    let businessDaysCount = 1;

    // Conta os dias úteis restantes
    while (businessDaysCount < days) {
      currentDate.setDate(currentDate.getDate() + 1);

      // Atualiza cache se cruzarmos a virada de ano (CPC Art. 221 — recesso de Jan)
      if (currentDate.getFullYear() !== currentYear) {
        currentYear = currentDate.getFullYear();
        holidays = await holidayService.getHolidays(currentYear, state);
        holidayDates = new Set(holidays.map(h => h.date));
        console.log(`[DeadlineService] Cache de feriados atualizado para ${currentYear}.`);
      }

      if (isBusinessDaySync(currentDate, holidayDates)) {
        businessDaysCount++;
      }
    }

    return currentDate;
  }

  /**
   * Retorna o número de dias de prazo para um tipo de movimentação processual.
   * Utiliza o mapeamento CPC interno; retorna o prazo padrão se o tipo for desconhecido.
   *
   * @param movementType - Tipo de movimentação (ex: 'SENTENCA', 'CITACAO')
   * @returns Número de dias úteis do prazo
   */
  getDiasParaTipo(movementType: string): number {
    const normalizedType = movementType.toUpperCase().trim();
    const dias = PRAZO_POR_MOVIMENTO[normalizedType];

    if (dias !== undefined) {
      console.log(`[DeadlineService] Tipo "${movementType}" → ${dias} dias úteis de prazo.`);
      return dias;
    }

    console.warn(
      `[DeadlineService] ⚠️ Tipo de movimentação desconhecido: "${movementType}". ` +
      `Aplicando prazo padrão de ${PRAZO_PADRAO_DIAS} dias úteis.`
    );
    return PRAZO_PADRAO_DIAS;
  }

  /**
   * Processa uma movimentação processual, detecta se há prazo implícito ou
   * explícito no texto, calcula a data de vencimento e cria o evento de Deadline
   * no banco vinculado ao processo.
   *
   * Detecta prazos de duas formas:
   * 1. **Tipo de movimentação** mapeado em PRAZO_POR_MOVIMENTO (ex: 'CITACAO' → 15 dias)
   * 2. **Regex em texto livre** (ex: "prazo de 5 dias" no corpo da movimentação)
   *
   * @param caseId - ID do processo no banco
   * @param movementText - Texto da movimentação (para detecção por regex)
   * @param state - Sigla do estado (padrão: 'SP')
   * @param movementType - Tipo classificado da movimentação (ex: 'SENTENCA')
   */
  async processMovementForDeadlines(
    caseId: string,
    movementText: string,
    state: string = 'SP',
    movementType?: string
  ): Promise<void> {
    let days: number | null = null;
    let detectionMethod = '';

    // Estratégia 1: Tipo de movimentação mapeado (fonte mais confiável)
    if (movementType) {
      const diasTipo = this.getDiasParaTipo(movementType);
      // Só usa se o tipo foi mapeado explicitamente (não o padrão genérico)
      if (PRAZO_POR_MOVIMENTO[movementType.toUpperCase().trim()] !== undefined) {
        days = diasTipo;
        detectionMethod = `tipo de movimentação (${movementType})`;
      }
    }

    // Estratégia 2: Regex no texto livre como fallback
    if (days === null) {
      const match = movementText.match(/prazo de (\d+) dias?/i);
      if (match) {
        days = parseInt(match[1], 10);
        detectionMethod = `regex no texto ("prazo de ${days} dias")`;
      }
    }

    if (days === null) {
      console.log(`[DeadlineService] Nenhum prazo detectado para movimentação no processo ${caseId}. Ignorando.`);
      return;
    }

    console.log(`[DeadlineService] Prazo de ${days} dias detectado via ${detectionMethod}. Calculando vencimento...`);

    const dueDate = await this.calculateLegalDeadline(new Date(), days, state);

    console.log(
      `[DeadlineService] ✅ Vencimento calculado: ${dueDate.toLocaleDateString('pt-BR')} ` +
      `(${days} dias úteis a partir de hoje, estado: ${state})`
    );

    // Persiste o evento de prazo vinculado ao processo
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { user: true },
    });

    if (!caseData) {
      console.error(`[DeadlineService] Processo ${caseId} não encontrado. Deadline não criado.`);
      return;
    }

    const tituloMovimento = movementText.length > 50
      ? `${movementText.substring(0, 50)}...`
      : movementText;

    await prisma.event.create({
      data: {
        userId:         caseData.userId,
        title:          `⚖️ PRAZO: ${tituloMovimento}`,
        description:
          `Prazo de ${days} dias úteis calculado automaticamente.\n` +
          `Detecção via: ${detectionMethod}.\n` +
          `Vence em: ${dueDate.toLocaleDateString('pt-BR')}.`,
        startTime:      dueDate,
        endTime:        dueDate,
        relatedCaseId:  caseId,
        eventType:      'DEADLINE',
        creationSource: 'AUTO_AI',
      },
    });

    console.log(`[DeadlineService] ✅ Evento de prazo criado no banco para o processo ${caseId}.`);
  }
}

export const deadlineService = new DeadlineService();

/**
 * Named export para compatibilidade com caseController e testes existentes.
 * Delega para deadlineService.processMovementForDeadlines().
 *
 * @param caseId - ID do processo
 * @param title - Título da movimentação
 * @param description - Texto completo da movimentação
 * @param movementType - Tipo classificado (opcional, melhora precisão do prazo)
 */
export async function calculateAndCreateDeadline(
  caseId: string,
  title: string,
  description: string,
  movementType?: string
): Promise<void> {
  const fullText = `${title} - ${description}`;
  await deadlineService.processMovementForDeadlines(caseId, fullText, 'SP', movementType);
}

// ── Verificação síncrona de dia útil (usada no loop de contagem) ──────────────
function isBusinessDaySync(date: Date, holidayDates: Set<string>): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Domingo (0) ou Sábado (6)
  const dateString = date.toISOString().split('T')[0];
  return !holidayDates.has(dateString);
}

console.log('[DeadlineService] ✅ Motor de Prazos CPC carregado. Mapeamentos de prazo ativos:', Object.keys(PRAZO_POR_MOVIMENTO).length);
