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

function normalizeDataJudDoc(source: any, index: number, tribunalAlias: string): DataJudProcesso | null {
  const numero = String(
    source?.numeroProcesso ||
    source?.numero_processo ||
    source?.processo?.numero ||
    ''
  ).trim()

  if (!numero) return null

  const ementa = String(
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

  const texto = [ementa, resumoMovimentacoes].filter(Boolean).join('\n')
  if (texto.length < 40) return null

  return {
    id: `${numero}-${index}`,
    numero,
    tribunal: String(source?.tribunal || source?.siglaTribunal || tribunalAlias).trim(),
    dataJulgamento: String(source?.dataJulgamento || source?.dataAjuizamento || '').trim(),
    relator: String(source?.relator || source?.nomeRelator || '').trim(),
    ementa: ementa || texto.slice(0, 800),
    texto,
    classe: String(source?.classe || source?.classeProcessual || '').trim() || undefined,
    orgaoJulgador: String(source?.orgaoJulgador || '').trim() || undefined,
  }
}
