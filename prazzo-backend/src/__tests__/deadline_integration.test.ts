import { deadlineService } from '../services/deadlineService';
import { holidayService } from '../services/holidayService';

// Mock do HolidayService
jest.mock('../services/holidayService');

describe('Deadline Service Integration (Optimized Logic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve calcular corretamente um prazo de 5 dias úteis sem feriados', async () => {
    // Quinta-feira, 25 de Abril de 2024
    const startDate = new Date('2024-04-25T12:00:00Z');
    
    // Mocks: nenhum feriado
    (holidayService.getHolidays as jest.Mock).mockResolvedValue([]);

    const dueDate = await deadlineService.calculateLegalDeadline(startDate, 5, 'SP');

    // Contagem:
    // Sex (1), Sab (X), Dom (X), Seg (2), Ter (3), Qua (4), Qui (5)
    // Resultado deve ser Quinta, 02 de Maio
    expect(dueDate.toISOString().split('T')[0]).toBe('2024-05-02');
  });

  it('deve pular feriados nacionais corretamente', async () => {
    // Quarta-feira, 17 de Abril de 2024
    const startDate = new Date('2024-04-17T12:00:00Z');
    
    // Mock: 21 de Abril (Tiradentes - Domingo) e 23 de Abril (São Jorge - Terça, estadual RJ simulado em SP)
    (holidayService.getHolidays as jest.Mock).mockResolvedValue([
      { date: '2024-04-21', name: 'Tiradentes' },
      { date: '2024-04-23', name: 'Feriado Simulado' }
    ]);

    const dueDate = await deadlineService.calculateLegalDeadline(startDate, 5, 'SP');

    // Contagem:
    // Qui (18 - 1), Sex (19 - 2), Sab (20 - X), Dom (21 - X), Seg (22 - 3), Ter (23 - FERIADO), Qua (24 - 4), Qui (25 - 5)
    expect(dueDate.toISOString().split('T')[0]).toBe('2024-04-25');
  });

  it('deve lidar com prazos que cruzam a virada do ano', async () => {
    // Quinta-feira, 26 de Dezembro de 2024
    const startDate = new Date('2024-12-26T12:00:00Z');
    
    (holidayService.getHolidays as jest.Mock).mockImplementation(async (year) => {
      if (year === 2024) return [{ date: '2024-12-25', name: 'Natal' }];
      if (year === 2025) return [{ date: '2025-01-01', name: 'Ano Novo' }];
      return [];
    });

    const dueDate = await deadlineService.calculateLegalDeadline(startDate, 3, 'SP');

    // Contagem:
    // Sex (27 - 1), Sab (28 - X), Dom (29 - X), Seg (30 - 2), Ter (31 - 3)
    // Se o prazo for 3 dias úteis:
    expect(dueDate.toISOString().split('T')[0]).toBe('2024-12-31');
    
    // Teste com 5 dias úteis (cruzando ano)
    const dueDateLong = await deadlineService.calculateLegalDeadline(startDate, 5, 'SP');
    // Contagem: ... Ter (31 - 3), Qua (01 - FERIADO), Qui (02 - 4), Sex (03 - 5)
    expect(dueDateLong.toISOString().split('T')[0]).toBe('2025-01-03');
  });
});
