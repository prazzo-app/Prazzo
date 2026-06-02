import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

/**
 * SEGURANÇA P0: Chaves Stripe sem fallback.
 * Razão do 'sk_test_mock': se o .env não for carregado, o servidor roda com uma chave
 * que nunca valida assinaturas reais. Um atacante envia um payload Stripe fabricado
 * simulando 'checkout.session.completed' e promove QUALQUER usuário para PREMIUM sem pagar.
 * Decisão: Fail-fast — o servidor não deve subir sem as chaves de billing configuradas.
 */
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  console.error('[FATAL] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET não configurados. Encerrando.');
  process.exit(1);
}

const stripe = new (Stripe as any)(STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planType } = req.body; 
    const authUser = (req as any).user;
    
    if (!authUser) {
      res.status(401).json({ error: 'Faça login para assinar.' });
      return;
    }

    // Regra de negócio: ANNUAL e MONTHLY são os únicos planos válidos.
    // Rejeitamos valores inesperados antes de consultar o Stripe,
    // evitando que a API seja usada com priceIds arbitrários.
    if (!['ANNUAL', 'MONTHLY'].includes(planType)) {
      res.status(400).json({ error: 'Tipo de plano inválido. Use ANNUAL ou MONTHLY.' });
      return;
    }

    const priceId = (planType === 'ANNUAL') 
      ? process.env.STRIPE_PRICE_ANNUAL 
      : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      res.status(400).json({ error: 'ID de preço não configurado no servidor.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/(tabs)/premium?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/(tabs)/premium?status=cancel`,
      customer_email: authUser.email,
      // metadata.userId é crítico: é o único link entre a sessão Stripe e o User no nosso banco.
      // Sem ele, o webhook não sabe a quem fazer o upgrade.
      metadata: { userId: authUser.id, planType },
      payment_method_options: {
        pix: {
          // PIX expira em 1h (3600s). Regra da Meta/Banco Central para QR codes dinâmicos.
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }
      }
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe] Erro ao criar sessão:', error);
    res.status(500).json({ error: 'Erro ao processar pagamento.' });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  let event: any;

  try {
    /**
     * SEGURANÇA CRÍTICA: stripe.webhooks.constructEvent() verifica a assinatura HMAC-SHA256
     * do payload usando o STRIPE_WEBHOOK_SECRET.
     * Razão: Sem essa validação, qualquer pessoa pode fazer um POST para este endpoint
     * com um JSON fabricado simulando um pagamento aprovado e promover usuários para PREMIUM.
     * O req.body DEVE ser o buffer raw (não parseado) — por isso billingRoutes usa raw().
     */
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`[Stripe Webhook] Assinatura inválida: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Processar apenas os eventos de pagamento confirmado
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;

    if (userId) {
      console.log(`[Stripe] Pagamento confirmado para usuário ${userId}. Fazendo upgrade.`);
      
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'PREMIUM' },
      });
    }
  }

  // Retorno imediato: o Stripe requer resposta 200 em < 30s ou marca o webhook como falha
  res.json({ received: true });
};
