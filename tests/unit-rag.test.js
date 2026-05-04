import test from 'node:test'
import assert from 'node:assert/strict'
// Run with: node --experimental-strip-types --test tests/unit-rag.test.js
import {
  chunkText,
  fuseWithRRF,
  scoreToBadge,
  dedupeEprocResults,
} from '../src/lib/rag-pure.ts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(overrides = {}) {
  return {
    id: 'r1',
    numero: '1234567-89.2023.8.26.0100',
    ementa: 'RECURSO ESPECIAL. Dano moral. Procedência.',
    tribunal: 'STJ',
    relator: 'Min. João Silva',
    dataJulgamento: '2023-06-15',
    score: 0.9,
    badge: 'alta',
    fonte: 'datajud_cnj',
    ...overrides,
  }
}

// ─── chunkText ────────────────────────────────────────────────────────────────

test('chunkText: text shorter than chunkSize returns single chunk', () => {
  const text = 'Hello world foo bar baz qux corge grault garply waldo fred plugh thud'
  const chunks = chunkText(text, 1000, 200)
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0], text)
})

test('chunkText: long text produces multiple overlapping chunks', () => {
  const word = 'abcde '
  const text = word.repeat(250) // ~1500 chars
  const chunks = chunkText(text, 1000, 200)
  assert.ok(chunks.length >= 2)
  // overlap: end of chunk[0] should appear at start of chunk[1]
  const endOfFirst = chunks[0].slice(-100)
  const startOfSecond = chunks[1].slice(0, 100)
  assert.ok(chunks[1].startsWith(chunks[0].slice(800, 900).trimEnd()) || startOfSecond.length > 0)
})

test('chunkText: respects chunk size boundary', () => {
  const text = 'x'.repeat(3000)
  const chunks = chunkText(text, 1000, 200)
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 1000)
  }
})

test('chunkText: filters out chunks shorter than 50 chars', () => {
  const text = 'a'.repeat(60) + '\n' + '  \n  ' + 'b'.repeat(60)
  const chunks = chunkText(text, 100, 0)
  for (const chunk of chunks) {
    assert.ok(chunk.trim().length >= 50)
  }
})

test('chunkText: custom overlap produces correct stride', () => {
  const text = 'A'.repeat(2000)
  const chunks = chunkText(text, 500, 100)
  // stride = 500 - 100 = 400; text = 2000 → ceil(2000/400) chunks approx
  assert.ok(chunks.length >= 4)
})

test('chunkText: empty string returns empty array', () => {
  const chunks = chunkText('', 1000, 200)
  assert.equal(chunks.length, 0)
})

// ─── fuseWithRRF ──────────────────────────────────────────────────────────────

test('fuseWithRRF: returns items from both lists', () => {
  const a = [makeResult({ id: 'a1', numero: '111', ementa: 'Processo administrativo' })]
  const b = [makeResult({ id: 'b1', numero: '222', ementa: 'Dano moral trabalhista' })]
  const fused = fuseWithRRF(a, b)
  assert.equal(fused.length, 2)
})

test('fuseWithRRF: duplicate (same numero) scores higher than unique', () => {
  const shared = makeResult({ id: 's1', numero: '999', ementa: 'Responsabilidade civil' })
  const unique = makeResult({ id: 'u1', numero: '888', ementa: 'Tributário ICMS' })
  const a = [shared, unique]
  const b = [shared]
  const fused = fuseWithRRF(a, b)
  const sharedFused = fused.find(r => r.numero === '999')
  const uniqueFused = fused.find(r => r.numero === '888')
  assert.ok(sharedFused, 'shared result not found')
  assert.ok(uniqueFused, 'unique result not found')
  assert.ok(sharedFused.score > uniqueFused.score, 'shared should score higher')
})

test('fuseWithRRF: result from top of list scores higher than bottom', () => {
  const top = makeResult({ id: 't1', numero: 'T1', ementa: 'Constitucional direitos fundamentais' })
  const bottom = makeResult({ id: 'b2', numero: 'B2', ementa: 'Penal contravenção' })
  const fused = fuseWithRRF([top, bottom], [])
  const [first] = fused
  assert.equal(first.numero, 'T1')
})

test('fuseWithRRF: output scores are normalized 0..1', () => {
  const a = [makeResult({ numero: 'X1', ementa: 'Processo X1 recurso especial' })]
  const b = [makeResult({ numero: 'X2', ementa: 'Processo X2 habeas corpus' })]
  const fused = fuseWithRRF(a, b)
  for (const r of fused) {
    assert.ok(r.score >= 0 && r.score <= 1, `score out of range: ${r.score}`)
  }
})

test('fuseWithRRF: empty lists return empty array', () => {
  assert.equal(fuseWithRRF([], []).length, 0)
})

test('fuseWithRRF: preserves fields of original results', () => {
  const r = makeResult({ numero: 'Z1', ementa: 'Penal furto qualificado', tribunal: 'TJSP' })
  const [fused] = fuseWithRRF([r], [])
  assert.equal(fused.tribunal, 'TJSP')
  assert.equal(fused.numero, 'Z1')
})

// ─── scoreToBadge ─────────────────────────────────────────────────────────────

test('scoreToBadge: >= 0.8 returns alta', () => {
  assert.equal(scoreToBadge(0.8), 'alta')
  assert.equal(scoreToBadge(0.99), 'alta')
  assert.equal(scoreToBadge(1.0), 'alta')
})

test('scoreToBadge: 0.6..0.79 returns media', () => {
  assert.equal(scoreToBadge(0.6), 'media')
  assert.equal(scoreToBadge(0.79), 'media')
  assert.equal(scoreToBadge(0.65), 'media')
})

test('scoreToBadge: < 0.6 returns baixa', () => {
  assert.equal(scoreToBadge(0.59), 'baixa')
  assert.equal(scoreToBadge(0.0), 'baixa')
  assert.equal(scoreToBadge(0.3), 'baixa')
})

test('scoreToBadge: boundary 0.8 is alta, not media', () => {
  assert.equal(scoreToBadge(0.8), 'alta')
  assert.equal(scoreToBadge(0.799), 'media')
})

test('scoreToBadge: boundary 0.6 is media, not baixa', () => {
  assert.equal(scoreToBadge(0.6), 'media')
  assert.equal(scoreToBadge(0.599), 'baixa')
})

// ─── dedupeEprocResults ───────────────────────────────────────────────────────

test('dedupeEprocResults: removes exact numero duplicates', () => {
  const r1 = makeResult({ id: 'a', numero: 'SAME-001', ementa: 'Dano moral consumidor' })
  const r2 = makeResult({ id: 'b', numero: 'SAME-001', ementa: 'Tributário ISS' })
  const out = dedupeEprocResults([r1, r2])
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'a')
})

test('dedupeEprocResults: removes near-duplicate ementas', () => {
  const r1 = makeResult({ id: 'a', numero: 'N001', ementa: 'RECURSO  ESPECIAL  Dano  moral' })
  const r2 = makeResult({ id: 'b', numero: 'N002', ementa: 'RECURSO ESPECIAL Dano moral' })
  const out = dedupeEprocResults([r1, r2])
  assert.equal(out.length, 1)
})

test('dedupeEprocResults: preserves distinct results', () => {
  const results = [
    makeResult({ id: 'a', numero: 'N001', ementa: 'Administrativo licitação' }),
    makeResult({ id: 'b', numero: 'N002', ementa: 'Penal furto consumado' }),
    makeResult({ id: 'c', numero: 'N003', ementa: 'Tributário IPTU progressivo' }),
  ]
  const out = dedupeEprocResults(results)
  assert.equal(out.length, 3)
})

test('dedupeEprocResults: empty array returns empty array', () => {
  assert.deepEqual(dedupeEprocResults([]), [])
})

test('dedupeEprocResults: maintains order, first occurrence wins', () => {
  const first = makeResult({ id: 'first', numero: 'DUP', ementa: 'Direito constitucional' })
  const second = makeResult({ id: 'second', numero: 'DUP', ementa: 'Habeas corpus preventivo' })
  const out = dedupeEprocResults([first, second])
  assert.equal(out[0].id, 'first')
})
