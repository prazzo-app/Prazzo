import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Chave Pública do Datajud (CNJ) - Pode ser alterada pelo CNJ
const DATAJUD_PUBLIC_KEY = process.env.DATAJUD_API_KEY || "c3071221793c06ef97a05a02cd8af344";

export interface CaseMetadata {
  caseNumber: string;
  court: string;
  subject: string;
  class: string;
  lastUpdate: string;
  movements: any[];
}

export const datajudService = {
  /**
   * Busca um processo na API Pública do Datajud (CNJ)
   * @param caseNumber Número do processo formatado (CNJ)
   * @param tribunal Sigla do tribunal (ex: 'tjsp', 'trf1')
   */
  async fetchCaseDetails(caseNumber: string, tribunal: string): Promise<CaseMetadata | null> {
    try {
      console.log(`[Datajud] Buscando processo ${caseNumber} no tribunal ${tribunal}...`);
      
      const response = await axios.post(
        `https://api-publica.datajud.cnj.jus.br/v1/buscar-processo`,
        {
          numeroProcesso: caseNumber.replace(/[^0-9]/g, ""), // Somente números
        },
        {
          headers: {
            'Authorization': `APIKey ${DATAJUD_PUBLIC_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.hits && response.data.hits.hits.length > 0) {
        const source = response.data.hits.hits[0]._source;
        return {
          caseNumber: source.numeroProcesso,
          court: source.tribunal,
          subject: source.assuntos?.[0]?.nome || "Não informado",
          class: source.classe?.nome || "Não informado",
          lastUpdate: source.dataHoraUltimaAtualizacao,
          movements: source.movimentos || []
        };
      }

      return null;
    } catch (error: any) {
      console.error("[Datajud] Erro na consulta:", error.response?.data || error.message);
      return null;
    }
  }
};
