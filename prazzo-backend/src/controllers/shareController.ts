import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { geminiService } from '../services/geminiService';

export const generateShareMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { movementId } = req.body;
    
    if (!movementId) {
      res.status(400).json({ error: 'ID da movimentação é obrigatório.' });
      return;
    }

    const movement = await prisma.caseMovement.findUnique({
      where: { id: movementId },
      include: { case: true }
    });

    if (!movement) {
      res.status(404).json({ error: 'Movimentação não encontrada.' });
      return;
    }

    // Gerar resumo amigável usando Gemini
    const complexText = movement.rawPayload || movement.shortSummaryAi || 'Nova movimentação processual.';
    const friendlySummary = await geminiService.generateClientFriendlySummary(complexText);

    // Formatar mensagem para WhatsApp
    const message = `Olá! Tenho uma atualização sobre o seu processo ${movement.case.caseNumber}:\n\n*${friendlySummary}*\n\nQualquer dúvida, estou à disposição!`;
    
    // Codificar para URL
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    res.status(200).json({ 
        message,
        whatsappUrl 
    });
  } catch (error) {
    console.error('[ShareController] Erro ao gerar link de compartilhamento:', error);
    res.status(500).json({ error: 'Erro interno ao gerar link de compartilhamento.' });
  }
};
