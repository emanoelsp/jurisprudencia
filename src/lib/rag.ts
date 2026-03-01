// src/lib/rag.ts
// RAG Pipeline: PDF → Chunks → Embeddings → Vector Search → Reranking → TOON → LLM
import type { EprocResult } from '@/types'
import { createToonPayload } from './toon'
import { aiClient, aiModels } from './ai'
import { parseExtractedMetadataJson } from './guards'
import { queryPinecone } from './pinecone'
import { fetchDataJudByQuery } from './datajud'

const EMBEDDING_CACHE_TTL_MS = 30 * 60 * 1000
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000
const RERANK_CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ITEMS = 200

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const embeddingCache = new Map<string, CacheEntry<number[]>>()
const searchCache = new Map<string, CacheEntry<EprocResult[]>>()
const rerankCache = new Map<string, CacheEntry<EprocResult[]>>()

function nowMs() {
  return Date.now()
}

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt < nowMs()) {
    cache.delete(key)
    return null
  }
  return hit.value
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  if (cache.size >= CACHE_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, { value, expiresAt: nowMs() + ttlMs })
}

function normalizeForCache(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeEmenta(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase()
}

// ─── 1. PDF Text Extraction ───────────────────────────────────────────────────

export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid SSR issues
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return data.text
}

// ─── 2. CNJ Metadata Extraction ──────────────────────────────────────────────

export interface ExtractedMetadata {
  numero: string
  cliente: string
  natureza: string
  vara: string
  tribunal: string
  dataProtocolo: string
}

const EMPTY_METADATA: ExtractedMetadata = {
  numero: '',
  cliente: '',
  natureza: '',
  vara: '',
  tribunal: '',
  dataProtocolo: '',
}

function normalizeDate(raw: string): string {
  const isoMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoMatch) return isoMatch[0]

  const brMatch = raw.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`

  return ''
}

function extractMetadataFallback(text: string): ExtractedMetadata {
  const numero = text.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] || ''
  const cliente =
    text.match(/(?:AUTOR\(A\)|AUTOR|REQUERENTE|CLIENTE)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const natureza =
    text.match(/(?:Classe|Natureza)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const vara =
    text.match(/(?:Vara|Órgão julgador|Orgao julgador)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const tribunal =
    text.match(/Tribunal\s*:\s*([^\n\r]+)/i)?.[1]?.trim() ||
    text.match(/\b(STJ|STF|TST|TJ[A-Z]{2}|TRF\d)\b/)?.[1] ||
    ''

  const rawData =
    text.match(/(?:Data de Protocolo|Protocolo|Data)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const dataProtocolo = normalizeDate(rawData)

  return { numero, cliente, natureza, vara, tribunal, dataProtocolo }
}

function sanitizeMetadata(input: Partial<ExtractedMetadata>): ExtractedMetadata {
  return {
    numero: input.numero?.trim() || '',
    cliente: input.cliente?.trim() || '',
    natureza: input.natureza?.trim() || '',
    vara: input.vara?.trim() || '',
    tribunal: input.tribunal?.trim() || '',
    dataProtocolo: normalizeDate(input.dataProtocolo?.trim() || ''),
  }
}

export async function extractMetadata(text: string): Promise<ExtractedMetadata> {
  const fallback = extractMetadataFallback(text)
  let modelData: ExtractedMetadata = EMPTY_METADATA

  try {
    const response = await aiClient.chat.completions.create({
      model: aiModels.chat,
      temperature: 0.1,
      top_p: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um extrator de metadados jurídicos. Extraia do texto os metadados do processo judicial.
Retorne APENAS JSON válido com os campos:
- numero: número CNJ no formato NNNNNNN-DD.AAAA.J.TT.OOOO (string)
- cliente: nome completo da parte autora/requerente (string)
- natureza: natureza da ação (ex: "Ação de Indenização por Danos Morais") (string)
- vara: vara/câmara (string, vazio se não encontrar)
- tribunal: tribunal (ex: TJSP, STJ, TRF4) (string, vazio se não encontrar)
- dataProtocolo: data de protocolo no formato YYYY-MM-DD (string, vazio se não encontrar)
Se não encontrar um campo, use string vazia.`,
        },
        {
          role: 'user',
          content: `Extraia os metadados deste texto processual:\n\n${text.slice(0, 3000)}`,
        },
      ],
    })

    const parsed = parseExtractedMetadataJson(response.choices[0].message.content || '')
    modelData = sanitizeMetadata(parsed || EMPTY_METADATA)
  } catch {
    modelData = EMPTY_METADATA
  }

  return {
    numero: modelData.numero || fallback.numero,
    cliente: modelData.cliente || fallback.cliente,
    natureza: modelData.natureza || fallback.natureza,
    vara: modelData.vara || fallback.vara,
    tribunal: modelData.tribunal || fallback.tribunal,
    dataProtocolo: modelData.dataProtocolo || fallback.dataProtocolo,
  }
}

// ─── 3. Chunking ─────────────────────────────────────────────────────────────

export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }

  return chunks.filter(c => c.trim().length > 50)
}

// ─── 4. Embeddings ────────────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.slice(0, 8191)
  const cacheKey = `${aiModels.embedding}:${normalizeForCache(input)}`
  const cached = getCache(embeddingCache, cacheKey)
  if (cached) return cached

  const response = await aiClient.embeddings.create({
    model: aiModels.embedding,
    input,
  })
  const embedding = response.data[0].embedding
  setCache(embeddingCache, cacheKey, embedding, EMBEDDING_CACHE_TTL_MS)
  return embedding
}

// ─── 5. Busca jurisprudência (RAG Híbrido: DataJud + Pinecone + RRF) ─────────────

const RRF_K = 60 // Reciprocal Rank Fusion constant

/**
 * Fusão Recíproca de Rank (RRF) – combina listas ranqueadas sem precisar de scores absolutos.
 * score(d) = Σ 1/(k + rank(d)) para cada lista onde d aparece.
 * Crucial para fusão keyword (DataJud) + vetorial (Pinecone).
 */
function fuseWithRRF(
  listA: EprocResult[],
  listB: EprocResult[],
  k = RRF_K
): EprocResult[] {
  const byKey = (r: EprocResult) => `${r.numero.trim()}::${normalizeEmenta(r.ementa).slice(0, 100)}`
  const scores = new Map<string, { score: number; result: EprocResult }>()

  for (const [list, source] of [
    [listA, 'A'] as const,
    [listB, 'B'] as const,
  ]) {
    list.forEach((r, rank) => {
      const key = byKey(r)
      const rrf = 1 / (k + rank + 1)
      const existing = scores.get(key)
      if (existing) {
        existing.score += rrf
      } else {
        scores.set(key, {
          score: rrf,
          result: { ...r, score: rrf },
        })
      }
    })
  }

  const fused = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result }) => {
      const maxRrf = 2 / (k + 1) // normalizado para 0..1
      const norm = Math.min(1, result.score / maxRrf)
      return { ...result, score: norm, badge: scoreToBadge(norm) }
    })

  return fused
}

/** Busca DataJud (keyword/sparse) – retorna EprocResult[] ou [] */
async function fetchDataJudResults(
  queryText: string,
  tribunal: string,
  topK: number
): Promise<EprocResult[]> {
  const apiKey = process.env.DATAJUD_API_KEY
  if (!apiKey || !tribunal || tribunal === 'TODOS') return []

  try {
    const docs = await fetchDataJudByQuery({
      queryText,
      tribunalSigla: tribunal,
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
      badge: scoreToBadge(0.85 - i * 0.04) as 'alta' | 'media' | 'baixa',
      fonte: 'datajud_cnj' as const,
    }))
  } catch (err) {
    console.warn('[rag] datajud query failed', err)
    return []
  }
}

/** Busca Pinecone (vetorial) – retorna EprocResult[] ou [] */
async function fetchPineconeResults(
  queryText: string,
  topK: number,
  tribunal: string,
  namespace: string
): Promise<EprocResult[]> {
  if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY) return []

  try {
    const vector = await generateEmbedding(queryText)
    const juriFilter = tribunal && tribunal !== 'TODOS' ? { tribunal: { $eq: tribunal } } : undefined
    const globalNamespace = process.env.PINECONE_NAMESPACE?.trim() || ''
    const legislacaoNamespace = process.env.PINECONE_LEGISLACAO_NAMESPACE?.trim() || 'legislacao'
    const allMatches: Array<{ m: any }> = []

    for (const ns of [namespace || '', globalNamespace].filter(Boolean)) {
      const data = await queryPinecone(vector, topK, juriFilter, ns || undefined)
      const matches = Array.isArray(data?.matches) ? data.matches : []
      matches.forEach((m: any) => allMatches.push({ m }))
    }
    const legisData = await queryPinecone(vector, Math.min(topK, 4), undefined, legislacaoNamespace)
    const legisMatches = Array.isArray(legisData?.matches) ? legisData.matches : []
    legisMatches.forEach((m: any) => allMatches.push({ m }))

    if (allMatches.length === 0) return []

    const seen = new Set<string>()
    return allMatches
      .sort((a, b) => (Number(b.m.score) || 0) - (Number(a.m.score) || 0))
      .slice(0, topK * 2) // buffer para dedupe
      .filter(({ m }) => {
        const id = String(m.id || '')
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map(({ m }, i): EprocResult => {
        const fonteRaw = m.metadata?.fonte as string | undefined
        const fonte: 'datajud_cnj' | 'base_interna' | 'mock' =
          fonteRaw === 'datajud_cnj' || fonteRaw === 'mock' ? fonteRaw : 'base_interna'
        return {
          id: String(m.id || `pc-${i}`),
          numero: String(m.metadata?.numero || m.metadata?.processo || m.metadata?.titulo || ''),
          ementa: String(m.metadata?.ementa || m.metadata?.texto || ''),
          tribunal: String(m.metadata?.tribunal || ''),
          relator: String(m.metadata?.relator || ''),
          dataJulgamento: String(m.metadata?.dataJulgamento || ''),
          score: Number(m.score || 0),
          badge: scoreToBadge(Number(m.score || 0)),
          fonte,
        }
      })
      .slice(0, topK)
  } catch (err) {
    console.warn('[rag] pinecone query failed', err)
    return []
  }
}

/**
 * RAG Híbrido: executa DataJud (keyword) e Pinecone (vetorial) em paralelo,
 * funde com RRF e deduplica. Quando ambos retornam, prioriza acórdãos
 * relevantes em ambos os rankings (termos exatos + semântica).
 */
export async function searchHybrid(
  queryText: string,
  topK = 8,
  options?: { tribunal?: string; namespace?: string }
): Promise<EprocResult[]> {
  const tribunal = options?.tribunal?.trim().toUpperCase() || ''
  const namespace = options?.namespace?.trim() || ''
  const cacheKey = `hybrid::${normalizeForCache(queryText)}::${topK}::${tribunal || 'ALL'}::${namespace || 'default'}`
  const cached = getCache(searchCache, cacheKey)
  if (cached) return cached.map(r => ({ ...r }))

  const hasDataJud = Boolean(process.env.DATAJUD_API_KEY && tribunal && tribunal !== 'TODOS')
  const hasPinecone = Boolean(process.env.PINECONE_HOST && process.env.PINECONE_API_KEY)

  let results: EprocResult[] = []

  if (hasDataJud && hasPinecone) {
    // Híbrido: DataJud + Pinecone em paralelo → RRF
    const [dataJudRes, pineconeRes] = await Promise.all([
      fetchDataJudResults(queryText, tribunal, topK + 4),
      fetchPineconeResults(queryText, topK + 4, tribunal, namespace),
    ])
    if (dataJudRes.length > 0 && pineconeRes.length > 0) {
      results = fuseWithRRF(dataJudRes, pineconeRes).slice(0, topK)
    } else if (dataJudRes.length > 0) {
      results = dataJudRes.slice(0, topK)
    } else if (pineconeRes.length > 0) {
      results = pineconeRes.slice(0, topK)
    }
  } else if (hasDataJud) {
    results = await fetchDataJudResults(queryText, tribunal, topK)
  } else if (hasPinecone) {
    results = await fetchPineconeResults(queryText, topK, tribunal, namespace)
  }

  if (results.length > 0) {
    setCache(searchCache, cacheKey, results, SEARCH_CACHE_TTL_MS)
  }
  return results.map(r => ({ ...r }))
}

/** Busca jurisprudência – usa RAG híbrido por padrão (DataJud + Pinecone + RRF). */
export async function searchEproc(
  queryText: string,
  topK = 8,
  options?: { tribunal?: string; namespace?: string; hybrid?: boolean }
): Promise<EprocResult[]> {
  const hybrid = options?.hybrid !== false
  if (hybrid) {
    return searchHybrid(queryText, topK, options)
  }

  // Fallback: comportamento legado (DataJud primeiro, Pinecone se vazio)
  const tribunal = options?.tribunal?.trim().toUpperCase() || ''
  const namespace = options?.namespace?.trim() || ''
  const cacheKey = `${normalizeForCache(queryText)}::${topK}::${tribunal || 'ALL'}::${namespace || 'default'}`
  const cached = getCache(searchCache, cacheKey)
  if (cached) return cached.map(r => ({ ...r }))

  let results = await fetchDataJudResults(queryText, tribunal, topK)
  if (results.length === 0) {
    results = await fetchPineconeResults(queryText, topK, tribunal, namespace)
  }

  if (results.length > 0) {
    setCache(searchCache, cacheKey, results, SEARCH_CACHE_TTL_MS)
  }
  return results.map(r => ({ ...r }))
}

// ─── 6. Reranking ─────────────────────────────────────────────────────────────

export async function rerankResults(
  query: string,
  results: EprocResult[]
): Promise<EprocResult[]> {
  const cohereEnabled = Boolean(process.env.COHERE_API_KEY)
  const rerankMode = cohereEnabled ? 'cohere' : 'local'
  const rerankKey = `${rerankMode}::${normalizeForCache(query)}::${results.map(r => r.id).join(',')}`
  const cached = getCache(rerankCache, rerankKey)
  if (cached) return cached.map(r => ({ ...r }))

  if (cohereEnabled) {
    const cohereReranked = await rerankWithCohere(query, results)
    if (cohereReranked.length > 0) {
      setCache(rerankCache, rerankKey, cohereReranked, RERANK_CACHE_TTL_MS)
      return cohereReranked.map(r => ({ ...r }))
    }
  }

  const queryTerms = extractRelevantTerms(query)
  const reranked = results.map(r => {
    const text = `${r.ementa} ${r.tribunal} ${r.relator}`.toLowerCase()
    let overlap = 0
    for (const term of queryTerms) {
      if (text.includes(term)) overlap += 1
    }
    const lexical = queryTerms.length > 0 ? overlap / queryTerms.length : 0
    const combined = Math.min(1, (r.score * 0.65) + (lexical * 0.35))
    return {
      ...r,
      rerankScore: Math.max(0.3, combined),
      badge: scoreToBadge(combined),
    }
  })

  const sorted = reranked.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
  setCache(rerankCache, rerankKey, sorted, RERANK_CACHE_TTL_MS)
  return sorted.map(r => ({ ...r }))
}

async function rerankWithCohere(query: string, results: EprocResult[]): Promise<EprocResult[]> {
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey || results.length === 0) return []

  const model = process.env.COHERE_RERANK_MODEL || 'rerank-v3.5'
  const endpoint = process.env.COHERE_RERANK_URL || 'https://api.cohere.com/v2/rerank'
  const documents = results.map(r => `${r.ementa}\nTribunal: ${r.tribunal}\nRelator: ${r.relator}`)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n: results.length,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.warn('[rag] cohere rerank failed', { status: res.status, body: body.slice(0, 300) })
      return []
    }

    const json = await res.json() as {
      results?: Array<{ index: number; relevance_score?: number }>
    }
    const scored = Array.isArray(json.results) ? json.results : []
    if (scored.length === 0) return []

    const mapped = scored
      .map(item => {
        const idx = Number(item.index)
        const source = results[idx]
        if (!source) return null
        const relevance = Number(item.relevance_score || 0)
        const combined = Math.min(1, Math.max(0, source.score * 0.35 + relevance * 0.65))
        return {
          ...source,
          rerankScore: combined,
          badge: scoreToBadge(combined),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))

    return mapped
  } catch (err) {
    console.warn('[rag] cohere rerank exception, using fallback', err)
    return []
  }
}

/** Stopwords comuns */
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'e', 'em', 'com', 'para', 'por',
  'uma', 'um', 'ao', 'na', 'no', 'que', 'se', 'processo',
])

/** Tribunais e siglas – cruciais para BM25 lexical em jurisprudência */
const TRIBUNAL_SIGLAS = /\b(STJ|STF|TST|TSE|STM|TRF[1-6]|TJ[A-Z]{2})\b/gi

function extractRelevantTerms(text: string): string[] {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const terms = new Set<string>()

  // 1. Números de artigo (Art. 138, Art. 5º, § 1º) – BM25 precisa de termos exatos
  const artNums = Array.from(lower.matchAll(/\bart\.?\s*(\d+)|§\s*(\d+)|inciso\s*(\d+)|(\d{1,4})\s*(?:º|ª)?/gi))
  for (const m of artNums) {
    const n = (m[1] || m[2] || m[3] || m[4] || '').trim()
    if (n && n.length <= 4) terms.add(n)
  }

  // 2. Siglas de tribunais – TJSC, STJ, etc.
  const siglas = lower.match(TRIBUNAL_SIGLAS) || []
  siglas.forEach(s => terms.add(s.toUpperCase()))

  // 3. Termos lexicais (≥4 chars, sem stopwords)
  const lexical = lower
    .split(/\W+/)
    .filter(t => t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
  lexical.forEach(t => terms.add(t))

  return Array.from(terms).slice(0, 35)
}

export function scoreToBadge(score: number): 'alta' | 'media' | 'baixa' {
  if (score >= 0.8) return 'alta'
  if (score >= 0.6) return 'media'
  return 'baixa'
}

// ─── 7. TOON Enrichment ───────────────────────────────────────────────────────

export function enrichWithToon(results: EprocResult[]): EprocResult[] {
  return results.map(r => ({
    ...r,
    toonData: createToonPayload(r),
  }))
}

export function dedupeEprocResults(results: EprocResult[]): EprocResult[] {
  const seenNumero = new Set<string>()
  const seenEmenta = new Set<string>()
  const deduped: EprocResult[] = []

  for (const result of results) {
    const numeroKey = result.numero.trim()
    const ementaKey = normalizeEmenta(result.ementa)
    if (seenNumero.has(numeroKey) || seenEmenta.has(ementaKey)) {
      continue
    }
    seenNumero.add(numeroKey)
    seenEmenta.add(ementaKey)
    deduped.push(result)
  }

  return deduped
}
