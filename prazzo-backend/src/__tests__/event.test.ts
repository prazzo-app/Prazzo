import { createEvent, listEvents, updateEvent, deleteEvent } from '../controllers/eventController';
import { Request, Response } from 'express';
import { prismaMock } from './setup';

describe('Event Controller', () => {
    let req: any;
    let res: any;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        res = {
            status: jest.fn().mockImplementation((s) => {
                res.statusCode = s;
                return res;
            }),
            json: jsonMock,
            send: jest.fn()
        };
        req = {
            user: { id: 'user-123' },
            body: {},
            params: {}
        };
    });

    describe('createEvent', () => {
        it('should create an event successfully', async () => {
            req.body = {
                title: 'Audiência de Teste',
                startTime: new Date('2024-05-10T14:00:00Z').toISOString(),
                endTime: new Date('2024-05-10T15:00:00Z').toISOString(),
                eventType: 'AUDIENCE'
            };

            prismaMock.event.create.mockResolvedValue({ id: 'event-1', ...req.body, userId: 'user-123' } as any);

            await createEvent(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ title: 'Audiência de Teste' })
            }));
        });
    });

    describe('listEvents', () => {
        it('should list user events', async () => {
            const mockEvents = [
                { id: '1', title: 'Evento 1' },
                { id: '2', title: 'Evento 2' }
            ];
            prismaMock.event.findMany.mockResolvedValue(mockEvents as any);

            await listEvents(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ data: mockEvents });
        });
    });

    describe('updateEvent', () => {
        it('should update an existing event', async () => {
            req.params.id = 'event-1';
            req.body.title = 'Título Atualizado';
            
            prismaMock.event.findFirst.mockResolvedValue({ id: 'event-1', userId: 'user-123' } as any);
            prismaMock.event.update.mockResolvedValue({ id: 'event-1', title: 'Título Atualizado' } as any);

            await updateEvent(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ title: 'Título Atualizado' })
            }));
        });

        it('should return 404 if event not found during update', async () => {
            req.params.id = 'invalid-id';
            prismaMock.event.findFirst.mockResolvedValue(null);

            await updateEvent(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('deleteEvent', () => {
        it('should delete event successfully', async () => {
            req.params.id = 'event-1';
            prismaMock.event.findFirst.mockResolvedValue({ id: 'event-1', userId: 'user-123' } as any);

            await deleteEvent(req as Request, res as Response);

            expect(res.send).toHaveBeenCalled();
            expect(prismaMock.event.delete).toHaveBeenCalledWith({
                where: { id: 'event-1' }
            });
        });

        it('should return 404 if event not found during delete', async () => {
            req.params.id = 'invalid-id';
            prismaMock.event.findFirst.mockResolvedValue(null);

            await deleteEvent(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
