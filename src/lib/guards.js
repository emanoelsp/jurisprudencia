const CNJ_REGEX = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/

const LEGAL_KEYWORDS = [
  'processo',
  'acao',
  'ação',
  'peticao',
  'petição',
  'autor',
  'réu',
  'reu',
  'tribunal',
  'vara',
  'jurisprudencia',
  'jurisprudência',
  'sentenca',
  'sentença',
  'acordao',
  'acórdão',
  'recurso',
  'indenizacao',
  'indenização',
  'danos',
  'cível',
  'civel',
  'penal',
  'trabalhista',
  'consumidor',
  'oab',
]

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringField(obj, key) {
  return typeof obj[key] === 'string'
}

export function validateExtractedMetadataSchema(value) {
  if (!isObject(value)) return false
  const requiredKeys = [
    'numero',
    'cliente',
    'natureza',
    'vara',
    'tribunal',
    'dataProtocolo',
  ]

  return requiredKeys.every(key => hasStringField(value, key))
}

export function parseExtractedMetadataJson(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  try {
    const parsed = JSON.parse(raw)
    return validateExtractedMetadataSchema(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isLegalScopeText(text) {
  if (typeof text !== 'string') return false
  const normalized = text.toLowerCase().trim()
  if (normalized.length < 80) return false

  if (CNJ_REGEX.test(normalized)) return true

  let score = 0
  for (const keyword of LEGAL_KEYWORDS) {
    if (normalized.includes(keyword)) score += 1
    if (score >= 2) return true
  }

  return false
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validateCitation(item) {
  if (!isObject(item)) return false
  return (
    isNonEmptyString(item.numero) &&
    isNonEmptyString(item.tribunal) &&
    isNonEmptyString(item.relator) &&
    isNonEmptyString(item.dataJulgamento) &&
    isNonEmptyString(item.trecho)
  )
}

export function validateJustificationSchema(value) {
  if (!isObject(value)) return false
  if (!isNonEmptyString(value.conclusao)) return false
  if (!isNonEmptyString(value.fundamentoJuridico)) return false
  if (!isNonEmptyString(value.aplicabilidade)) return false
  if (!Array.isArray(value.citacoes) || value.citacoes.length === 0) return false
  if (!value.citacoes.every(validateCitation)) return false
  return true
}

export function parseJustificationJson(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  try {
    const parsed = JSON.parse(raw)
    return validateJustificationSchema(parsed) ? parsed : null
  } catch {
    return null
  }
}
