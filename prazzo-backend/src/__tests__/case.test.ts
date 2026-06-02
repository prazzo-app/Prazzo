import { createCase, listCases } from '../controllers/caseController';
import { Request, Response } from 'express';
import { prismaMock } from './setup';
import { datajudService } from '../services/datajudService';
import { calculateAndCreateDeadline } from '../services/deadlineService';

// Mock dependências externas
jest.mock('../services/datajudService');
jest.mock('../services/deadlineService');

describe('Case Controller (Datajud + Gemini)', () => {
    let req: any;
    let res: any;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = { status: statusMock };
        req = { user: { id: 'user-123' }, body: {} };
        jest.clearAllMocks();
    });

    describe('createCase', () => {
        it('should create a new case and fetch metadata from Datajud', async () => {
            req.body = { caseNumber: '000123-45.2024.8.26.0000', courtSystem: 'TJSP' };

            // Mocks
            prismaMock.user.findUnique.mockResolvedValue({ id: 'user-123', subscriptionTier: 'FREE' } as any);
            prismaMock.case.count.mockResolvedValue(2); 
            prismaMock.case.create.mockResolvedValue({ id: 'case-1', ...req.body, userId: 'user-123' } as any);
            prismaMock.event.create.mockResolvedValue({ id: 'event-1' } as any);
            
            (datajudService.fetchCaseDetails as jest.Mock).mockResolvedValue({
                court: 'TJSP',
                movements: [{ movimento: { nome: 'Andamento X' }, dataHora: '2024-04-05T10:00:00Z', descricao: 'Teste' }]
            });

            await createCase(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Processo cadastrado e analisado via Datajud/Gemini',
                metadataFound: true
            }));
            expect(datajudService.fetchCaseDetails).toHaveBeenCalled();
            expect(calculateAndCreateDeadline).toHaveBeenCalled();
        });

        it('should return 403 when FREE user reaches 5 cases limit', async () => {
            req.body = { caseNumber: '000123-45.2024.8.26.0000' };

            prismaMock.user.findUnique.mockResolvedValue({ id: 'user-123', subscriptionTier: 'FREE' } as any);
            prismaMock.case.count.mockResolvedValue(5); 

            await createCase(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Limite do Plano Free Atingido (5 processos).'
            }));
        });
    });

    describe('listCases', () => {
        it('should return list of cases for the user', async () => {
            prismaMock.case.findMany.mockResolvedValue([
                { id: '1', caseNumber: '123' },
                { id: '2', caseNumber: '456' }
            ] as any);

            await listCases(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.any(Array)
            }));
        });
    });
});
