import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { processVisionAgenda } from '../controllers/visionController';

const router = Router();

// Usaremos a mesma posta temporária, mas poderíamos mudar. 
// Para Imagens, o limite pode ser um pouco maior, configurando o limit:
import { authenticateToken } from '../middleware/authMiddleware';

const uploadVision = multer({ 
  dest: path.join(__dirname, '../../tmp_vision_uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 } // Limite 10MB para fotos de câmera
});

// A Rota POST
router.post('/agenda', authenticateToken as any, uploadVision.single('document_image'), processVisionAgenda);

export default router;
