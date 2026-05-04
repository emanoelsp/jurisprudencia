// Parser TOON para Bases Públicas (inspirado no semantic_agent)
// Formato: ⟨BP⟩⟨F:fonte⟩⟨T:tipo⟩⟨E:ementa⟩⟨A:aplicabilidade⟩⟨/BP⟩
// Elimina erros de JSON malformado – parsing determinístico com regex.

// Mesmo padrão do semantic_agent: ⟨KEY⟩ ou ⟨KEY:value⟩
const TOKEN_REGEX = /[⟨<]([^:>⟩]+)(?::([^>⟩]*))?[⟩>]/g

function stripMarkdownCodeBlocks(text: string): string {
  return text.replace(/```[\w]*\n?/g, '').replace(/```$/g, '').trim()
}

function normalizeToon(input: string): string {
  return input.replace(/</g, '⟨').replace(/>/g, '⟩')
}

function extractTokens(input: string): Array<{ key: string; value: string }> {
  const normalized = normalizeToon(stripMarkdownCodeBlocks(input))
  const tokens: Array<{ key: string; value: string }> = []
  let match: RegExpExecArray | null
  const re = new RegExp(TOKEN_REGEX.source, 'g')
  while ((match = re.exec(normalized)) !== null) {
    tokens.push({ key: match[1].trim(), value: (match[2] ?? '').trim() })
  }
  return tokens
}

export interface BasesPublicasItem {
  id: string
  tipo: string
  fonte: string
  ementa: string
  aplicabilidade?: string
}

/**
 * Parse da string TOON no formato ⟨BP⟩⟨F:fonte⟩⟨T:tipo⟩⟨E:ementa⟩⟨A:aplicabilidade⟩⟨/BP⟩.
 * Aceita múltiplos blocos. Parsing determinístico – sem dependência de JSON.
 */
export function parseToonBasesPublicas(input: string): BasesPublicasItem[] {
  const trimmed = (input || '').trim()
  if (!trimmed) return []

  const tokens = extractTokens(trimmed)
  if (tokens.length === 0) return []

  const results: BasesPublicasItem[] = []
  let current: Partial<BasesPublicasItem> = {}

  const pushCurrent = () => {
    if (current.fonte && current.ementa && current.ementa.length > 10) {
      results.push({
        id: `bp-${results.length}`,
        tipo: current.tipo || 'jurisprudencia',
        fonte: current.fonte,
        ementa: current.ementa,
        aplicabilidade: current.aplicabilidade,
      })
    }
  }

  for (const { key, value } of tokens) {
    if (key === 'BP' || key === 'BP_START') {
      pushCurrent()
      current = {}
    } else if (key === 'BP_END' || key === '/BP') {
      pushCurrent()
      current = {}
    } else if (key === 'F' || key === 'FONTE') {
      current.fonte = value
    } else if (key === 'T' || key === 'TIPO') {
      current.tipo = value
    } else if (key === 'E' || key === 'EMENTA') {
      current.ementa = value
    } else if (key === 'A' || key === 'APLIC') {
      current.aplicabilidade = value
    }
  }

  pushCurrent()
  return results.slice(0, 6)
}
