// Tool: Pesquisa em bases públicas (DataJud)
// Interface com APIs de tribunais para extrair jurisprudência

import { fetchDataJudByQuery } from '@/lib/datajud'
import type { EprocResult } from '@/types'
import { scoreToBadge } from '@/lib/rag'

export interface SearchPublicBasesParams {
  queryText: string
  tribunal: string
  topK?: number
}

/**
 * Busca jurisprudência em bases públicas (DataJud API).
 * Usado como tool pelo agente ou diretamente pelo pipeline RAG.
 */
export async function searchPublicBases(
  params: SearchPublicBasesParams
): Promise<EprocResult[]> {
  const { queryText, tribunal, topK = 8 } = params
  const apiKey = process.env.DATAJUD_API_KEY

  if (!apiKey || !tribunal || tribunal.toUpperCase() === 'TODOS') {
    return []
  }

  try {
    const docs = await fetchDataJudByQuery({
      queryText,
      tribunalSigla: tribunal.trim().toUpperCase(),
      apiKey,
      size: topK,
    })

    return docs.map((d, i) => ({
      id: d.id,
      numero: d.numero,
      ementa: d.ementa,
      tribunal: d.tribunal,
      relator: d.relator,
      dataJulgamento: d.dataJulgamento,
      score: 0.85 - i * 0.04,
      badge: scoreToBadge(0.85 - i * 0.04),
      fonte: 'datajud_cnj' as const,
    }))
  } catch (err) {
    console.warn('[search-public-bases] failed', err)
    return []
  }
}
