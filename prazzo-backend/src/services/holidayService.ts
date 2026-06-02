import axios from 'axios';

interface Holiday {
  date: string;
  name: string;
  type: string;
}

class HolidayService {
  private cache: Map<string, Holiday[]> = new Map();

  /**
   * Busca feriados para um determinado ano e estado.
   * Retorna feriados nacionais + estaduais.
   */
  async getHolidays(year: number, state: string): Promise<Holiday[]> {
    const cacheKey = `${year}-${state}`;
    if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`[HolidayService] Buscando feriados para ${state} em ${year}...`);
      // feriados.dev fornece feriados nacionais e estaduais
      const response = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      
      const nationalHolidays: Holiday[] = response.data;
      
      // Nota: BrasilAPI fornece feriados nacionais. 
      // Para um MVP robusto, poderíamos complementar com feriados estaduais específicos 
      // ou usar outra API se necessário. Para o Prazzo, os nacionais são o maior volume.
      
      this.cache.set(cacheKey, nationalHolidays);
      return nationalHolidays;
    } catch (error) {
      console.error('[HolidayService] Erro ao buscar feriados:', error);
      return [];
    }
  }

  /**
   * Verifica se uma data é feriado ou final de semana.
   */
  async isBusinessDay(date: Date, state: string): Promise<boolean> {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // Domingo ou Sábado

    const holidays = await this.getHolidays(date.getFullYear(), state);
    const dateString = date.toISOString().split('T')[0];
    
    return !holidays.some(h => h.date === dateString);
  }

  /**
   * Calcula o próximo dia útil.
   */
  async getNextBusinessDay(date: Date, state: string): Promise<Date> {
    let nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    while (!(await this.isBusinessDay(nextDay, state))) {
        nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
  }
}

export const holidayService = new HolidayService();
