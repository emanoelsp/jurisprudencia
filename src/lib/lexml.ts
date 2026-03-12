// Cliente LexML – busca no portal (SRU se disponível; fallback via página de busca)
// https://www.lexml.gov.br

export interface LexMLDocumento {
  id: string
  urn: string
  tipoDocumento: string
  titulo: string
  ementa: string
  data: string
  localidade?: string
  autoridade?: string
  url: string
}

const LEXML_SRU_BASE =
  process.env.LEXML_SRU_BASE || 'https://www.lexml.gov.br/busca/SRU'
const LEXML_SEARCH_BASE =
  process.env.LEXML_SEARCH_BASE || 'https://www.lexml.gov.br/busca/search'

const BROWSER_HEADERS: HeadersInit = {
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'User-Agent':
    process.env.LEXML_USER_AGENT ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

/** Constrói query CQL para busca por texto (padrão SRU/LexML, ex: dc.description any "termo") */
function buildCqlQuery(queryText: string): string {
  const terms = queryText
    .trim()
    .replace(/\s+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .slice(0, 5)
  if (terms.length === 0) return 'cql.allRecords=1'
  const sub = terms.map(t => `dc.description any "${escapeCql(t)}"`).join(' or ')
  return `(${sub})`
}

function escapeCql(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\\/g, '\\\\')
}

/** Faz request ao SRU LexML e retorna XML como string */
async function fetchLexMLRaw(
  cqlQuery: string,
  startRecord = 1,
  maximumRecords = 10
): Promise<string> {
  const q = encodeURIComponent(cqlQuery)
  const url = `${LEXML_SRU_BASE}?operation=searchRetrieve&version=1.1&query=${q}&startRecord=${startRecord}&maximumRecords=${maximumRecords}`

  const res = await fetch(url, {
    headers: { Accept: 'application/xml', ...BROWSER_HEADERS },
  })

  if (!res.ok) {
    throw new Error(`LexML SRU failed: ${res.status} ${await res.text()}`)
  }
  return res.text()
}

/** Parse XML SRU para extrair dc records (simplificado, sem dependência de XML parser pesado) */
function parseSruXml(xml: string): LexMLDocumento[] {
  const docs: LexMLDocumento[] = []
  const tagValue = (block: string, tag: string): string => {
    const local = tag.includes(':') ? tag.split(':')[1] : tag
    const re = new RegExp(`<[^>]*:?${local}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${local}>`, 'i')
    const m = block.match(re)
    return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''
  }

  let m: RegExpExecArray | null
  // SRU retorna <srw:recordData> ou <recordData> com <srw_dc:dc> ou similar
  const regex = /<[^:>]*:?recordData[^>]*>([\s\S]*?)<\/[^:>]*:?recordData>/gi
  while ((m = regex.exec(xml)) !== null) {
    const block = m[1]
    const urn = tagValue(block, 'urn') || tagValue(block, 'identifier') || tagValue(block, 'dc:identifier')
    const tipo = tagValue(block, 'tipoDocumento')
    const titulo = tagValue(block, 'title') || tagValue(block, 'dc:title')
    const desc = tagValue(block, 'description') || tagValue(block, 'dc:description')
    const data = tagValue(block, 'date') || tagValue(block, 'dc:date')
    const localidade = tagValue(block, 'localidade')
    const autoridade = tagValue(block, 'autoridade')

    if (!urn && !titulo && !desc) continue

    const ementa = desc || titulo || ''
    if (ementa.length < 20) continue

    docs.push({
      id: urn || `lexml-${docs.length}`,
      urn: urn || '',
      tipoDocumento: tipo || 'Documento',
      titulo: titulo || ementa.slice(0, 120),
      ementa,
      data,
      localidade: localidade || undefined,
      autoridade: autoridade || undefined,
      url: urn ? `https://www.lexml.gov.br/urn/${urn}` : '',
    })
  }
  return docs
}

/** Extrai termos de busca (até 4 palavras) para a URL */
function searchTerms(queryText: string): string {
  return queryText
    .trim()
    .replace(/\s+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .slice(0, 4)
    .join(' ')
}

/**
 * Fallback: busca na página HTML do LexML (GET com User-Agent de navegador).
 * O portal pode retornar 403 para scripts; nesse caso o RAG segue sem LexML.
 */
async function fetchLexMLBySearchPage(queryText: string, size: number): Promise<LexMLDocumento[]> {
  const q = searchTerms(queryText)
  if (!q) return []
  const url = `${LEXML_SEARCH_BASE}?smode=simple&q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    return parseLexMLSearchHtml(html, size)
  } catch {
    return []
  }
}

/** Parse da página de resultados do LexML (links para /urn/ e títulos) */
function parseLexMLSearchHtml(html: string, max: number): LexMLDocumento[] {
  const docs: LexMLDocumento[] = []
  // Links para documento: href="/urn/..." ou href=".../urn/..."
  const urnRegex = /href="(?:https?:\/\/[^"]*)?\/urn\/([^"?#]+)"/gi
  const titleRegex = /<a[^>]+href="[^"]*\/urn\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = urnRegex.exec(html)) !== null && docs.length < max) {
    const urn = (m[1] || '').trim()
    if (!urn || seen.has(urn)) continue
    seen.add(urn)
    const title = urn.replace(/[:;/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    docs.push({
      id: `lexml-${urn.slice(0, 50)}`,
      urn,
      tipoDocumento: 'Documento',
      titulo: title || urn,
      ementa: title || `Documento LexML: ${urn.slice(0, 80)}`,
      data: '',
      url: `https://www.lexml.gov.br/urn/${urn}`,
    })
  }
  return docs.slice(0, max)
}

/**
 * Busca no LexML por texto. Tenta SRU; se falhar, tenta a página de busca (GET + User-Agent).
 * Retorna legislação, jurisprudência e normas.
 */
export async function fetchLexMLByQuery(params: {
  queryText: string
  size?: number
}): Promise<LexMLDocumento[]> {
  const { queryText, size = 6 } = params
  if (!queryText?.trim()) return []

  // 1) Tentativa via API SRU (pode não existir mais)
  try {
    const cql = buildCqlQuery(queryText)
    const xml = await fetchLexMLRaw(cql, 1, size)
    const docs = parseSruXml(xml)
    if (docs.length > 0) return docs.slice(0, size)
  } catch {
    // SRU indisponível – segue para fallback
  }

  // 2) Fallback: página de busca com User-Agent de navegador
  const fromPage = await fetchLexMLBySearchPage(queryText, size)
  return fromPage.slice(0, size)
}
