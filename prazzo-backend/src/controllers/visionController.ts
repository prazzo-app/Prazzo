import { Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { geminiService } from '../services/geminiService';

// Helper para formatar a imagem em base64 e deduzir tipo
const encodeImage = (filePath: string): string => {
  const bitmap = fs.readFileSync(filePath);
  return Buffer.from(bitmap).toString('base64');
};

export const processVisionAgenda = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    
    // Agora pegamos o ID do usuário diretamente do token JWT decodificado pelo middleware
    const authUser = (req as any).user;
    const finalUserId = authUser?.id;

    if (!file) {
      res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      return;
    }

    if (!finalUserId) {
        res.status(401).json({ error: 'Sessão expirada. Faça login para usar a lente visual.' });
        return;
    }

    console.log('[Vision AI] Imagem recebida, preparando codificação Base64...');
    const base64Image = encodeImage(file.path);
    const mimeType = file.mimetype || 'image/jpeg';

    console.log('[Vision AI] Chamando IA Gemini 1.5 Flash para Extração de Lógica e OCR...');

    const prompt = `Você é um secretário jurídico virtual especialista em leitura de documentos legais.
Extraia os detalhes do compromisso da imagem a seguir (um banner, e-mail ou despacho). 
RETORNE UM JSON NATIVO COM ESTES CAMPOS:
{
  "title": "String (Título curto ex: 'Audiência de Conciliação')",
  "description": "String detalahda extraída da imagem",
  "startTime": "ISO 8601 DateTime (ex: 2026-05-06T14:00:00Z)",
  "endTime": "ISO 8601 DateTime",
  "eventType": "String ('audience', 'meeting', 'focus_block', 'deadline')",
  "allDay": boolean
}
Regras Críticas:
1. Hoje é ${new Date().toLocaleDateString('pt-BR')}. Se a imagem tiver apenas dia e mês, assuma o ano corrente.
2. IMPORTANTE: Se a imagem tiver apenas a DATA do evento e NÃO o horário de início, você DEVE retornar as datas de início e fim contemplando o dia inteiro e definir "allDay": true.`;

    const aiEventData = await geminiService.generateVisionContent(prompt, base64Image, mimeType);

    if (!aiEventData) {
      res.status(500).json({ error: 'A Inteligência Computacional não achou dados úteis na imagem.' });
      return;
    }

    // Persistindo no Banco de Dados
    console.log('[Vision AI] Persistindo evento no banco...');
    const createdEvent = await prisma.event.create({
        data: {
            userId: finalUserId,
            title: aiEventData.title,
            description: aiEventData.description,
            startTime: new Date(aiEventData.startTime),
            endTime: new Date(aiEventData.endTime),
            eventType: aiEventData.eventType.toUpperCase(),
            creationSource: 'IMAGE_OCR'
        }
    });

    // Deletar o arquivo do cache local
    fs.unlinkSync(file.path);

    console.log('[Vision AI] Processado com sucesso ID:', createdEvent.id);

    res.status(201).json({
      message: 'Compromisso gerado via Visão Computacional com sucesso!',
      sourceType: 'image',
      event: createdEvent
    });

  } catch (error: any) {
    console.error('[Vision AI] Erro Crítico:', error?.response?.data || error);
    res.status(500).json({ error: 'Falha durante o processamento da lente da Inteligência.' });
  }
};
