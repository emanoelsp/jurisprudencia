// Parser TOON para artigos CF/88 (inspirado no semantic_agent)
// Formato: ⟨CF⟩⟨ID:art-X⟩⟨TIT:Art. X⟩⟨APLIC:explicacao⟩⟨/CF⟩
// Parsing determinístico com regex – sem dependência de JSON.

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

export interface CfArtigoItem {
  id: string
  titulo: string
  texto: string
  aplicabilidade?: string
}

function normalizeArtRef(s: string): string {
  return (s || '').toLowerCase().replace(/[ºª]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Parse da string TOON no formato ⟨CF⟩⟨ID:art-X⟩⟨TIT:Art. X⟩⟨APLIC:explicacao⟩⟨/CF⟩.
 * Converte para objetos com id, titulo, texto, aplicabilidade.
 */
export function parseToonCf(
  input: string,
  arts: { id: string; titulo: string; texto: string }[]
): CfArtigoItem[] {
  const trimmed = (input || '').trim()
  if (!trimmed) return []

  const tokens = extractTokens(trimmed)
  if (tokens.length === 0) return []

  const results: CfArtigoItem[] = []
  let current: Partial<CfArtigoItem> & { titulo?: string } = {}

  for (const { key, value } of tokens) {
    if (key === 'CF' || key === 'CF_START') {
      current = {}
    } else if (key === 'CF_END' || key === '/CF') {
      if (current.titulo && current.titulo.length > 3) {
        const titulo = current.titulo
        const numMatch = titulo.match(/art\.?\s*(\d+)/i) || (current.id || '').match(/(\d+)/)
        const num = numMatch?.[1] || ''
        const id = (current.id || `art-${num}`).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
        const titNorm = normalizeArtRef(titulo)
        const orig = arts.find(x => {
          if (x.id === id || x.id.includes(id)) return true
          const xNorm = normalizeArtRef(x.titulo)
          if (xNorm.includes(titNorm) || titNorm.includes(xNorm)) return true
          if (num && x.titulo.includes(num)) return true
          return false
        })
        results.push({
          id: orig?.id || id,
          titulo: orig?.titulo || titulo,
          texto: orig?.texto || '',
          aplicabilidade: current.aplicabilidade,
        })
      }
      current = {}
    } else if (key === 'ID') {
      current.id = value
    } else if (key === 'TIT' || key === 'TITULO') {
      current.titulo = value
    } else if (key === 'APLIC') {
      current.aplicabilidade = value
    }
  }

  if (current.titulo && current.titulo.length > 3) {
    const titulo = current.titulo
    const numMatch = titulo.match(/art\.?\s*(\d+)/i) || (current.id || '').match(/(\d+)/)
    const num = numMatch?.[1] || ''
    const id = (current.id || `art-${num}`).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
    const titNorm = normalizeArtRef(titulo)
    const orig = arts.find(x => {
      if (x.id === id || x.id.includes(id)) return true
      const xNorm = normalizeArtRef(x.titulo)
      if (xNorm.includes(titNorm) || titNorm.includes(xNorm)) return true
      if (num && x.titulo.includes(num)) return true
      return false
    })
    results.push({
      id: orig?.id || id,
      titulo: orig?.titulo || titulo,
      texto: orig?.texto || '',
      aplicabilidade: current.aplicabilidade,
    })
  }

  return results.slice(0, 5)
}
