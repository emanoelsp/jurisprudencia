/**
 * Pure functions extracted from rag.ts — no external dependencies.
 * Re-exported by rag.ts; directly importable in unit tests.
 */
import type { EprocResult } from '../../types/index.ts'

export const RRF_K = 60

export function normalizeEmenta(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function scoreToBadge(score: number): 'alta' | 'media' | 'baixa' {
  if (score >= 0.8) return 'alta'
  if (score >= 0.6) return 'media'
  return 'baixa'
}

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

export function fuseWithRRF(
  listA: EprocResult[],
  listB: EprocResult[],
  k = RRF_K
): EprocResult[] {
  const byKey = (r: EprocResult) =>
    `${r.numero.trim()}::${normalizeEmenta(r.ementa).slice(0, 100)}`
  const scores = new Map<string, { score: number; result: EprocResult }>()

  for (const list of [listA, listB]) {
    list.forEach((r, rank) => {
      const key = byKey(r)
      const rrf = 1 / (k + rank + 1)
      const existing = scores.get(key)
      if (existing) {
        existing.score += rrf
      } else {
        scores.set(key, { score: rrf, result: { ...r, score: rrf } })
      }
    })
  }

  const maxRrf = 2 / (k + 1)
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result }) => {
      const norm = Math.min(1, result.score / maxRrf)
      return { ...result, score: norm, badge: scoreToBadge(norm) }
    })
}

export function dedupeEprocResults(results: EprocResult[]): EprocResult[] {
  const seenNumero = new Set<string>()
  const seenEmenta = new Set<string>()
  const deduped: EprocResult[] = []
  for (const result of results) {
    const numeroKey = result.numero.trim()
    const ementaKey = normalizeEmenta(result.ementa)
    if (seenNumero.has(numeroKey) || seenEmenta.has(ementaKey)) continue
    seenNumero.add(numeroKey)
    seenEmenta.add(ementaKey)
    deduped.push(result)
  }
  return deduped
}
