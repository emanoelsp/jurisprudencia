import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateExtractedMetadataSchema,
  parseExtractedMetadataJson,
  isLegalScopeText,
  parseJustificationJson,
} from '../src/lib/guards.js'

test('metadata schema validation accepts valid payload', () => {
  const valid = {
    numero: '5001234-56.2024.8.26.0100',
    cliente: 'Marina Lopes Ferreira',
    natureza: 'Ação de Indenização',
    vara: '12ª Vara Cível',
    tribunal: 'TJSP',
    dataProtocolo: '2024-11-03',
  }
  assert.equal(validateExtractedMetadataSchema(valid), true)
})

test('metadata schema validation rejects malformed payload', () => {
  const invalid = {
    numero: '5001234-56.2024.8.26.0100',
    cliente: 123,
    natureza: 'Ação',
  }
  assert.equal(validateExtractedMetadataSchema(invalid), false)
})

test('parseExtractedMetadataJson parses and validates JSON', () => {
  const raw = JSON.stringify({
    numero: '5001234-56.2024.8.26.0100',
    cliente: 'Marina Lopes Ferreira',
    natureza: 'Ação de Indenização',
    vara: '12ª Vara Cível',
    tribunal: 'TJSP',
    dataProtocolo: '2024-11-03',
  })
  const parsed = parseExtractedMetadataJson(raw)
  assert.equal(parsed?.cliente, 'Marina Lopes Ferreira')
})

test('isLegalScopeText returns true for legal context with CNJ', () => {
  const legalText = `
  Número CNJ: 5001234-56.2024.8.26.0100.
  A autora propõe ação de indenização por danos morais perante a 12ª Vara Cível.
  `
  assert.equal(isLegalScopeText(legalText), true)
})

test('isLegalScopeText returns false for out-of-scope content', () => {
  const outOfScope = `
  Receita de bolo de cenoura com cobertura de chocolate.
  Misture os ingredientes e asse por 40 minutos em forno médio.
  `
  assert.equal(isLegalScopeText(outOfScope), false)
})

test('parseJustificationJson accepts valid schema with citations', () => {
  const raw = JSON.stringify({
    conclusao: 'Precedente aderente ao caso concreto.',
    fundamentoJuridico: 'Responsabilidade civil objetiva por negativação indevida.',
    aplicabilidade: 'Pode embasar pedido de danos morais e reforçar presunção de dano.',
    citacoes: [
      {
        numero: '1023456-78.2022.8.26.0100',
        tribunal: 'TJSP',
        relator: 'Des. Carlos Alberto Garbi',
        dataJulgamento: '2023-03-15',
        trecho: 'Presunção de dano moral por inscrição indevida.',
      },
    ],
  })
  const parsed = parseJustificationJson(raw)
  assert.equal(parsed?.citacoes?.length, 1)
})

test('parseJustificationJson rejects missing citations', () => {
  const raw = JSON.stringify({
    conclusao: 'Sem base',
    fundamentoJuridico: 'Sem base',
    aplicabilidade: 'Sem base',
    citacoes: [],
  })
  const parsed = parseJustificationJson(raw)
  assert.equal(parsed, null)
})
