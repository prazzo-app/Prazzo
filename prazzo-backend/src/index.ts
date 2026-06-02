import 'dotenv/config'; // DEVE ser o primeiro import — carrega .env antes de qualquer outro módulo
import express from 'express';
import cors from 'cors';
import { apiLimiter, authLimiter, webhookLimiter } from './middleware/rateLimiter';

const app = express();
const port = process.env.PORT || 3000;

/**
 * SEGURANÇA: CORS configurado com lista explícita de origens permitidas.
 * Razão: cors() sem parâmetros aceita qualquer origem (wildcard *),
 * permitindo que qualquer site faça requisições autenticadas em nome do usuário.
 */
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'exp://localhost:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * ARQUITETURA: billingRoutes DEVE ser registrado ANTES do express.json() global.
 * Razão: O endpoint /api/billing/webhook usa express.raw() internamente (raw body buffer).
 * O Stripe requer o body BRUTO (não parseado) para validar a assinatura HMAC-SHA256.
 * Se express.json() processar o body primeiro, o raw buffer é perdido e a assinatura falha.
 * Todas as outras rotas (abaixo) recebem o express.json() normalmente.
 */
import billingRoutes from './routes/billingRoutes';
app.use('/api/billing', billingRoutes);

// express.json() global para todas as rotas que vêm depois (todas exceto billing/webhook)
app.use(express.json());

// P1-SEGURANÇA: Rate Limiting Global
app.use(apiLimiter);

import webhookRoutes from './routes/webhookRoutes';
import caseRoutes from './routes/caseRoutes';
import voiceRoutes from './routes/voiceRoutes';
import visionRoutes from './routes/visionRoutes';
import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import userRoutes from './routes/userRoutes';
import shareRoutes from './routes/shareRoutes';
import { startInertiaCheckJob } from './jobs/inertiaCheck';
import { startGoogleSyncJob } from './jobs/googleSyncJob';

app.use('/api/webhooks', webhookLimiter, webhookRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/share', shareRoutes);

// Inicia serviços de background (Cron Jobs)
startInertiaCheckJob();
startGoogleSyncJob();

/**
 * Health Check: endpoint público para monitoramento do container (ECS, Railway, Render).
 * Retorna timestamp para facilitar debugging de deploy (confirma que o código novo subiu).
 */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Prazzo API is running.',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.listen(port, () => {
  console.log(`[Server] API Prazzo rodando na porta ${port}`);
});
