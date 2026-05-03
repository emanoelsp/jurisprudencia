/**
 * Langfuse REST client — observabilidade LLM sem SDK (HTTP direto).
 * Todas as chamadas são fire-and-forget: NUNCA bloqueiam a resposta ao usuário.
 * Se as env vars não estiverem configuradas, tudo vira no-op silencioso.
 */

const HOST = (process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com').replace(/\/$/, '')
const PUB  = process.env.LANGFUSE_PUBLIC_KEY
const SEC  = process.env.LANGFUSE_SECRET_KEY

const enabled = () => !!(PUB && SEC)
const auth    = () => `Basic ${Buffer.from(`${PUB}:${SEC}`).toString('base64')}`
const evtId   = () => `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function ingest(events: object[]) {
  if (!enabled()) return
  fetch(`${HOST}/api/public/ingestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth() },
    body: JSON.stringify({ batch: events }),
  }).catch(() => {}) // swallowed — tracing jamais pode afetar a resposta
}

// ── API pública ─────────────────────────────────────────────────────────────

export interface TraceParams {
  id: string
  name: string
  userId?: string
  metadata?: Record<string, unknown>
  tags?: string[]
}

export interface GenerationParams {
  traceId: string
  name: string
  model: string
  input?: Record<string, unknown>
}

/** Abre um span de geração LLM. Retorna `.end()` para fechar com output/latência. */
export function startGeneration(params: GenerationParams) {
  const genId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const t0 = Date.now()

  ingest([{
    id: evtId(),
    type: 'generation-create',
    timestamp: new Date().toISOString(),
    body: {
      id: genId,
      traceId: params.traceId,
      name: params.name,
      model: params.model,
      input: params.input,
      startTime: new Date().toISOString(),
    },
  }])

  return {
    end(result: { text: string; model?: string }) {
      const latencyMs = Date.now() - t0
      ingest([{
        id: evtId(),
        type: 'generation-update',
        timestamp: new Date().toISOString(),
        body: {
          id: genId,
          output: result.text.slice(0, 2000),
          endTime: new Date().toISOString(),
          model: result.model || params.model,
          usage: {
            unit: 'CHARACTERS',
            input: params.input ? JSON.stringify(params.input).length : 0,
            output: result.text.length,
          },
          metadata: { latencyMs },
        },
      }])
    },
  }
}

export function createTrace(params: TraceParams) {
  const ts = new Date().toISOString()

  ingest([{
    id: evtId(),
    type: 'trace-create',
    timestamp: ts,
    body: {
      id:       params.id,
      name:     params.name,
      userId:   params.userId,
      metadata: params.metadata,
      tags:     params.tags,
      timestamp: ts,
    },
  }])

  return {
    /** Registra um score numérico (0–1) associado ao trace. */
    score(name: string, value: number) {
      ingest([{
        id: evtId(),
        type: 'score-create',
        timestamp: new Date().toISOString(),
        body: { traceId: params.id, name, value, dataType: 'NUMERIC' },
      }])
    },
    /** Encerra o trace com output final (totalMs, contagens, etc.). */
    end(output: Record<string, unknown>) {
      ingest([{
        id: evtId(),
        type: 'trace-create',
        timestamp: new Date().toISOString(),
        body: { id: params.id, output },
      }])
    },
    /** Abre um span de geração LLM vinculado a este trace. */
    generation(genParams: Omit<GenerationParams, 'traceId'>) {
      return startGeneration({ ...genParams, traceId: params.id })
    },
  }
}
