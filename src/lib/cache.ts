/**
 * Cache L2 via Upstash Redis REST API (HTTP puro, sem SDK).
 * Funciona em Vercel Edge e Node.js serverless.
 * Se as env vars não estiverem configuradas, todas as operações são no-op.
 * O cache L1 in-memory de rag.ts continua operando independentemente.
 */

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export const EMBEDDING_TTL_S = 86_400  // 24h — texto→vetor é determinístico
export const SEARCH_TTL_S    =  1_800  // 30min
export const RERANK_TTL_S    =    900  // 15min

export function isRedisEnabled(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN)
}

// FNV-1a hash compacto para chaves de cache
export function hashKey(prefix: string, input: string): string {
  let h = 2_166_136_261
  const len = Math.min(input.length, 2000)
  for (let i = 0; i < len; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16_777_619) >>> 0
  }
  return `iuris:${prefix}:${h.toString(36)}`
}

export async function redisGet<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      signal: AbortSignal.timeout(1_500), // nunca bloqueia o fluxo principal > 1.5s
    })
    if (!res.ok) return null
    const { result } = await res.json() as { result: string | null }
    return result ? (JSON.parse(result) as T) : null
  } catch {
    return null
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!isRedisEnabled()) return
  try {
    await fetch(`${REDIS_URL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]),
      signal: AbortSignal.timeout(1_500),
    })
  } catch {} // falha de escrita no cache é sempre aceitável
}
