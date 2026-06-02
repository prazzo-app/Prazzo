import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const createEvent = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const userId = authUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { title, description, startTime, endTime, relatedCaseId, eventType, creationSource } = req.body;

    const newEvent = await prisma.event.create({
      data: {
        userId,
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        relatedCaseId,
        eventType: eventType || 'MEETING',
        creationSource: creationSource || 'MANUAL',
      },
    });

    return res.status(201).json({ data: newEvent });
  } catch (error: any) {
    console.error('[EventController] Erro ao criar evento:', error);
    return res.status(500).json({ error: 'Erro ao criar evento', details: error.message });
  }
};

export const listEvents = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const userId = authUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // P1-PERF: Extrair parâmetros de paginação e filtros
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const eventType = req.query.eventType as string;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (eventType) {
      where.eventType = eventType;
    }

    // Busca eventos paginados
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: { relatedCase: true },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where })
    ]);

    return res.status(200).json({ 
      data: events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[EventController] Erro ao listar eventos:', error);
    return res.status(500).json({ error: 'Erro ao listar eventos', details: error.message });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authUser = (req as any).user;
    const userId = authUser?.id;

    const { title, description, startTime, endTime, relatedCaseId, eventType } = req.body;

    const event = await prisma.event.findFirst({
      where: { id: id as string, userId: userId as string }
    });

    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: id as string },
      data: {
        title,
        description,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        relatedCaseId,
        eventType,
      },
    });

    return res.status(200).json({ data: updatedEvent });
  } catch (error: any) {
    console.error('[EventController] Erro ao atualizar evento:', error);
    return res.status(500).json({ error: 'Erro ao atualizar evento', details: error.message });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authUser = (req as any).user;
    const userId = authUser?.id;

    const event = await prisma.event.findFirst({
      where: { id: id as string, userId: userId as string }
    });

    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    await prisma.event.delete({
      where: { id: id as string },
    });

    return res.status(204).send();
  } catch (error: any) {
    console.error('[EventController] Erro ao deletar evento:', error);
    return res.status(500).json({ error: 'Erro ao deletar evento', details: error.message });
  }
};
