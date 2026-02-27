// src/app/api/analyze/route.ts
// Full RAG Pipeline: PDF Text → Chunks → Vector Search → Reranking → TOON → LLM Streaming
import { NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  searchEproc,
  rerankResults,
  enrichWithToon,
  dedupeEprocResults,
} from '@/lib/rag'
import {
  serializeToonForPrompt,
  validateToonIntegrity,
} from '@/lib/toon'
import { aiClient, aiModels } from '@/lib/ai'
import { isLegalScopeText, parseJustificationJson } from '@/lib/guards'
import { namespaceForUser } from '@/lib/tenant'
import { requireServerAuth } from '@/lib/server-auth'
import { normalizePlan, planForUserPlan } from '@/lib/plans'
import type { AnalysisChunk } from '@/types'

export const runtime    = 'nodejs'
export const maxDuration = 60

const DEFAULT_TOP_RESULTS = 3
const MAX_TOP_RESULTS = 5
const MAX_STREAM_RETRIES = 3
const RETRY_BASE_MS = 1200
const DEFAULT_MIN_CONFIDENCE = 0.65
const EXPANDED_SCOPE_TOP_RESULTS = 2
const MIN_RETRIEVAL_CONFIDENCE = 0.62
const MIN_EVIDENCE_COVERAGE = 0.45

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
  const tribunalFilter = typeof tribunal === 'string' ? tribunal.trim().toUpperCase() : ''
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

        // ─── Step 1: Vector Search ───────────────────────
        const tSearch = Date.now()
        const rawResults = await searchEproc(
          texto,
          8,
          shouldExpandScope
            ? { ...(clientNamespace ? { namespace: clientNamespace } : {}) }
            : ({
              ...(tribunalFilter ? { tribunal: tribunalFilter } : {}),
              ...(clientNamespace ? { namespace: clientNamespace } : {}),
            })
        )
        console.log('[analyze] step searchEproc', { reqId, ms: Date.now() - tSearch, count: rawResults.length })

        // ─── Step 2: Reranking ───────────────────────────
        const tRerank = Date.now()
        const reranked = await rerankResults(texto, rawResults)
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
