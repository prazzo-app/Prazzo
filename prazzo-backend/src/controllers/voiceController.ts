import { Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const processVoiceAgenda = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    const authUser = (req as any).user;
    const finalUserId = authUser?.id;

    if (!file) {
      res.status(400).json({ error: 'Nenhum áudio foi enviado.' });
      return;
    }

    if (!finalUserId) {
        res.status(401).json({ error: 'Você precisa estar logado para agendar por voz.' });
        return;
    }

    console.log(`[IA Gemini] Processando áudio: ${file.originalname} (${file.mimetype})...`);

    // 1. Ler o arquivo e converter para base64 para o Gemini
    const audioData = fs.readFileSync(file.path);
    const audioBase64 = audioData.toString("base64");

    // 2. Enviar para o Gemini 1.5 Flash (Multimodal)
    const prompt = `Você é um secretário jurídico assistente. 
Ouça o áudio e extraia as informações de compromisso de um advogado.
Seja preciso com as datas. Hoje é ${new Date().toLocaleDateString('pt-BR')}.
Retorne APENAS um JSON estrito (sem markdown):
{
  "title": "String (Título curto ex: 'Audiência Caso X')",
  "description": "String do texto completo transcrito ou detalhamento",
  "startTime": "ISO 8601 DateTime (ex: 2026-04-04T14:00:00Z)",
  "endTime": "ISO 8601 DateTime (se não mencionado, adicione 1 hora ao início)",
  "eventType": "String ('AUDIENCE', 'MEETING', 'FOCUS_BLOCK', 'DEADLINE')"
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: file.mimetype === 'audio/wav' ? 'audio/wav' : 'audio/mpeg',
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Limpando possíveis blocos de markdown
    const cleanedText = text.replace(/```json|```/g, "").trim();
    const aiEventData = JSON.parse(cleanedText);

    if (!aiEventData) {
       res.status(500).json({ error: 'Falha ao interpretar áudio com IA Gemini.' });
       return;
    }

    // 3. Salvar no Prisma (Banco de Dados Real)
    console.log('[IA Gemini] Persistindo compromisso no banco...');
    const createdEvent = await prisma.event.create({
        data: {
            userId: finalUserId,
            title: aiEventData.title,
            description: aiEventData.description,
            startTime: new Date(aiEventData.startTime),
            endTime: new Date(aiEventData.endTime),
            eventType: aiEventData.eventType.toUpperCase(),
            creationSource: 'VOICE'
        }
    });

    // Limpar arquivo de cache
    fs.unlinkSync(file.path);
    
    console.log('[IA Gemini] Sucesso! Compromisso Criado ID:', createdEvent.id);
    
    res.status(201).json({
      message: 'Compromisso agendado por voz com sucesso!',
      event: createdEvent
    });

  } catch (error: any) {
    console.error('[IA Gemini] Erro no processamento de voz:', error);
    res.status(500).json({ error: 'Erro ao processar o áudio com a IA Gemini 1.5 Flash.' });
  }
};
