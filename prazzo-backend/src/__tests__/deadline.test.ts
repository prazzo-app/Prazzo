import { prismaMock } from './setup';
import { geminiService } from '../services/geminiService';

// Mock Gemini Service
jest.mock('../services/geminiService');

import { calculateAndCreateDeadline } from '../services/deadlineService';

describe('Deadline Service (Gemini)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a deadline when Gemini IA detects one', async () => {
    const caseId = 'case-123';
    const movementText = 'Publicada a sentença. Prazo de 15 dias para apelação.';

    // Mock Gemini response
    (geminiService.generateStructuredContent as jest.Mock).mockResolvedValue({
      hasDeadline: true,
      days: 15,
      reason: 'Apelação',
      priority: 'urgent'
    });

    // Mock Prisma lookups
    prismaMock.case.findUnique.mockResolvedValue({ id: caseId, userId: 'user-789' } as any);
    prismaMock.event.create.mockResolvedValue({ id: 'event-999' } as any);
    prismaMock.deadline.create.mockResolvedValue({ id: 'dl-111' } as any);

    await calculateAndCreateDeadline(caseId, 'Sentença', movementText);

    expect(geminiService.generateStructuredContent).toHaveBeenCalled();
    
    expect(prismaMock.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: expect.stringMatching(/PRAZO:.*Apelação/),
        eventType: 'DEADLINE'
      })
    }));

    expect(prismaMock.deadline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventId: 'event-999',
        status: 'PENDING'
      })
    }));
  });

  it('should NOT create a deadline when Gemini IA does not detect one', async () => {
    (geminiService.generateStructuredContent as jest.Mock).mockResolvedValue({
      hasDeadline: false
    });

    await calculateAndCreateDeadline('case-123', 'Aviso', 'Apenas um aviso informativo.');

    expect(prismaMock.event.create).not.toHaveBeenCalled();
    expect(prismaMock.deadline.create).not.toHaveBeenCalled();
  });
});
