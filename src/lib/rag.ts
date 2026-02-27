// src/lib/rag.ts
// RAG Pipeline: PDF → Chunks → Embeddings → Vector Search → Reranking → TOON → LLM
import type { EprocResult } from '@/types'
import { createToonPayload } from './toon'
import { aiClient, aiModels } from './ai'
import { parseExtractedMetadataJson } from './guards'
import { queryPinecone } from './pinecone'

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

// ─── 5. Mock eproc Vector Search ─────────────────────────────────────────────
// In production: replace with Pinecone/Weaviate/pgvector query

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

  // Optional production path: Pinecone vector search
  if (process.env.PINECONE_HOST && process.env.PINECONE_API_KEY) {
    try {
      const vector = await generateEmbedding(queryText)
      const data = await queryPinecone(
        vector,
        topK,
        tribunal ? { tribunal: { $eq: tribunal } } : undefined,
        namespace || undefined
      )
      const matches = Array.isArray(data?.matches) ? data.matches : []
      const fromPinecone: EprocResult[] = matches.map((m: any, i: number) => ({
        id: String(m.id || `pc-${i}`),
        numero: String(m.metadata?.numero || m.metadata?.processo || ''),
        ementa: String(m.metadata?.ementa || m.metadata?.texto || ''),
        tribunal: String(m.metadata?.tribunal || ''),
        relator: String(m.metadata?.relator || ''),
        dataJulgamento: String(m.metadata?.dataJulgamento || ''),
        score: Number(m.score || 0),
        badge: scoreToBadge(Number(m.score || 0)),
        fonte: 'datajud_cnj',
      }))

      if (fromPinecone.length > 0) {
        setCache(searchCache, cacheKey, fromPinecone, SEARCH_CACHE_TTL_MS)
        return fromPinecone.map(r => ({ ...r }))
      }
    } catch (err) {
      console.warn('[rag] pinecone query failed, using fallback', err)
    }
  }

  // Simulated eproc results with realistic Brazilian legal data
  // Production: query your vector store with the embedding of queryText
  const mockResults: EprocResult[] = [
    {
      id: 'ep001',
      numero: '1023456-78.2022.8.26.0100',
      ementa: 'RESPONSABILIDADE CIVIL. Dano moral. Negativação indevida do nome. Presunção de dano. Desnecessidade de prova do prejuízo. Quantum indenizatório. Razoabilidade. Manutenção. Recurso desprovido.',
      tribunal: 'TJSP',
      relator: 'Des. Carlos Alberto Garbi',
      dataJulgamento: '2023-03-15',
      score: 0.91,
      badge: 'alta',
      fonte: 'datajud_cnj',
    },
    {
      id: 'ep002',
      numero: '0009876-54.2021.4.03.6100',
      ementa: 'TRIBUTÁRIO. Imposto de Renda. Dedução de despesas médicas. Comprovação. Documentos hábeis. Glosa fiscal. Ilegalidade. Apelação provida.',
      tribunal: 'TRF3',
      relator: 'Des. Fed. Márcio Moraes',
      dataJulgamento: '2023-07-20',
      score: 0.85,
      badge: 'alta',
      fonte: 'datajud_cnj',
    },
    {
      id: 'ep003',
      numero: '2034567-89.2020.8.19.0001',
      ementa: 'DIREITO DO CONSUMIDOR. Contrato de prestação de serviços. Cláusula abusiva. Revisão contratual. CDC. Aplicabilidade. Multa moratória. Redução. Recurso parcialmente provido.',
      tribunal: 'TJRJ',
      relator: 'Des. Renata Cotta',
      dataJulgamento: '2022-11-08',
      score: 0.82,
      badge: 'alta',
      fonte: 'datajud_cnj',
    },
    {
      id: 'ep004',
      numero: '3045678-90.2019.3.00.0000',
      ementa: 'PROCESSO CIVIL. Tutela antecipada. Urgência. Requisitos. Fumus boni iuris. Periculum in mora. Presentes. Deferimento. Decisão mantida. Agravo desprovido.',
      tribunal: 'STJ',
      relator: 'Min. Nancy Andrighi',
      dataJulgamento: '2023-09-12',
      score: 0.78,
      badge: 'media',
      fonte: 'datajud_cnj',
    },
    {
      id: 'ep005',
      numero: '4056789-01.2018.8.26.0506',
      ementa: 'ADMINISTRATIVO. Servidor público. Licença-prêmio. Conversão em pecúnia. Possibilidade. Aposentadoria. Direito adquirido. Precedentes. Recurso provido.',
      tribunal: 'TJSP',
      relator: 'Des. Oswaldo Luís Palu',
      dataJulgamento: '2023-01-30',
      score: 0.74,
      badge: 'media',
      fonte: 'datajud_cnj',
    },
    {
      id: 'ep006',
      numero: '5067890-12.2022.3.00.0000',
      ementa: 'CIVIL. Seguro. Acidente de trânsito. Indenização. DPVAT. Invalidez permanente. Cálculo. Tabela SUSEP. Interpretação. Recurso especial provido.',
      tribunal: 'STJ',
      relator: 'Min. Paulo de Tarso Sanseverino',
      dataJulgamento: '2022-08-25',
      score: 0.71,
      badge: 'media',
      fonte: 'datajud_cnj',
    },
  ]

  const filtered = tribunal
    ? mockResults.filter(result => result.tribunal.toUpperCase() === tribunal)
    : mockResults
  const output = filtered.slice(0, topK)
  setCache(searchCache, cacheKey, output, SEARCH_CACHE_TTL_MS)
  return output.map(r => ({ ...r }))
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
