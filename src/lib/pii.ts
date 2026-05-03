// LGPD compliance: sanitizes Brazilian PII before sending to third-party LLM APIs.
// CNJ process numbers (e.g. 0001234-56.2021.8.26.0001) are NEVER sanitized — they are
// required for TOON integrity and cannot be treated as PII in this context.

const CNJ_PATTERN = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g

// CPF with or without formatting: 000.000.000-00 or 00000000000
// Exclude sequences that look like CNJ sub-sequences by requiring boundary context
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-\d{2}\b/g

// CNPJ with or without formatting: 00.000.000/0000-00 or 00000000000000
const CNPJ_PATTERN = /\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-\d{2}\b/g

// Brazilian phone: (11) 91234-5678, 11 91234-5678, +5511912345678
const PHONE_PATTERN = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// CEP: 00000-000 or 00000000 (only with hyphen to avoid false positives on numbers)
const CEP_PATTERN = /\b\d{5}-\d{3}\b/g

export function sanitizePii(text: string): string {
  const { sanitized } = sanitizePiiReport(text)
  return sanitized
}

export function sanitizePiiReport(text: string): { sanitized: string; count: number } {
  // Protect CNJ numbers before any replacement
  const preserved: string[] = []
  let protected_ = text.replace(CNJ_PATTERN, (m) => {
    preserved.push(m)
    return `\x00CNJ${preserved.length - 1}\x00`
  })

  let count = 0
  const replace = (pattern: RegExp, label: string) => {
    protected_ = protected_.replace(pattern, () => {
      count++
      return label
    })
  }

  replace(CNPJ_PATTERN, '[CNPJ]')   // CNPJ before CPF — longer pattern, avoids partial overlap
  replace(CPF_PATTERN,  '[CPF]')
  replace(PHONE_PATTERN, '[TELEFONE]')
  replace(EMAIL_PATTERN, '[EMAIL]')
  replace(CEP_PATTERN,  '[CEP]')

  // Restore CNJ numbers
  const sanitized = protected_.replace(/\x00CNJ(\d+)\x00/g, (_, i) => preserved[Number(i)])

  return { sanitized, count }
}
