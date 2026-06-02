import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { datajudService } from '../services/datajudService';
import { calculateAndCreateDeadline } from '../services/deadlineService';

// Controller para criar e listar os processos do usuário
export const createCase = async (req: Request, res: Response) => {
  try {
    const { userId, caseNumber, courtSystem } = req.body;
    
    // Agora pegamos o ID do usuário diretamente do token JWT decodificado pelo middleware
    const authUser = (req as any).user;
    const finalUserId = authUser?.id || userId;

    if (!finalUserId) {
        res.status(401).json({ error: 'Usuário não identificado. Faça login.' });
        return;
    }

    // --- PROTEÇÃO DE TIER (MVP RF06) ---
    const user = await prisma.user.findUnique({ where: { id: finalUserId } });
    const caseCount = await prisma.case.count({ where: { userId: finalUserId } });

    if (user?.subscriptionTier === 'FREE' && caseCount >= 5) {
        res.status(403).json({ 
            error: 'Limite do Plano Free Atingido (5 processos).',
            message: 'Faça o upgrade para o Plano Premium para monitoramento ilimitado.' 
        });
        return;
    }
    // ------------------------------------

    // --- BUSCA INICIAL NO DATAJUD (FREE) ---
    const metadata = await datajudService.fetchCaseDetails(caseNumber, courtSystem || 'TJSP');
    
    const newCase = await prisma.case.create({
        data: {
            userId: finalUserId,
            caseNumber,
            courtSystem: metadata?.court || courtSystem || "TJSP",
            status: "ACTIVE"
        }
    });

    // Se encontramos movimentos, processamos o último para ver se gera prazo (IA Gemini)
    if (metadata && metadata.movements && metadata.movements.length > 0) {
        const lastMove = metadata.movements[0];
        
        // Registrar o movimento como um evento inicial
        const event = await prisma.event.create({
            data: {
                userId: finalUserId,
                relatedCaseId: newCase.id,
                title: `Última Movimentação: ${lastMove.movimento?.nome || 'Andamento'}`,
                description: lastMove.descricao || '',
                startTime: new Date(lastMove.dataHora),
                endTime: new Date(lastMove.dataHora),
                eventType: 'HEARING' // Default provisório
            }
        });

        // Chamar o motor de prazos (IA Gemini)
        await calculateAndCreateDeadline(newCase.id, event.title, event.description || '');
    }

    res.status(201).json({ 
        message: 'Processo cadastrado e analisado via Datajud/Gemini', 
        data: newCase,
        metadataFound: !!metadata 
    });
  } catch (error: any) {
    console.error('[CaseController] Erro:', error);
    res.status(500).json({ error: 'Erro ao cadastrar processo', details: error.message });
  }
};

export const listCases = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const userId = authUser?.id;

    if (!userId) {
        res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
        return;
    }
    
    const cases = await prisma.case.findMany({
        where: { userId },
        include: {
            events: {
                take: 1,
                orderBy: { startTime: 'desc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ data: cases });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao listar processos', details: error.message });
  }
};
