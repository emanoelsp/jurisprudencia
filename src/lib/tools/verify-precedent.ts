// Tool: Verificador de precedentes
// Consulta se uma decisão ainda é válida ou foi superada por súmula vinculante ou tese de repercussão geral

export interface VerifyPrecedentResult {
  numero: string
  tribunal: string
  valid: boolean
  superadaPor?: string
  observacao?: string
}

/** Súmulas vinculantes STF conhecidas (exemplo – expandir conforme corpus) */
const SUMULAS_STF = new Set([
  '11', '12', '13', '14', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '339', '473', '477', '631', '635', '714',
])

/**
 * Verifica se um precedente ainda é válido ou foi superado.
 * TODO: Integrar com base de súmulas/teses STF/STJ (API ou corpus).
 * Por ora retorna valid: true com observação de que a verificação é limitada.
 */
export async function verifyPrecedent(
  numero: string,
  tribunal: string,
  _ementa?: string
): Promise<VerifyPrecedentResult> {
  const t = tribunal.toUpperCase()

  // Se tribunal for STF e ementa mencionar súmula vinculante, sinalizar
  if (t === 'STF' && _ementa) {
    const sumulaMatch = _ementa.match(/súmula\s+(?:vinculante\s+)?(\d+)/i)
    if (sumulaMatch && SUMULAS_STF.has(sumulaMatch[1])) {
      return {
        numero,
        tribunal,
        valid: true,
        observacao: `Súmula vinculante ${sumulaMatch[1]} STF aplicável.`,
      }
    }
  }

  return {
    numero,
    tribunal,
    valid: true,
    observacao: 'Verificação de vigência limitada. Recomenda-se consulta manual em bases oficiais.',
  }
}
