import test from 'node:test'
import assert from 'node:assert/strict'
// Run with: node --experimental-strip-types --test tests/unit-toon.test.js
import {
  createToonPayload,
  validateToonIntegrity,
  validateJustificationCitations,
  serializeToonForPrompt,
} from '../src/lib/toon.ts'

const MOCK_RESULT = {
  id: 'r1',
  numero: '1234567-89.2023.8.26.0100',
  ementa: 'RECURSO ESPECIAL. Dano moral. Procedência.',
  tribunal: 'STJ',
  relator: 'Min. João Silva',
  dataJulgamento: '2023-06-15',
  score: 0.9,
  badge: 'alta',
}

// ── createToonPayload ─────────────────────────────────────────────────────────

test('createToonPayload preserves exact processo number', () => {
  const p = createToonPayload(MOCK_RESULT)
  assert.equal(p.numeroProcesso, MOCK_RESULT.numero)
})

test('createToonPayload preserves exact tribunal', () => {
  const p = createToonPayload(MOCK_RESULT)
  assert.equal(p.tribunal, MOCK_RESULT.tribunal)
})

test('createToonPayload preserves exact relator', () => {
  const p = createToonPayload(MOCK_RESULT)
  assert.equal(p.relator, MOCK_RESULT.relator)
})

test('createToonPayload generates SHA-256 hash (16-char hex)', () => {
  const p = createToonPayload(MOCK_RESULT)
  assert.match(p.ementaHash, /^[0-9a-f]{16}$/)
})

test('createToonPayload hash is deterministic for same input', () => {
  const p1 = createToonPayload(MOCK_RESULT)
  const p2 = createToonPayload(MOCK_RESULT)
  assert.equal(p1.ementaHash, p2.ementaHash)
})

test('createToonPayload hash differs for different ementas', () => {
  const p1 = createToonPayload(MOCK_RESULT)
  const p2 = createToonPayload({ ...MOCK_RESULT, ementa: 'Outro conteúdo completamente diferente.' })
  assert.notEqual(p1.ementaHash, p2.ementaHash)
})

test('createToonPayload sets correct _type and _version', () => {
  const p = createToonPayload(MOCK_RESULT)
  assert.equal(p._type, 'ToonJurisprudencia')
  assert.equal(p._version, '1.0')
})

// ── validateToonIntegrity ─────────────────────────────────────────────────────

test('validateToonIntegrity passes for text with no CNJ numbers', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const { valid, violations } = validateToonIntegrity('Análise sem números de processo.', [payload])
  assert.equal(valid, true)
  assert.equal(violations.length, 0)
})

test('validateToonIntegrity passes when output contains only known CNJ number', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const output = `O processo ${MOCK_RESULT.numero} é relevante ao caso.`
  const { valid } = validateToonIntegrity(output, [payload])
  assert.equal(valid, true)
})

test('validateToonIntegrity detects hallucinated CNJ number', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const hallucinated = 'Vide processo 9999999-99.2024.8.26.9999 — fictício.'
  const { valid, violations } = validateToonIntegrity(hallucinated, [payload])
  assert.equal(valid, false)
  assert.ok(violations.length > 0, 'Should have violations')
})

// ── validateJustificationCitations ───────────────────────────────────────────

test('validateJustificationCitations passes for matching citation', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const citacoes = [{
    numero: MOCK_RESULT.numero,
    tribunal: 'STJ',
    relator: 'Min. João Silva',
    dataJulgamento: '2023-06-15',
  }]
  const { valid } = validateJustificationCitations(citacoes, [payload])
  assert.equal(valid, true)
})

test('validateJustificationCitations flags unknown numero', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const citacoes = [{ numero: '0000001-00.2020.1.00.0000', tribunal: 'STJ' }]
  const { valid, violations } = validateJustificationCitations(citacoes, [payload])
  assert.equal(valid, false)
  assert.ok(violations.some(v => v.includes('não presente no TOON')))
})

// ── serializeToonForPrompt ────────────────────────────────────────────────────

test('serializeToonForPrompt includes immutable number', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const xml = serializeToonForPrompt([payload])
  assert.ok(xml.includes(MOCK_RESULT.numero), 'XML should contain the process number')
})

test('serializeToonForPrompt includes IMMUTABLE_FACTS tag', () => {
  const payload = createToonPayload(MOCK_RESULT)
  const xml = serializeToonForPrompt([payload])
  assert.ok(xml.includes('IMMUTABLE_FACTS'))
})
