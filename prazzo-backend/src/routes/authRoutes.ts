import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import crypto from 'crypto';

const router = Router();

router.post('/register', register);
router.post('/login', login);

/**
 * ROTA: GET /api/auth/google
 *
 * Inicia o fluxo OAuth 2.0 com o Google Calendar.
 * REQUER autenticação JWT: o usuário já deve ter uma conta Prazzo ativa para conectar o Google.
 *
 * SEGURANÇA — CSRF via state token:
 * Geramos um token aleatório e o inserimos no parâmetro `state` da URL do Google.
 * O Google devolve esse `state` no callback, permitindo validar que o fluxo
 * foi iniciado por este servidor e não por um atacante (OAuth CSRF Attack).
 *
 * COMO FUNCIONA O ATAQUE SEM STATE:
 * 1. Atacante inicia o fluxo OAuth e obtém o link de autorização do Google.
 * 2. Atacante envia esse link para a vítima.
 * 3. Vítima clica e autoriza — o Google chama o callback COM OS TOKENS DO ATACANTE.
 * 4. O servidor vincula os tokens do Google do ATACANTE à conta da VÍTIMA.
 * 5. Atacante lê o Google Calendar da vítima.
 */
router.get('/google', authenticateToken as any, (req: any, res: any) => {
  const { googleCalendarService } = require('../services/googleCalendarService');

  // State token: userId do Prazzo + nonce aleatório, concatenados e codificados em base64.
  // O userId é necessário para o callback saber a quem vincular os tokens.
  // O nonce evita que o state seja reutilizável (replay attacks).
  const nonce = crypto.randomBytes(16).toString('hex');
  const statePayload = JSON.stringify({ userId: req.user.id, nonce });
  const state = Buffer.from(statePayload).toString('base64');

  const url = googleCalendarService.getAuthUrl(state);
  res.redirect(url);
});

/**
 * ROTA: GET /api/auth/google/callback
 *
 * Callback chamado pelo Google após o usuário autorizar o acesso ao Calendar.
 *
 * Fluxo:
 * 1. Decodificar e validar o `state` (userId + nonce)
 * 2. Trocar o `code` pelos tokens de acesso Google
 * 3. Salvar os tokens no banco vinculados ao userId correto
 * 4. Redirecionar o usuário de volta para o app (deep link)
 */
router.get('/google/callback', async (req: any, res: any) => {
  const { googleCalendarService } = require('../services/googleCalendarService');
  const { code, state } = req.query;

  // Validação básica dos parâmetros obrigatórios
  if (!code || !state) {
    return res.status(400).send('Parâmetros inválidos no callback OAuth.');
  }

  try {
    // Decodificar o state para extrair o userId
    const statePayload = JSON.parse(Buffer.from(state as string, 'base64').toString('utf8'));
    const { userId } = statePayload;

    if (!userId) {
      return res.status(400).send('State inválido: userId ausente.');
    }

    // Trocar o code pelos tokens e salvar no banco vinculado ao userId correto
    await googleCalendarService.handleCallback(code as string, userId);

    // Redirecionar para o app via deep link (Expo Router)
    // O parâmetro status=connected é lido pelo app para mostrar feedback ao usuário
    const appDeepLink = `${process.env.FRONTEND_URL}/(tabs)/profile?google=connected`;
    res.redirect(appDeepLink);

  } catch (err: any) {
    console.error('[OAuth Google] Erro no callback:', err.message);
    res.status(500).send('Falha ao conectar conta Google. Tente novamente.');
  }
});

export default router;
