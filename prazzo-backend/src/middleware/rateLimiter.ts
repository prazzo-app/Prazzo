import rateLimit from 'express-rate-limit';

/**
 * P1-SEGURANÇA: Implementação de Rate Limiting.
 * 
 * Motivação: Proteger a infraestrutura contra ataques de Brute-Force (auth)
 * e DoS (Denial of Service) que poderiam elevar os custos de Cloud e IA
 * desnecessariamente ou derrubar o serviço para usuários legítimos.
 */

/**
 * Limiter para rotas de Autenticação (Login/Register).
 * Configuração: Máximo de 10 tentativas a cada 15 minutos por IP.
 * Razão: Bloqueia ataques de dicionário e brute-force em senhas.
 */
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 10, 
	message: {
		error: 'Muitas tentativas de acesso. Tente novamente em 15 minutos.',
		code: 'TOO_MANY_REQUESTS'
	},
	standardHeaders: true, // Retorna info de rate limit nos headers RateLimit-*
	legacyHeaders: false, // Desabilita os headers X-RateLimit-* antigos
});

/**
 * Limiter para rotas de Webhooks.
 * Configuração: Máximo de 100 requisições a cada 5 minutos por IP.
 * Razão: Webhooks de tribunais podem ser volumosos, mas uma rajada
 * excessiva pode indicar ataque ou loop infinito no provedor.
 */
export const webhookLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutos
	max: 100,
	message: {
		error: 'Limite de processamento de webhooks excedido temporariamente.',
		code: 'WEBHOOK_LIMIT_EXCEEDED'
	},
	standardHeaders: true,
	legacyHeaders: false,
});

/**
 * Limiter Global para a API.
 * Configuração: Máximo de 200 requisições a cada 15 minutos.
 * Razão: Proteção genérica contra scraping ou bugs no frontend que
 * gerem requisições em loop.
 */
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 200,
	message: {
		error: 'Limite de requisições atingido. Por favor, aguarde.',
		code: 'API_LIMIT_REACHED'
	},
	standardHeaders: true,
	legacyHeaders: false,
});
