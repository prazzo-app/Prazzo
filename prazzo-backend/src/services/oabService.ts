export const validateOAB = async (oabNumber: string, oabState: string): Promise<{ valid: boolean; name?: string }> => {
  // Simulação de uma chamada de API ao CNA (Cadastro Nacional dos Advogados)
  // No MVP todos os formatos básicos são válidos para demonstração.
  
  if (!oabNumber || !oabState) {
    return { valid: false };
  }

  // Regex para formato numérico (ex: 123456)
  const isNumeric = /^\d+$/.test(oabNumber);
  const isValidState = /^[A-Z]{2}$/.test(oabState);

  if (!isNumeric || !isValidState) {
    return { valid: false };
  }

  // Mock de sucesso: Em um cenário real, consultaríamos uma API externa aqui.
  return { 
    valid: true,
    name: "Dr. Advogado Validado" // Nome retornado pelo órgão oficial
  };
};
