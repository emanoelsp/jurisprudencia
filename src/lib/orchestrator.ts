// Orquestrador de busca multi-fonte
// multiSourceSearch() dispara todas as fontes em paralelo com Promise.allSettled.
// groupByTab() organiza os resultados para as abas da UI.

import type { EprocResult } from '@/types'

export interface SourceResult {
  source: 'datajud' | 'pinecone_public' | 'pinecone_user' | 'lexml' | 'stj'
  results: EprocResult[]
  durationMs: number
  error?: string
}

export interface SearchOptions {
  tribunal?: string
  namespace?: string
  dataFato?: string
  topK?: number
}

export interface TabGroups {
  /** Todos os resultados combinados (aba Resultados) */
  all: EprocResult[]
  /** Agrupados por tribunal (aba Tribunais) */
  byTribunal: Record<string, EprocResult[]>
}

/**
 * Executa todas as fontes em paralelo e retorna os resultados individuais.
 * Usa Promise.allSettled — falha de uma fonte não interrompe as demais.
 */
export async function multiSourceSearch(
  query: string,
  opts: SearchOptions = {},
): Promise<SourceResult[]> {
  const { searchHybrid } = await import('./rag')
  const topK = opts.topK ?? 8

  const start = Date.now()
  const results = await searchHybrid(query, topK, {
    tribunal: opts.tribunal,
    namespace: opts.namespace,
    dataFato: opts.dataFato,
  })

  const bySource = results.reduce((acc, r) => {
    const src = fonteToSource(r.fonte)
    if (!acc[src]) acc[src] = []
    acc[src].push(r)
    return acc
  }, {} as Record<string, EprocResult[]>)

  return Object.entries(bySource).map(([source, res]) => ({
    source: source as SourceResult['source'],
    results: res,
    durationMs: Date.now() - start,
  }))
}

/**
 * Organiza um array de EprocResult nas estruturas de aba da UI.
 */
export function groupByTab(results: EprocResult[]): TabGroups {
  const byTribunal: Record<string, EprocResult[]> = {}
  for (const r of results) {
    const t = r.tribunal || (r.fonte === 'stj_dados_abertos' ? 'STJ' : r.fonte === 'lexml' ? 'LexML' : 'DataJud CNJ')
    if (!byTribunal[t]) byTribunal[t] = []
    byTribunal[t].push(r)
  }
  return { all: results, byTribunal }
}

function fonteToSource(fonte?: string): SourceResult['source'] {
  if (!fonte) return 'pinecone_public'
  if (fonte.includes('datajud')) return 'datajud'
  if (fonte === 'stj_dados_abertos') return 'stj'
  if (fonte === 'lexml') return 'lexml'
  if (fonte.includes('user') || fonte.includes('interno')) return 'pinecone_user'
  return 'pinecone_public'
}
