import { Router } from 'express';
import { handleWebhook } from '../controllers/webhookController';

const router = Router();

// Endpoint que os Tribunais e APIs de Processo (Escavador/Jusbrasil) farão o POST.
router.post('/escavador', handleWebhook);

export default router;
