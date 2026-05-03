import test from 'node:test'
import assert from 'node:assert/strict'
// Run with: node --experimental-strip-types --test tests/unit-pii.test.js
import { sanitizePii, sanitizePiiReport } from '../src/lib/pii.ts'

// ── CNJ preservation ──────────────────────────────────────────────────────────

test('preserves CNJ process numbers untouched', () => {
  const input = 'Processo 1234567-89.2023.8.26.0100 requer atenção.'
  const out = sanitizePii(input)
  assert.ok(out.includes('1234567-89.2023.8.26.0100'), 'CNJ should be preserved')
})

test('preserves multiple CNJ numbers in the same text', () => {
  const input = 'Processos 1234567-89.2023.8.26.0100 e 9999999-01.2022.4.01.3400 apensados.'
  const out = sanitizePii(input)
  assert.ok(out.includes('1234567-89.2023.8.26.0100'))
  assert.ok(out.includes('9999999-01.2022.4.01.3400'))
})

// ── CPF sanitization ──────────────────────────────────────────────────────────

test('redacts formatted CPF', () => {
  const out = sanitizePii('O réu, CPF 123.456.789-09, compareceu.')
  assert.ok(out.includes('[CPF]'), 'CPF should be redacted')
  assert.ok(!out.includes('123.456.789-09'))
})

test('does not redact CNJ number as CPF', () => {
  const input = 'Processo 1234567-89.2023.8.26.0100'
  const out = sanitizePii(input)
  assert.ok(out.includes('1234567-89.2023.8.26.0100'))
  assert.ok(!out.includes('[CPF]'))
})

// ── CNPJ sanitization ─────────────────────────────────────────────────────────

test('redacts formatted CNPJ', () => {
  const out = sanitizePii('Empresa CNPJ 12.345.678/0001-90 ltda.')
  assert.ok(out.includes('[CNPJ]'), 'CNPJ should be redacted')
  assert.ok(!out.includes('12.345.678/0001-90'))
})

// ── Email sanitization ────────────────────────────────────────────────────────

test('redacts email addresses', () => {
  const out = sanitizePii('Contato: advogado@escritorio.com.br para mais detalhes.')
  assert.ok(out.includes('[EMAIL]'), 'email should be redacted')
  assert.ok(!out.includes('@escritorio'))
})

// ── CEP sanitization ──────────────────────────────────────────────────────────

test('redacts CEP with hyphen', () => {
  const out = sanitizePii('Endereço: Rua X, CEP 01310-100.')
  assert.ok(out.includes('[CEP]'), 'CEP should be redacted')
  assert.ok(!out.includes('01310-100'))
})

// ── Count reporting ───────────────────────────────────────────────────────────

test('sanitizePiiReport counts redactions correctly', () => {
  const text = 'CPF 123.456.789-09, email foo@bar.com, CEP 01310-100.'
  const { count } = sanitizePiiReport(text)
  assert.ok(count >= 3, `Expected at least 3 redactions, got ${count}`)
})

test('sanitizePiiReport returns 0 for clean text', () => {
  const { count } = sanitizePiiReport('O processo judicial segue tramitando normalmente.')
  assert.equal(count, 0)
})

// ── CNJ + PII in same text ────────────────────────────────────────────────────

test('preserves CNJ while redacting PII in the same string', () => {
  const input = 'Proc. 1234567-89.2023.8.26.0100, parte Maria, CPF 987.654.321-00, e-mail m@m.com.'
  const out = sanitizePii(input)
  assert.ok(out.includes('1234567-89.2023.8.26.0100'), 'CNJ preserved')
  assert.ok(out.includes('[CPF]'), 'CPF redacted')
  assert.ok(out.includes('[EMAIL]'), 'email redacted')
  assert.ok(!out.includes('987.654.321-00'))
  assert.ok(!out.includes('m@m.com'))
})
