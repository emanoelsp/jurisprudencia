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

// ─── 5. Busca jurisprudência (DataJud API + Pinecone opcional) ─────────────────
// Sem mock: usa apenas DataJud (API Pública CNJ) e/ou Pinecone (se configurado).

export async function searchEproc(
  queryText: string,
  topK = 8,
  options?: { tribunal?: string; namespace?: string }
): Promise<EprocResult[]> {
  const tribunal = options?.tribunal?.trim().toUpperCase() || ''
  const namespace = options?.namespace?.trim() || ''
  const cacheKey = `${normalizeForCache(queryText)}::${topK}::${tribunal || 'ALL'}::${namespace || 'default'}`
  const cached = getCache(searchCache, cacheKey)
  if (cached) return cached.map(r => ({ ...r }))

  let results: EprocResult[] = []

  // 1. DataJud API (fonte principal quando tribunal definido)
  const apiKey = process.env.DATAJUD_API_KEY
  if (apiKey && tribunal && tribunal !== 'TODOS') {
    try {
      const datajudDocs = await fetchDataJudByQuery({
        queryText,
        tribunalSigla: tribunal,
        apiKey,
        size: topK,
      })
      if (datajudDocs.length > 0) {
        results = datajudDocs.map((d, i) => ({
          id: d.id,
          numero: d.numero,
          ementa: d.ementa,
          tribunal: d.tribunal,
          relator: d.relator,
          dataJulgamento: d.dataJulgamento,
          score: 0.85 - i * 0.04,
          badge: scoreToBadge(0.85 - i * 0.04),
          fonte: 'datajud_cnj',
        }))
      }
    } catch (err) {
      console.warn('[rag] datajud query failed', err)
    }
  }

  // 2. Pinecone (vetorial, se configurado e DataJud vazio)
  if (results.length === 0 && process.env.PINECONE_HOST && process.env.PINECONE_API_KEY) {
    try {
      const vector = await generateEmbedding(queryText)
      const juriFilter = tribunal && tribunal !== 'TODOS' ? { tribunal: { $eq: tribunal } } : undefined
      const globalNamespace = process.env.PINECONE_NAMESPACE?.trim() || ''
      const legislacaoNamespace = process.env.PINECONE_LEGISLACAO_NAMESPACE?.trim() || 'legislacao'
      const allMatches: Array<{ m: any; ns: string }> = []

      for (const ns of [namespace || '', globalNamespace].filter(Boolean)) {
        const data = await queryPinecone(vector, topK, juriFilter, ns || undefined)
        const matches = Array.isArray(data?.matches) ? data.matches : []
        for (const m of matches) allMatches.push({ m, ns })
      }
      const legisData = await queryPinecone(vector, Math.min(topK, 4), undefined, legislacaoNamespace)
      const legisMatches = Array.isArray(legisData?.matches) ? legisData.matches : []
      for (const m of legisMatches) allMatches.push({ m, ns: legislacaoNamespace })

      if (allMatches.length > 0) {
        const seen = new Set<string>()
        const mapped = allMatches
          .sort((a, b) => (Number(b.m.score) || 0) - (Number(a.m.score) || 0))
          .slice(0, topK)
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
        results = mapped
      }
    } catch (err) {
      console.warn('[rag] pinecone query failed', err)
    }
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

function extractRelevantTerms(text: string): string[] {
  const stop = new Set([
    'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'e', 'em', 'com', 'para', 'por',
    'uma', 'um', 'ao', 'na', 'no', 'que', 'se', 'art', 'artigo', 'processo',
  ])
  const terms = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\W+/)
    .filter(t => t.length >= 4 && !stop.has(t))
  return Array.from(new Set(terms)).slice(0, 30)
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
