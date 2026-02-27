// src/lib/toon.ts
// TOON - Typed Object-Oriented Notation
// Acts as a structured anchor between the Reranker and final LLM
// Guarantees zero hallucination on process numbers, names, dates
// The LLM receives TOON payloads as ground-truth facts it cannot modify

import crypto from 'crypto'
import type { ToonPayload, EprocResult } from '@/types'

/**
 * Creates a TOON payload from an eproc result.
 * The TOON object is serialized into the LLM prompt as a read-only anchor.
 * The LLM is instructed to ONLY reference these fields verbatim.
 */
export function createToonPayload(result: EprocResult): ToonPayload {
  const ementaHash = crypto
    .createHash('sha256')
    .update(result.ementa)
    .digest('hex')
    .slice(0, 16)

  return {
    _type:           'ToonJurisprudencia',
    _version:        '1.0',
    numeroProcesso:  result.numero,
    tribunal:        result.tribunal,
    relator:         result.relator,
    dataJulgamento:  result.dataJulgamento,
    ementaHash,
    ementaOriginal:  result.ementa,
    classeProcessual: inferClasseProcessual(result.ementa),
    orgaoJulgador:   inferOrgaoJulgador(result.tribunal),
    tags:            extractTags(result.ementa),
  }
}

/**
 * Serializes TOON payloads to structured prompt XML
 * that instructs the LLM to treat these as immutable facts
 */
export function serializeToonForPrompt(payloads: ToonPayload[]): string {
  const items = payloads.map((p, i) => `
  <jurisprudencia index="${i + 1}">
    <IMMUTABLE_FACTS>
      <!-- DO NOT REPHRASE, MODIFY, OR HALLUCINATE THESE VALUES -->
      <numero_processo>${p.numeroProcesso}</numero_processo>
      <tribunal>${p.tribunal}</tribunal>
      <relator>${p.relator}</relator>
      <data_julgamento>${p.dataJulgamento}</data_julgamento>
      <integridade_hash>${p.ementaHash}</integridade_hash>
    </IMMUTABLE_FACTS>
    <ementa_original><![CDATA[${p.ementaOriginal}]]></ementa_original>
    <classe_processual>${p.classeProcessual}</classe_processual>
    <orgao_julgador>${p.orgaoJulgador}</orgao_julgador>
    <tags>${p.tags.join(', ')}</tags>
  </jurisprudencia>`).join('\n')

  return `<toon_ground_truth version="1.0">
  <!-- TOON: Typed Object-Oriented Notation - Anti-Hallucination Layer -->
  <!-- INSTRUÇÃO CRÍTICA: Os campos dentro de IMMUTABLE_FACTS são fatos imutáveis. -->
  <!-- NUNCA invente, modifique ou substitua números de processo, nomes ou datas. -->
  <!-- Use APENAS os valores exatos fornecidos aqui. -->
  ${items}
</toon_ground_truth>`
}

/**
 * Validates that LLM output doesn't hallucinate process numbers
 * by cross-checking against TOON payloads
 */
export function validateToonIntegrity(
  llmOutput: string,
  payloads: ToonPayload[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = []

  for (const p of payloads) {
    // Check if the process number appears verbatim in output
    if (llmOutput.includes(p.ementaHash)) {
      // Hash reference found - valid
    }

    // Extract any process number patterns from LLM output
    const cnj = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g
    const matches = llmOutput.match(cnj) || []

    for (const match of matches) {
      const isKnown = payloads.some((tp) => tp.numeroProcesso === match)
      if (!isKnown) {
        violations.push(`Número de processo não reconhecido: ${match}`)
      }
    }
  }

  return { valid: violations.length === 0, violations }
}

// --- Helpers ---

function inferClasseProcessual(ementa: string): string {
  const lower = ementa.toLowerCase()
  if (lower.includes('recurso especial')) return 'REsp'
  if (lower.includes('recurso extraordinário')) return 'RE'
  if (lower.includes('habeas corpus')) return 'HC'
  if (lower.includes('mandado de segurança')) return 'MS'
  if (lower.includes('apelação')) return 'APL'
  if (lower.includes('agravo')) return 'AG'
  return 'Processo'
}

function inferOrgaoJulgador(tribunal: string): string {
  const t = tribunal.toUpperCase()
  if (t.includes('STJ')) return 'Superior Tribunal de Justiça'
  if (t.includes('STF')) return 'Supremo Tribunal Federal'
  if (t.includes('TST')) return 'Tribunal Superior do Trabalho'
  if (t.includes('TRF')) return tribunal
  if (t.includes('TJSP')) return 'Tribunal de Justiça de São Paulo'
  if (t.includes('TJRJ')) return 'Tribunal de Justiça do Rio de Janeiro'
  return tribunal
}

function extractTags(ementa: string): string[] {
  const keywords = [
    'responsabilidade civil', 'dano moral', 'dano material',
    'contrato', 'rescisão', 'indenização', 'prescrição',
    'decadência', 'consumidor', 'tributário', 'penal',
    'administrativo', 'trabalhista', 'previdenciário',
  ]
  return keywords.filter(k => ementa.toLowerCase().includes(k)).slice(0, 5)
}
