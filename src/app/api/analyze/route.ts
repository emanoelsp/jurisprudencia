// src/app/api/analyze/route.ts
// Full RAG Pipeline: PDF Text → Chunks → Vector Search → Reranking → TOON → LLM Streaming
import { NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  searchEproc,
  rerankResults,
  enrichWithToon,
  dedupeEprocResults,
  generateEmbedding,
} from '@/lib/rag'
import { queryPinecone } from '@/lib/pinecone'
import {
  serializeToonForPrompt,
  validateToonIntegrity,
} from '@/lib/toon'
import { aiClient, aiModels } from '@/lib/ai'
import { isLegalScopeText, parseJustificationJson } from '@/lib/guards'
import { namespaceForUser } from '@/lib/tenant'
import { requireServerAuth } from '@/lib/server-auth'
import { normalizePlan, planForUserPlan } from '@/lib/plans'
import { fetchCfPlanalto, getArtigoResumoParaIA } from '@/lib/cf-planalto'
import { ARTIGOS_CONSTITUCIONAIS } from '@/lib/artigos-constitucionais'
import { getCodigoPenalResumoParaIA } from '@/lib/codigo-penal'
import { BASES_PUBLICAS_SYSTEM, BASES_PUBLICAS_FEW_SHOT, BASES_PUBLICAS_USER_PREFIX } from '@/lib/prompts/bases-publicas'
import { parseToonBasesPublicas } from '@/lib/toon-bases-publicas'
import { parseToonCf } from '@/lib/toon-cf'
import { extractCausaPetendi } from '@/lib/tools/extract-causa-petendi'
import type { AnalysisChunk } from '@/types'

function parseBasesPublicasResponse(raw: string): Array<{ id: string; tipo: string; fonte: string; ementa: string; aplicabilidade?: string }> {
  const toonResults = parseToonBasesPublicas(raw)
  if (toonResults.length > 0) return toonResults
  try {
    let str = (raw || '').trim()
    const codeMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeMatch) str = codeMatch[1].trim()
    const json = JSON.parse(str)
    const arr = Array.isArray(json.resultados) ? json.resultados
      : Array.isArray(json.results) ? json.results
      : Array.isArray(json.precedentes) ? json.precedentes
      : []
    return arr.slice(0, 6).map((r: any, i: number) => ({
      id: String(r.id || `bp-${i}`),
      tipo: String(r.tipo || 'jurisprudencia'),
      fonte: String(r.fonte || r.fonteNorma || r.nome || r.tipo || 'Norma/Precedente'),
      ementa: String(r.ementa || r.resumo || r.texto || r.descricao || ''),
      aplicabilidade: r.aplicabilidade,
    })).filter((r: any) => r.ementa && r.ementa.length > 10)
  } catch (e) {
    console.warn('[analyze] parseBasesPublicasResponse JSON fallback failed', e)
    return []
  }
}

function normalizeArtRef(s: string): string {
  return (s || '').toLowerCase().replace(/[ºª]/g, '').replace(/\s+/g, ' ').trim()
}

function parseCfArtigosResponse(raw: string, arts: { id: string; titulo: string; texto: string }[]): Array<{ id: string; titulo: string; texto: string; aplicabilidade?: string }> {
  const toonResults = parseToonCf(raw, arts)
  if (toonResults.length > 0) return toonResults
  try {
    let str = (raw || '').trim()
    const codeMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeMatch) str = codeMatch[1].trim()
    const json = JSON.parse(str)
    const arr = Array.isArray(json.artigos) ? json.artigos
      : Array.isArray(json.artigos_aplicaveis) ? json.artigos_aplicaveis
      : Array.isArray(json.resultados) ? json.resultados
      : []
    return arr.slice(0, 5).map((a: any) => {
      const titulo = String(a.titulo || a.id || '')
      const numMatch = titulo.match(/art\.?\s*(\d+)/i) || (a.id || '').match(/(\d+)/)
      const num = numMatch?.[1] || ''
      const id = String(a.id || '').replace(/[^a-z0-9-]/gi, '-').toLowerCase() || `art-${num}`
      const titNorm = normalizeArtRef(titulo)
      const orig = arts.find(x => {
        if (x.id === id || x.id.includes(id)) return true
        const xNorm = normalizeArtRef(x.titulo)
        if (xNorm.includes(titNorm) || titNorm.includes(xNorm)) return true
        if (num && x.titulo.includes(num)) return true
        return false
      })
      return {
        id: orig?.id || id,
        titulo: orig?.titulo || titulo,
        texto: orig?.texto || '',
        aplicabilidade: a.aplicabilidade,
      }
    }).filter((a: any) => a.titulo && a.titulo.length > 3)
  } catch (e) {
    console.warn('[analyze] parseCfArtigosResponse JSON fallback failed', e)
    return []
  }
}

export const runtime    = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_TOP_RESULTS = 6
const MAX_TOP_RESULTS = 8
const MAX_STREAM_RETRIES = 3
const RETRY_BASE_MS = 1200
const DEFAULT_MIN_CONFIDENCE = 0.65
const EXPANDED_SCOPE_TOP_RESULTS = 2
const MIN_RETRIEVAL_CONFIDENCE = 0.62
const MIN_EVIDENCE_COVERAGE = 0.45

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Extrai referência de artigo (ex: "Art. 138" -> "138", "Art. 5º" -> "5") */
function extractArticleRef(tituloOuFonte: string): string[] {
  const s = String(tituloOuFonte || '').replace(/[ºª]/g, '')
  const nums = Array.from(s.matchAll(/\bArt\.?\s*(\d+)|art\.?\s*(\d+)|§\s*(\d+)|inciso\s*(\d+)/gi))
    .flatMap(m => [m[1], m[2], m[3], m[4]].filter(Boolean))
  if (nums.length > 0) return nums
  const single = s.match(/\b(\d{1,4})\b/)
  return single ? [single[1]] : []
}

/** Valida artigos Gemini com resultados RAG (Pinecone legislação). Retorna apenas os validados. */
async function validateLegislacaoComRag(
  texto: string,
  cfArticles: Array<{ id: string; titulo: string; texto: string; aplicabilidade?: string }>,
  codigoPenal: Array<{ id: string; tipo: string; fonte: string; ementa: string; aplicabilidade?: string }>
): Promise<{ cf: typeof cfArticles; cp: typeof codigoPenal }> {
  const legislacaoNs = process.env.PINECONE_LEGISLACAO_NAMESPACE?.trim() || 'legislacao'
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
    return { cf: cfArticles, cp: codigoPenal }
  }
  try {
    const vector = await generateEmbedding(texto.slice(0, 4000))
    const [cfData, cpData] = await Promise.all([
      queryPinecone(vector, 10, { fonte: { $eq: 'cf_88' } }, legislacaoNs),
      queryPinecone(vector, 10, { fonte: { $eq: 'codigo_penal' } }, legislacaoNs),
    ])
    const ragCfTitulos = new Set(
      (cfData?.matches ?? []).map((m: any) => String(m.metadata?.titulo || m.metadata?.numero || '')).filter(Boolean)
    )
    const ragCpTitulos = new Set(
      (cpData?.matches ?? []).map((m: any) => String(m.metadata?.titulo || m.metadata?.numero || '')).filter(Boolean)
    )
    const cfValidados =
      ragCfTitulos.size === 0
        ? cfArticles
        : cfArticles.filter(a => {
            const refs = extractArticleRef(a.titulo)
            if (refs.length === 0) return true
            for (const t of Array.from(ragCfTitulos)) {
              if (refs.some(r => t.includes(r) || t.includes(`Art. ${r}`) || t.includes(`Art.${r}`))) return true
            }
            return false
          })
    const cpValidados =
      ragCpTitulos.size === 0
        ? codigoPenal
        : codigoPenal.filter(a => {
            const refs = extractArticleRef(a.fonte || a.ementa)
            if (refs.length === 0) return true
            for (const t of Array.from(ragCpTitulos)) {
              if (refs.some(r => t.includes(r) || t.includes(`Art. ${r}`) || t.includes(`Art.${r}`))) return true
            }
            return false
          })
    if (cfValidados.length < cfArticles.length || cpValidados.length < codigoPenal.length) {
      console.log('[analyze] RAG validation', {
        cfBefore: cfArticles.length,
        cfAfter: cfValidados.length,
        cpBefore: codigoPenal.length,
        cpAfter: cpValidados.length,
      })
    }
    return { cf: cfValidados, cp: cpValidados }
  } catch (err) {
    console.warn('[analyze] RAG validation failed, returning Gemini-only', err)
    return { cf: cfArticles, cp: codigoPenal }
  }
}

/** Chama Gemini com retry em 429 (quota). Aguarda 4s e tenta 1x. */
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  on429?: () => void
): Promise<{ ok: true; data: T } | { ok: false; quotaExceeded: boolean }> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err: any) {
    const is429 = err?.status === 429 || err?.statusCode === 429
    if (is429) on429?.()
    if (is429) {
      await sleep(4000)
      try {
        const data = await fn()
        return { ok: true, data }
      } catch {
        return { ok: false, quotaExceeded: true }
      }
    }
    throw err
  }
}

function resolveTopResults(input: unknown): number {
  const raw = Number(input ?? process.env.ANALYZE_TOP_RESULTS ?? DEFAULT_TOP_RESULTS)
  if (!Number.isFinite(raw)) return DEFAULT_TOP_RESULTS
  return Math.max(1, Math.min(MAX_TOP_RESULTS, Math.floor(raw)))
}

function resolveMinConfidence(input: unknown): number {
  const raw = Number(input ?? process.env.ANALYZE_MIN_CONFIDENCE ?? DEFAULT_MIN_CONFIDENCE)
  if (!Number.isFinite(raw)) return DEFAULT_MIN_CONFIDENCE
  return Math.max(0, Math.min(1, raw))
}

function effectiveScore(result: { rerankScore?: number; score: number }): number {
  return result.rerankScore ?? result.score
}

function buildFallbackJustification(params: {
  numero: string
  tribunal: string
  relator: string
  dataJulgamento: string
  ementa: string
}) {
  const resumo = params.ementa.slice(0, 260)
  return `Justificativa da análise: identificou-se precedente no ${params.tribunal} (processo ${params.numero}), relatoria de ${params.relator || 'não informado'}, julgado em ${params.dataJulgamento || 'data não informada'}. A ementa indica aderência temática ao caso: ${resumo}. Recomenda-se validação final do enquadramento fático pelo advogado antes da utilização na peça.`
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
  return Array.from(new Set(terms)).slice(0, 40)
}

function calculateEvidenceCoverage(texto: string, ementas: string[]): number {
  const terms = extractRelevantTerms(texto)
  if (terms.length === 0) return 0
  const corpus = ementas.join(' ').toLowerCase()
  let matched = 0
  for (const term of terms) {
    if (corpus.includes(term)) matched += 1
  }
  return matched / terms.length
}

function calculateRetrievalConfidence(results: Array<{ rerankScore?: number; score: number }>): number {
  if (results.length === 0) return 0
  const scores = results.map(r => effectiveScore(r))
  const avg = scores.reduce((acc, s) => acc + s, 0) / scores.length
  return Math.max(0, Math.min(1, avg))
}

function calculateGenerationRisk(retrievalConfidence: number, evidenceCoverage: number): number {
  const stability = (retrievalConfidence * 0.6) + (evidenceCoverage * 0.4)
  return Math.max(0, Math.min(1, 1 - stability))
}

function buildAbstainMessage(metrics: {
  retrievalConfidence: number
  evidenceCoverage: number
}) {
  const retrievalPct = Math.round(metrics.retrievalConfidence * 100)
  const coveragePct = Math.round(metrics.evidenceCoverage * 100)
  return `Não há base probatória suficiente para parecer conclusivo. Confiança de recuperação: ${retrievalPct}%. Cobertura de evidências: ${coveragePct}%. Recomendação: ampliar tribunal/período, anexar mais peças e refazer a análise.`
}

async function createCompletionWithRetry(params: {
  systemPrompt: string
  userPrompt: string
  reqId: string
  resultId: string
}) {
  let attempt = 0
  let lastErr: unknown

  while (attempt < MAX_STREAM_RETRIES) {
    attempt += 1
    try {
      if (attempt > 1) {
        console.log('[analyze] retrying completion', {
          reqId: params.reqId,
          resultId: params.resultId,
          attempt,
        })
      }
      const response = await aiClient.chat.completions.create({
        model: aiModels.chat,
        temperature: 0.1,
        top_p: 0.6,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      })
      return response.choices?.[0]?.message?.content || ''
    } catch (err: any) {
      lastErr = err
      const status = err?.status
      const retryable = status === 429 || (typeof status === 'number' && status >= 500)
      if (!retryable || attempt >= MAX_STREAM_RETRIES) {
        throw err
      }

      const delay = RETRY_BASE_MS * (2 ** (attempt - 1)) + Math.floor(Math.random() * 250)
      console.warn('[analyze] completion retry scheduled', {
        reqId: params.reqId,
        resultId: params.resultId,
        attempt,
        status,
        delayMs: delay,
      })
      await sleep(delay)
    }
  }

  throw lastErr
}

function sseChunk(data: AnalysisChunk): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  let authUser: { uid: string; email?: string }
  let payload: any
  try {
    authUser = await requireServerAuth(req)
    payload = await req.json()
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return new Response('Unauthorized', { status: 401 })
    }
    return new Response(err?.message || 'Invalid request', { status: 400 })
  }

  const { processoId, texto, topResults, minConfidence, tribunal, expandScope } = payload
  const topResultsLimit = resolveTopResults(topResults)
  const minConfidenceScore = resolveMinConfidence(minConfidence)
  const tribunalRaw = typeof tribunal === 'string' ? tribunal.trim().toUpperCase() : ''
  const tribunalFilter = tribunalRaw === 'TODOS' ? '' : tribunalRaw
  const shouldExpandScope = Boolean(expandScope)
  const db = adminDb()
  const userSnap = await db.collection('users').doc(authUser.uid).get()
  const userData = userSnap.data() as any
  const plan = planForUserPlan(normalizePlan(userData?.plano))
  if (shouldExpandScope && !plan.limits.allowExpandTribunais) {
    return new Response('Seu plano atual não inclui "Ampliar tribunais". Faça upgrade para habilitar.', { status: 402 })
  }
  const clientNamespace = namespaceForUser(authUser.uid)
  const effectiveTopResultsLimit = shouldExpandScope
    ? Math.min(topResultsLimit, EXPANDED_SCOPE_TOP_RESULTS)
    : topResultsLimit
  const reqId = `${processoId || 'no-proc'}-${Date.now()}`
  const startedAt = Date.now()
  console.log('[analyze] start', {
    reqId,
    processoId,
    textoChars: texto?.length || 0,
    topResultsLimit: effectiveTopResultsLimit,
    minConfidenceScore,
    tribunalFilter: tribunalFilter || 'ALL',
    shouldExpandScope,
    clientNamespace: clientNamespace || 'default',
  })

  if (!texto) {
    return new Response('Missing texto', { status: 400 })
  }

  if (!isLegalScopeText(texto)) {
    console.warn('[analyze] out-of-scope request blocked', { reqId })
    return new Response('Texto fora do escopo jurídico-processual.', { status: 422 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: AnalysisChunk) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(chunk)))
      }

      try {
        const usedPareceres = await loadUsedPareceres(authUser.uid, texto)
        const usageMap = new Map(
          usedPareceres.map(item => [
            item.numero,
            item.usageCount || item.processoIds?.length || 1,
          ])
        )
        send({ type: 'metadata', usedPareceres })

        let geminiQuotaExceeded = false
        const mark429 = () => { geminiQuotaExceeded = true }

        const invokeLlmForExtract = async (system: string, user: string) => {
          const result = await callGeminiWithRetry(
            () => aiClient.chat.completions.create({
              model: aiModels.chat,
              temperature: 0.1,
              top_p: 0.6,
              max_tokens: 600,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
            }),
            mark429
          )
          if (!result.ok) throw new Error('Gemini quota exceeded')
          return result.data.choices?.[0]?.message?.content || ''
        }

        // ─── Step 0: Sub-agente extract_causa_petendi (query RAG otimizada) ─
        const extractCausaPetendiPromise = extractCausaPetendi(texto, invokeLlmForExtract)

        // ─── Step 0a: Bases Públicas (IA) – TOON como semantic_agent, sem response_format ─
        const basesPublicasPromise = (async () => {
          try {
            const cpResumo = getCodigoPenalResumoParaIA(4000)
            const systemContent = BASES_PUBLICAS_SYSTEM + '\n\n' + BASES_PUBLICAS_FEW_SHOT +
              '\n\nOBRIGATÓRIO: Retorne ao menos 1 bloco ⟨BP⟩...⟨/BP⟩. Se o processo for jurídico, cite artigos do CP, CF, CDC, súmulas ou jurisprudência relevante.'
            const userContent = BASES_PUBLICAS_USER_PREFIX + texto.slice(0, 2800) +
              (cpResumo ? `\n\nREFERÊNCIA - Código Penal (artigos principais):\n${cpResumo}\n\nUse os artigos acima quando aplicáveis.` : '')

            const result = await callGeminiWithRetry(
              () => aiClient.chat.completions.create({
                model: aiModels.chat,
                temperature: 0.1,
                top_p: 0.6,
                max_tokens: 1200,
                messages: [
                  { role: 'system', content: systemContent },
                  { role: 'user', content: userContent },
                ],
              }),
              mark429
            )
            if (!result.ok) return []
            const raw = result.data.choices?.[0]?.message?.content || ''
            const parsed = parseBasesPublicasResponse(raw)
            if (parsed.length > 0) console.log('[analyze] bases-publicas OK', { count: parsed.length })
            else if (raw && raw.length > 20) console.warn('[analyze] bases-publicas parse empty', { rawLen: raw.length })
            return parsed
          } catch (err) {
            console.warn('[analyze] bases-publicas step failed', err)
            return []
          }
        })()

        // ─── Step 0b: Código Penal – análise dedicada (IA) – TOON ⟨BP⟩...⟨/BP⟩ ─
        const codigoPenalPromise = (async () => {
          try {
            const cpResumo = getCodigoPenalResumoParaIA(6000)
            if (!cpResumo) return []
            const result = await callGeminiWithRetry(
              () => aiClient.chat.completions.create({
                model: aiModels.chat,
                temperature: 0.1,
                top_p: 0.6,
                max_tokens: 800,
                messages: [
                  {
                    role: 'system',
                    content: `Você é um especialista em direito penal. Dado um processo judicial e uma lista de artigos do Código Penal (CP), identifique quais artigos se aplicam ao caso.

FORMATO DE RESPOSTA OBRIGATÓRIO - TOON:
Para cada artigo aplicável: ⟨BP⟩⟨F:Código Penal - Art. X⟩⟨T:lei⟩⟨E:texto ou resumo do artigo⟩⟨A:aplicabilidade ao caso⟩⟨/BP⟩
Exemplo: ⟨BP⟩⟨F:Código Penal - Art. 138⟩⟨T:lei⟩⟨E:Calúnia - imputar falsamente fato definido como crime⟩⟨A:Enquadramento em crime contra honra se houver imputação falsa de crime⟩⟨/BP⟩

OBRIGATÓRIO: Retorne ao menos 1 bloco ⟨BP⟩...⟨/BP⟩ quando houver matéria penal. Máximo 5 blocos. Liste apenas artigos efetivamente aplicáveis.`,
                  },
                  {
                    role: 'user',
                    content: `PROCESSO:\n${texto.slice(0, 2800)}\n\nARTIGOS DO CÓDIGO PENAL:\n${cpResumo}\n\nIdentifique os artigos do CP aplicáveis e retorne no formato TOON ⟨BP⟩...⟨/BP⟩.`,
                  },
                ],
              }),
              mark429
            )
            if (!result.ok) return []
            const raw = result.data.choices?.[0]?.message?.content || ''
            const parsed = parseBasesPublicasResponse(raw)
            const cpOnly = parsed.filter(p => (p.fonte || '').toLowerCase().includes('código penal') || (p.fonte || '').toLowerCase().includes('codigo penal'))
            if (cpOnly.length > 0) console.log('[analyze] codigo-penal OK', { count: cpOnly.length })
            return cpOnly.length > 0 ? cpOnly : parsed
          } catch (err) {
            console.warn('[analyze] codigo-penal step failed', err)
            return []
          }
        })()

        // ─── Step 0c: CF/88 – TOON como semantic_agent, sem response_format ─
        const cfPromise = (async () => {
          try {
            let arts = await fetchCfPlanalto()
            if (arts.length < 10) {
              const extra = ARTIGOS_CONSTITUCIONAIS.map(a => ({ id: a.id, titulo: a.titulo, texto: a.texto }))
              const seen = new Set(arts.map(a => a.id))
              for (const a of extra) {
                if (!seen.has(a.id)) { arts = [...arts, a]; seen.add(a.id) }
              }
            }
            if (arts.length === 0) return []
            const resumo = getArtigoResumoParaIA(arts, 8000)
            const result = await callGeminiWithRetry(
              () => aiClient.chat.completions.create({
                model: aiModels.chat,
                temperature: 0.1,
                top_p: 0.6,
                max_tokens: 600,
                messages: [
                  {
                    role: 'system',
                    content: `Você é um especialista em direito constitucional. Dado um processo judicial e uma lista de artigos da CF/88, identifique quais artigos se aplicam ao caso.

FORMATO DE RESPOSTA OBRIGATÓRIO - TOON:
Para cada artigo: ⟨CF⟩⟨ID:art-X⟩⟨TIT:Art. X⟩⟨APLIC:explicação breve⟩⟨/CF⟩
Exemplo: ⟨CF⟩⟨ID:art-5⟩⟨TIT:Art. 5º, XXXV⟩⟨APLIC:Inafastabilidade da jurisdição - acesso ao Judiciário⟩⟨/CF⟩

NUNCA escreva texto livre. Resposta = tokens TOON. Máximo 5 blocos ⟨CF⟩...⟨/CF⟩. Liste de 1 a 5 artigos relevantes.`,
                  },
                  {
                    role: 'user',
                    content: `PROCESSO:\n${texto.slice(0, 2500)}\n\nARTIGOS CF/88:\n${resumo}\n\nIdentifique os artigos aplicáveis e retorne no formato TOON.`,
                  },
                ],
              }),
              mark429
            )
            if (!result.ok) return []
            const raw = result.data.choices?.[0]?.message?.content || ''
            const parsed = parseCfArtigosResponse(raw, arts)
            if (parsed.length > 0) console.log('[analyze] cf-planalto OK', { count: parsed.length })
            return parsed
          } catch (err) {
            console.warn('[analyze] cf-planalto step failed', err)
            return []
          }
        })()

        // ─── Step 1: RAG Híbrido (Vector + BM25 + RRF) ─
        const causaPetendiResult = await extractCausaPetendiPromise
        const queryRag = causaPetendiResult?.queryRag || texto
        if (causaPetendiResult?.queryRag) {
          console.log('[analyze] extract_causa_petendi OK, using queryRag for search', {
            causaLen: causaPetendiResult.causaPetendi?.length || 0,
            queryLen: causaPetendiResult.queryRag?.length || 0,
          })
        }

        const tSearch = Date.now()
        const rawResults = await searchEproc(
          queryRag,
          8,
          shouldExpandScope
            ? { ...(clientNamespace ? { namespace: clientNamespace } : {}) }
            : ({
              ...(tribunalFilter ? { tribunal: tribunalFilter } : {}),
              ...(clientNamespace ? { namespace: clientNamespace } : {}),
            })
        )
        console.log('[analyze] step searchEproc', { reqId, ms: Date.now() - tSearch, count: rawResults.length })
        send({
          type: 'metadata',
          data: {
            rag_source: rawResults.some(r => r.fonte === 'base_interna') ? 'pinecone' : 'datajud_cnj',
          } as any,
        })

        // ─── Step 2: Reranking ───────────────────────────
        const tRerank = Date.now()
        const reranked = await rerankResults(queryRag, rawResults)
        const deduped = dedupeEprocResults(reranked)
        const withConfidence = deduped.filter(r => effectiveScore(r) >= minConfidenceScore)
        const topRanked = withConfidence
          .map(result => ({
            ...result,
            alreadyUsed: usageMap.has(result.numero),
            usageCount: usageMap.get(result.numero) || 0,
          }))
          .slice(0, effectiveTopResultsLimit)
        console.log('[analyze] step rerank', {
          reqId,
          ms: Date.now() - tRerank,
          dedupedCount: deduped.length,
          confidentCount: withConfidence.length,
          topCount: topRanked.length,
        })

        const retrievalConfidence = calculateRetrievalConfidence(topRanked)
        const evidenceCoverage = calculateEvidenceCoverage(
          texto,
          topRanked.map(r => r.ementa)
        )
        const generationRisk = calculateGenerationRisk(retrievalConfidence, evidenceCoverage)
        const confidence = {
          retrieval_confidence: Number(retrievalConfidence.toFixed(3)),
          evidence_coverage: Number(evidenceCoverage.toFixed(3)),
          generation_risk: Number(generationRisk.toFixed(3)),
        }
        send({ type: 'metadata', data: confidence })

        if (topRanked.length === 0) {
          console.warn('[analyze] early-stop no confident results', {
            reqId,
            minConfidenceScore,
            tribunalFilter: tribunalFilter || 'ALL',
            shouldExpandScope,
          })
          send({ type: 'results', results: [] })
          const [cfArticlesEarly, basesPublicasEarly, codigoPenalEarly] = await Promise.all([cfPromise, basesPublicasPromise, codigoPenalPromise])
          const { cf: cfValidadosEarly, cp: cpValidadosEarly } = await validateLegislacaoComRag(texto, cfArticlesEarly, codigoPenalEarly)
          if (cfValidadosEarly.length > 0 || basesPublicasEarly.length > 0 || cpValidadosEarly.length > 0) {
            send({ type: 'metadata', data: { cf_articles: cfValidadosEarly, bases_publicas: basesPublicasEarly, codigo_penal: cpValidadosEarly, gemini_quota_exceeded: geminiQuotaExceeded } as any })
          }
          send({
            type: 'error',
            error: shouldExpandScope
              ? `Nenhuma jurisprudência atingiu o nível mínimo de confiança (${Math.round(minConfidenceScore * 100)}%).`
              : `Nenhum resultado relevante em ${tribunalFilter || 'tribunal selecionado'}. Use "Ampliar para outros tribunais".`,
          })
          send({ type: 'complete', processoId })
          return
        }

        if (retrievalConfidence < MIN_RETRIEVAL_CONFIDENCE || evidenceCoverage < MIN_EVIDENCE_COVERAGE) {
          console.warn('[analyze] abstain low evidence', {
            reqId,
            retrievalConfidence,
            evidenceCoverage,
          })
          send({ type: 'results', results: topRanked })
          const [cfArticlesAbstain, basesPublicasAbstain, codigoPenalAbstain] = await Promise.all([cfPromise, basesPublicasPromise, codigoPenalPromise])
          const { cf: cfValidadosAbstain, cp: cpValidadosAbstain } = await validateLegislacaoComRag(texto, cfArticlesAbstain, codigoPenalAbstain)
          if (cfValidadosAbstain.length > 0 || basesPublicasAbstain.length > 0 || cpValidadosAbstain.length > 0) {
            send({ type: 'metadata', data: { cf_articles: cfValidadosAbstain, bases_publicas: basesPublicasAbstain, codigo_penal: cpValidadosAbstain, gemini_quota_exceeded: geminiQuotaExceeded } as any })
          }
          send({ type: 'error', error: buildAbstainMessage({ retrievalConfidence, evidenceCoverage }) })
          send({ type: 'complete', processoId })
          return
        }

        // ─── Step 3: TOON Enrichment ─────────────────────
        const tToon = Date.now()
        const toonResults = enrichWithToon(topRanked)
        console.log('[analyze] step toon', { reqId, ms: Date.now() - tToon })

        // Send results to client
        send({ type: 'results', results: toonResults })

        // ─── Step 3b: Enviar CF/88, Bases Públicas e Código Penal (validados por RAG) ───────
        const [cfArticles, basesPublicas, codigoPenal] = await Promise.all([cfPromise, basesPublicasPromise, codigoPenalPromise])
        const { cf: cfValidados, cp: cpValidados } = await validateLegislacaoComRag(texto, cfArticles, codigoPenal)
        if (cfValidados.length > 0 || basesPublicas.length > 0 || cpValidados.length > 0) {
          send({ type: 'metadata', data: { cf_articles: cfValidados, bases_publicas: basesPublicas, codigo_penal: cpValidados, gemini_quota_exceeded: geminiQuotaExceeded } as any })
        }

        // ─── Step 4: Per-result streaming justification ──
        const toonPayloads = toonResults.map(r => r.toonData!).filter(Boolean)
        const toonXml = serializeToonForPrompt(toonPayloads)
        let llmRateLimited = false

        for (const result of toonResults) {
          if (llmRateLimited) {
            const fallback = buildFallbackJustification({
              numero: result.toonData?.numeroProcesso || result.numero,
              tribunal: result.tribunal,
              relator: result.relator,
              dataJulgamento: result.dataJulgamento,
              ementa: result.ementa,
            })
            send({ type: 'justification', data: { id: result.id }, text: fallback })
            continue
          }
          try {
            const resultStart = Date.now()
            const systemPrompt = `Você é um especialista em direito brasileiro com profundo conhecimento em jurisprudência.

${toonXml}

REGRAS CRÍTICAS ANTI-ALUCINAÇÃO:
1. NUNCA invente ou modifique números de processo, nomes de relatores ou tribunais.
2. Use APENAS os valores EXATOS do bloco <IMMUTABLE_FACTS> correspondente.
3. Ao referenciar um processo, use o número verbatim: ${result.toonData?.numeroProcesso}
4. Saída obrigatoriamente em JSON VÁLIDO com este schema:
{
  "conclusao": "string",
  "fundamentoJuridico": "string",
  "aplicabilidade": "string",
  "citacoes": [
    {
      "numero": "string",
      "tribunal": "string",
      "relator": "string",
      "dataJulgamento": "string",
      "trecho": "string"
    }
  ]
}
5. Sempre incluir ao menos 1 citação no array "citacoes".`

          const userPrompt = `Analise a relevância da jurisprudência #${toonResults.indexOf(result) + 1} do ${result.tribunal} (processo ${result.toonData?.numeroProcesso}) para o seguinte caso e responda APENAS no JSON exigido:

CASO ANALISADO:
${texto.slice(0, 1500)}

Campos esperados:
- conclusao: síntese objetiva da relevância
- fundamentoJuridico: tese jurídica aplicável
- aplicabilidade: como usar na peça
- citacoes: referências com número, tribunal, relator, data e trecho literal.

Use o número do processo e o relator EXATAMENTE como fornecido no TOON.`

            const rawJson = await createCompletionWithRetry({
              systemPrompt,
              userPrompt,
              reqId,
              resultId: result.id,
            })

            const parsed = parseJustificationJson(rawJson)
            if (!parsed) {
              throw new Error('Saída inválida: JSON/schema de justificativa não conforme.')
            }
            const fullText = [
              `Justificativa da análise: ${parsed.conclusao}`,
              parsed.fundamentoJuridico,
              parsed.aplicabilidade,
              `Citações: ${parsed.citacoes.map((c: any) => `${c.tribunal} ${c.numero} (${c.relator}, ${c.dataJulgamento})`).join('; ')}`,
            ].join('\n\n')
            send({
              type: 'justification',
              data: { id: result.id },
              text: fullText,
            })
            console.log('[analyze] step justification', {
              reqId,
              resultId: result.id,
              ms: Date.now() - resultStart,
              chars: fullText.length,
            })

            // ─── TOON Integrity Validation ────────────────
            const { valid, violations } = validateToonIntegrity(fullText, toonPayloads)
            if (!valid) {
              console.warn('[TOON Violation]', violations)
              send({
                type: 'error',
                error: `Violação TOON detectada: ${violations.join('; ')}`,
              })
            }
          } catch (resultErr: any) {
            console.error('[analyze] result failed', { reqId, resultId: result.id, error: resultErr?.message || resultErr })
            if (resultErr?.status === 429) {
              llmRateLimited = true
              const fallback = buildFallbackJustification({
                numero: result.toonData?.numeroProcesso || result.numero,
                tribunal: result.tribunal,
                relator: result.relator,
                dataJulgamento: result.dataJulgamento,
                ementa: result.ementa,
              })
              send({ type: 'justification', data: { id: result.id }, text: fallback })
              send({
                type: 'error',
                error: 'Limite temporário da IA atingido. Continuando em modo econômico para não interromper a análise.',
              })
              continue
            }
            send({
              type: 'error',
              error: `Falha ao gerar justificativa do resultado ${result.id}: ${resultErr?.message || 'erro inesperado'}`,
            })
          }
        }

        send({ type: 'complete', processoId })
        console.log('[analyze] complete', { reqId, totalMs: Date.now() - startedAt })

      } catch (err: any) {
        if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
          send({ type: 'error', error: 'Sessão inválida. Faça login novamente.' })
          return
        }
        console.error('[analyze]', err)
        send({ type: 'error', error: err.message })
      } finally {
        console.log('[analyze] end', { reqId, totalMs: Date.now() - startedAt })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}

async function loadUsedPareceres(userId: string, texto: string) {
  const db = adminDb()
  const snap = await db
    .collection('jurisprudencias')
    .where('userId', '==', userId)
    .get()

  const queryTokens = new Set(
    texto
      .toLowerCase()
      .split(/\W+/)
      .filter(token => token.length >= 5)
      .slice(0, 60)
  )

  const scored = snap.docs
    .map(doc => doc.data() as any)
    .map(item => {
      const haystack = `${item.ementa || ''} ${item.justificativaIa || ''} ${item.titulo || ''}`.toLowerCase()
      let overlap = 0
      for (const token of Array.from(queryTokens)) {
        if (haystack.includes(token)) overlap += 1
      }
      const usageCount = item.processoIds?.length || (item.processoId ? 1 : 0)
      return { ...item, overlap, usageCount }
    })
    .filter(item => item.overlap > 0 || item.usageCount > 1)
    .sort((a, b) => (b.overlap * 3 + b.usageCount) - (a.overlap * 3 + a.usageCount))
    .slice(0, 6)

  return scored
}
