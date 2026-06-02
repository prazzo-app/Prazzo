import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { processVoiceAgenda } from '../controllers/voiceController';

const router = Router();

// Configurando Multer para salvar temporariamente o áudio no disco
// O Whisper precisa de ler um arquivo físico real (ou um ReadStream bem formatado)
import { authenticateToken } from '../middleware/authMiddleware';

const uploadTemp = multer({ dest: path.join(__dirname, '../../tmp_audio_uploads/') });

router.post('/agenda', authenticateToken as any, uploadTemp.single('audio_file'), processVoiceAgenda);

export default router;
