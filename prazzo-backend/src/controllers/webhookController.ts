import { Request, Response } from 'express';
import { enqueueMovement } from '../queues/movementQueue';
import crypto from 'crypto';

/**
 * SEGURANÇA P0: Verificação de Assinatura HMAC no Webhook de Processos.
 *
 * PROBLEMA ANTERIOR: O endpoint /api/webhooks/escavador estava 100% aberto.
 * Qualquer agente externo podia fazer um POST com caseNumbers fabricados,
 * causando: 1) custo com Gemini processando dados falsos; 2) poluição do banco;
 * 3) advogados recebendo alertas WhatsApp falsos (perigo legal e reputacional).
 *
 * SOLUÇÃO: HMAC-SHA256. O remetente (Escavador/Jusbrasil) assina o payload
 * com um secret compartilhado. Verificamos a assinatura antes de enfileirar.
 * Se o secret não bater → 403. Se não tiver header → 401.
 *
 * VARIÁVEL NECESSÁRIA NO .env: ESCAVADOR_WEBHOOK_SECRET=seu_secret_aqui
 *
 * NOTA ARQUITETURAL: Retornamos 200 rapidamente APÓS validação bem-sucedida.
 * Regra de ouro de webhooks: a API chamante considera falha se não receber
 * 200 em < 5s. O processamento pesado (Gemini, banco) ocorre no background (BullMQ).
 */

const WEBHOOK_SECRET = process.env.ESCAVADOR_WEBHOOK_SECRET;

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // P0-SEGURANÇA: Verificar se o secret está configurado antes de qualquer processamento
    if (!WEBHOOK_SECRET) {
      console.error('[Webhook] ESCAVADOR_WEBHOOK_SECRET não configurado. Rejeitando requisição.');
      res.status(500).json({ error: 'Webhook não configurado corretamente no servidor.' });
      return;
    }

    // Extrair a assinatura enviada pelo remetente no header
    // Padrão usado pela maioria das APIs de processo (Escavador, Jusbrasil)
    const receivedSignature = req.headers['x-webhook-signature'] as string;

    if (!receivedSignature) {
      // 401 (não autenticado): falta o header de assinatura
      res.status(401).json({ error: 'Assinatura de webhook ausente.' });
      return;
    }

    // Calcular a assinatura esperada: HMAC-SHA256 do body com nosso secret
    // Razão do JSON.stringify: garantimos que o corpo é serializado da mesma forma
    // que o remetente usou ao gerar a assinatura no lado deles.
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    // Comparação com timing-safe para evitar timing attacks em comparações de strings
    // Razão: === em strings retorna mais rápido se diferem nos primeiros chars,
    // permitindo que um atacante descubra o secret por medir o tempo de resposta.
    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!signaturesMatch) {
      // 403 (proibido): header presente mas assinatura inválida (fonte não autorizada)
      console.warn('[Webhook] Assinatura inválida recebida. Possível tentativa de spoofing.');
      res.status(403).json({ error: 'Assinatura inválida. Acesso negado.' });
      return;
    }

    const payload = req.body;

    // Enfileirar no BullMQ para processamento assíncrono (Gemini + banco)
    await enqueueMovement(payload);

    // Resposta imediata 200: a API do tribunal/Escavador não espera mais que isso.
    // Todo o processamento pesado acontece no Worker em background.
    res.status(200).json({ received: true, status: 'queued' });

  } catch (error) {
    console.error('[Webhook] Falha ao processar requisição:', error);
    res.status(500).json({ error: 'Erro interno ao processar webhook.' });
  }
};
