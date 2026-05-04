// STJ Dados Abertos – CKAN API
// https://dadosabertos.web.stj.jus.br/
// Nota: busca em tempo real do STJ = DataJud (api_publica_stj). Este módulo
// acessa datasets em lote (espelhos de acórdãos, íntegras) para ingest.
//
// Se receber 403: o portal pode bloquear requisições de servidor. Teste no navegador
// ou com curl: curl -H "User-Agent: Mozilla/5.0" "https://dadosabertos.web.stj.jus.br/api/3/action/package_list"

const STJ_CKAN_BASE =
  process.env.STJ_CKAN_BASE || 'https://dadosabertos.web.stj.jus.br/api/3/action'

/** Headers para reduzir bloqueio (403) em alguns ambientes */
const CKAN_HEADERS: HeadersInit = {
  'Accept': 'application/json',
  'User-Agent':
    process.env.STJ_CKAN_USER_AGENT ||
    'JurisprudencIA/1.0 (https://github.com; dados abertos)',
}

export interface CkanResource {
  id: string
  name: string
  format: string
  url: string
  created?: string
  last_modified?: string
}

export interface CkanPackage {
  id: string
  name: string
  title: string
  notes?: string
  resources: CkanResource[]
}

/** Lista datasets (packages) do portal STJ Dados Abertos */
export async function listStjPackages(): Promise<string[]> {
  try {
    const res = await fetch(`${STJ_CKAN_BASE}/package_list`, {
      headers: CKAN_HEADERS,
    })
    if (!res.ok) throw new Error(`CKAN package_list: ${res.status}`)
    const data = await res.json()
    return data.result || []
  } catch (err) {
    console.warn('[stj-dados-abertos] package_list failed', err)
    return []
  }
}

/** Obtém metadados e recursos de um dataset STJ */
export async function getStjPackage(packageId: string): Promise<CkanPackage | null> {
  try {
    const res = await fetch(
      `${STJ_CKAN_BASE}/package_show?id=${encodeURIComponent(packageId)}`,
      { headers: CKAN_HEADERS }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.result || null
  } catch (err) {
    console.warn('[stj-dados-abertos] package_show failed', err)
    return null
  }
}

/** Retorna URLs de recursos de acórdãos/jurisprudência para ingest em lote */
export async function getStjAcordaosResourceUrls(): Promise<
  Array<{ package: string; resource: string; url: string; format: string }>
> {
  const packages = await listStjPackages()
  const urls: Array<{ package: string; resource: string; url: string; format: string }> = []

  const juriKeywords = ['acordao', 'acórdão', 'integras', 'espelho', 'jurisprudencia', 'decisao']
  for (const pkgId of packages) {
    const pkg = await getStjPackage(pkgId)
    if (!pkg?.resources?.length) continue
    const isJuri = juriKeywords.some(k =>
      (pkg.title + ' ' + (pkg.notes || '')).toLowerCase().includes(k)
    )
    if (!isJuri) continue
    for (const r of pkg.resources) {
      if (['zip', 'json', 'csv'].includes((r.format || '').toLowerCase())) {
        urls.push({
          package: pkg.title || pkgId,
          resource: r.name || r.id,
          url: r.url,
          format: r.format || 'unknown',
        })
      }
    }
  }
  return urls
}

/** Documento normalizado para ingest (compatível com DataJud/Pinecone) */
export interface StjDocNormalized {
  id: string
  numero: string
  ementa: string
  texto: string
  tribunal: string
  relator: string
  dataJulgamento: string
}

/** Baixa um recurso JSON do CKAN (mesmo User-Agent para evitar 403) */
export async function fetchResourceJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: CKAN_HEADERS })
  if (!res.ok) throw new Error(`STJ resource fetch failed: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

/** Extrai array de documentos de um JSON do STJ (formatos variados) */
export function parseStjResourceJson(data: unknown): StjDocNormalized[] {
  const out: StjDocNormalized[] = []
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.result) ? (data as any).result
    : Array.isArray((data as any)?.dados) ? (data as any).dados
    : Array.isArray((data as any)?.processos) ? (data as any).processos
    : Array.isArray((data as any)?.acordaos) ? (data as any).acordaos
    : Array.isArray((data as any)?.itens) ? (data as any).itens
    : []
  for (let i = 0; i < arr.length; i++) {
    const doc = normalizeStjDoc(arr[i], i)
    if (doc) out.push(doc)
  }
  return out
}

function normalizeStjDoc(raw: any, index: number): StjDocNormalized | null {
  const ementa = String(
    raw?.ementa ?? raw?.textoEmenta ?? raw?.decisao ?? raw?.acordao ?? raw?.resumo ?? raw?.texto ?? ''
  ).trim()
  const texto = String(
    raw?.texto ?? raw?.integra ?? raw?.conteudo ?? ementa
  ).trim()
  if (!ementa && !texto) return null
  const numero = String(
    raw?.numeroProcesso ?? raw?.numero_processo ?? raw?.processo ?? raw?.numero ?? raw?.id ?? `stj-${index}`
  ).trim()
  const data = String(
    raw?.dataJulgamento ?? raw?.data_julgamento ?? raw?.data ?? raw?.dataPublicacao ?? ''
  ).trim()
  const relator = String(raw?.relator ?? raw?.ministro ?? raw?.orgaoJulgador ?? '').trim()
  return {
    id: `stj-ckan-${numero.replace(/\s+/g, '')}-${index}`,
    numero,
    ementa: ementa || texto.slice(0, 500),
    texto: texto || ementa,
    tribunal: 'STJ',
    relator,
    dataJulgamento: data,
  }
}
