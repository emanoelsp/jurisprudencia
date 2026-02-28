export interface DataJudProcesso {
  id: string
  numero: string
  tribunal: string
  dataJulgamento: string
  relator: string
  ementa: string
  texto: string
  classe?: string
  orgaoJulgador?: string
}

/** Mapeamento sigla do tribunal (UI/Pinecone filter) ↔ alias DataJud API */
export const SIGLA_TO_DATAJUD_ALIAS: Record<string, string> = {
  STF: 'api_publica_stf',
  STJ: 'api_publica_stj',
  TST: 'api_publica_tst',
  TSE: 'api_publica_tse',
  STM: 'api_publica_stm',
  TRF1: 'api_publica_trf1',
  TRF2: 'api_publica_trf2',
  TRF3: 'api_publica_trf3',
  TRF4: 'api_publica_trf4',
  TRF5: 'api_publica_trf5',
  TRF6: 'api_publica_trf6',
  TJAC: 'api_publica_tjac',
  TJAL: 'api_publica_tjal',
  TJAM: 'api_publica_tjam',
  TJAP: 'api_publica_tjap',
  TJBA: 'api_publica_tjba',
  TJCE: 'api_publica_tjce',
  TJDFT: 'api_publica_tjdft',
  TJES: 'api_publica_tjes',
  TJGO: 'api_publica_tjgo',
  TJMA: 'api_publica_tjma',
  TJMG: 'api_publica_tjmg',
  TJMS: 'api_publica_tjms',
  TJMT: 'api_publica_tjmt',
  TJPA: 'api_publica_tjpa',
  TJPB: 'api_publica_tjpb',
  TJPE: 'api_publica_tjpe',
  TJPI: 'api_publica_tjpi',
  TJPR: 'api_publica_tjpr',
  TJRJ: 'api_publica_tjrj',
  TJRN: 'api_publica_tjrn',
  TJRO: 'api_publica_tjro',
  TJRR: 'api_publica_tjrr',
  TJRS: 'api_publica_tjrs',
  TJSC: 'api_publica_tjsc',
  TJSE: 'api_publica_tjse',
  TJSP: 'api_publica_tjsp',
  TJTO: 'api_publica_tjto',
}

export function siglaToDataJudAlias(sigla: string): string | undefined {
  return SIGLA_TO_DATAJUD_ALIAS[sigla?.trim().toUpperCase()]
}

export function dataJudAliasToSigla(alias: string): string {
  const normalized = String(alias || '').toLowerCase()
  for (const [sigla, a] of Object.entries(SIGLA_TO_DATAJUD_ALIAS)) {
    if (a.toLowerCase() === normalized) return sigla
  }
  const match = normalized.match(/api_publica_(.+)/)
  return match ? match[1].toUpperCase() : alias
}

interface FetchDataJudParams {
  tribunalAlias: string
  apiKey: string
  size?: number
  from?: number
  dateFrom?: string
  dateTo?: string
}

function buildDataJudUrl(tribunalAlias: string) {
  const base = process.env.DATAJUD_BASE_URL || 'https://api-publica.datajud.cnj.jus.br'
  return `${base.replace(/\/$/, '')}/${tribunalAlias}/_search`
}

export async function fetchDataJudProcessos(params: FetchDataJudParams): Promise<DataJudProcesso[]> {
  const { tribunalAlias, apiKey, size = 30, from = 0, dateFrom, dateTo } = params
  const filters: any[] = []

  if (dateFrom || dateTo) {
    filters.push({
      range: {
        dataAjuizamento: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        },
      },
    })
  }

  const body = {
    from,
    size,
    sort: [{ dataAjuizamento: { order: 'desc' } }],
    query: {
      bool: {
        must: [{ exists: { field: 'numeroProcesso' } }],
        filter: filters,
      },
    },
  }

  const response = await fetch(buildDataJudUrl(tribunalAlias), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `APIKey ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`DataJud search failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const hits = Array.isArray(data?.hits?.hits) ? data.hits.hits : []

  return hits
    .map((hit: any, index: number) => normalizeDataJudDoc(hit?._source || hit, index, tribunalAlias))
    .filter((doc: DataJudProcesso | null): doc is DataJudProcesso => !!doc)
}

/** Busca na API DataJud por texto. Fallback: busca simples (últimos processos) se query falhar. */
export async function fetchDataJudByQuery(params: {
  queryText: string
  tribunalSigla?: string
  apiKey: string
  size?: number
}): Promise<DataJudProcesso[]> {
  const { queryText, tribunalSigla, apiKey, size = 8 } = params
  const tribunalAlias = tribunalSigla ? siglaToDataJudAlias(tribunalSigla) : undefined

  if (!tribunalAlias) {
    return []
  }

  // 1. Tenta busca full-text (match em ementa)
  const terms = queryText
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length >= 4)
    .slice(0, 10)

  if (terms.length > 0) {
    const queryVariants: any[] = [
      { match: { ementa: { query: terms.join(' '), operator: 'or', minimum_should_match: '30%' } } },
      { match: { textoEmenta: { query: terms.join(' '), operator: 'or', minimum_should_match: '30%' } } },
      { match: { texto: { query: terms.join(' '), operator: 'or', minimum_should_match: '30%' } } },
    ]
    try {
      const body = {
        from: 0,
        size,
        sort: [{ _score: { order: 'desc' } }, { dataAjuizamento: { order: 'desc' } }],
        query: {
          bool: {
            must: [{ exists: { field: 'numeroProcesso' } }],
            should: queryVariants,
            minimum_should_match: 1,
          },
        },
      }
      const response = await fetch(buildDataJudUrl(tribunalAlias), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `APIKey ${apiKey}` },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        const data = await response.json()
        const hits = Array.isArray(data?.hits?.hits) ? data.hits.hits : []
        const docs = hits
          .map((hit: any, i: number) => normalizeDataJudDoc(hit?._source || hit, i, tribunalAlias))
          .filter((d: DataJudProcesso | null): d is DataJudProcesso => !!d)
        if (docs.length > 0) return docs
      } else {
        console.warn('[datajud] query failed', response.status, await response.text().catch(() => ''))
      }
    } catch (err) {
      console.warn('[datajud] query exception', err)
    }
  }

  // 2. Fallback: busca simples (últimos processos do tribunal, sem filtro de texto)
  try {
    const docs = await fetchDataJudProcessos({
      tribunalAlias,
      apiKey,
      size,
    })
    return docs
  } catch (err) {
    console.warn('[datajud] fallback fetch failed', err)
    return []
  }
}

function normalizeDataJudDoc(source: any, index: number, tribunalAlias: string): DataJudProcesso | null {
  const numero = String(
    source?.numeroProcesso ||
    source?.numero_processo ||
    source?.processo?.numero ||
    ''
  ).trim()

  if (!numero) return null

  const ementaOriginal = String(
    source?.ementa ||
    source?.textoEmenta ||
    source?.texto ||
    ''
  ).trim()

  const resumoMovimentacoes = Array.isArray(source?.movimentos)
    ? source.movimentos
      .slice(0, 8)
      .map((m: any) => m?.nome || m?.descricao || '')
      .filter(Boolean)
      .join(' | ')
    : ''

  const isApenasMovimentacoes = (s: string) =>
    /^(?:[^|]{1,35}\s*\|\s*){2,}[^|]*$/.test(s) || (s.length < 80 && s.includes('|'))

  const ementa =
    ementaOriginal.length >= 80 && !isApenasMovimentacoes(ementaOriginal)
      ? ementaOriginal
      : resumoMovimentacoes
        ? `Ementa não disponível no data jud. Movimentações: ${resumoMovimentacoes}`
        : 'Ementa não disponível no data jud.'

  const texto = [ementa, resumoMovimentacoes].filter(Boolean).join('\n')
  if (texto.length < 20) return null

  const tribunalFromSource = source?.tribunal || source?.siglaTribunal
  const tribunal =
    tribunalFromSource
      ? String(tribunalFromSource).trim().toUpperCase()
      : dataJudAliasToSigla(tribunalAlias)

  return {
    id: `${numero}-${index}`,
    numero,
    tribunal,
    dataJulgamento: String(source?.dataJulgamento || source?.dataAjuizamento || '').trim(),
    relator: String(source?.relator || source?.nomeRelator || '').trim(),
    ementa: ementa || texto.slice(0, 800),
    texto,
    classe: String(source?.classe || source?.classeProcessual || '').trim() || undefined,
    orgaoJulgador: String(source?.orgaoJulgador || '').trim() || undefined,
  }
}
