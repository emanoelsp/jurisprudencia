// Sub-agente: extrai causa petendi e pedido de petição para formular query RAG
// Inspirado no semantic_agent extract-datasheet (PDF → variáveis → TOON)

export interface CausaPetendiResult {
  causaPetendi: string
  pedido: string
  artigosCitados: string[]
  termosChave: string[]
  queryRag: string
}

const EXTRACT_PETITION_SYSTEM = `Você é um analista processual especializado em petições e peças iniciais.
Extraia do texto processual APENAS os dados estruturados no formato TOON.

FORMATO OBRIGATÓRIO - TOON (tokens ⟨⟩):
⟨PET⟩⟨CAUSA:resumo da causa petendi em 1-2 frases⟩⟨PEDIDO:pedido principal resumido⟩⟨ART:artigos citados, separados por vírgula⟩⟨TERMOS:termos-chave para busca, separados por vírgula⟩⟨/PET⟩

Exemplo:
⟨PET⟩⟨CAUSA:Dano moral in re ipsa decorrente de calúnia e difamação em redes sociais⟩⟨PEDIDO:Condenação em danos morais e penais nos crimes contra honra⟩⟨ART:138, 139, 140, 927, 949 CPC⟩⟨TERMOS:dano moral, calúnia, difamação, honra objetiva, queixa-crime⟩⟨/PET⟩

REGRAS:
- NUNCA invente números de processo ou nomes.
- Use APENAS o que está no texto.
- Causa petendi: fatos jurídicos relevantes, fundamento do pedido.
- Pedido: o que a parte requer ao juiz.
- Artigos: números de artigos de lei citados (138, 5, 927, etc.).
- Termos: 4-8 palavras-chave para busca em jurisprudência.`

function parseToonPetition(raw: string): CausaPetendiResult | null {
  const causaMatch = raw.match(/⟨CAUSA:([^⟩]*)⟩/i)
  const pedidoMatch = raw.match(/⟨PEDIDO:([^⟩]*)⟩/i)
  const artMatch = raw.match(/⟨ART:([^⟩]*)⟩/i)
  const termosMatch = raw.match(/⟨TERMOS:([^⟩]*)⟩/i)

  if (!causaMatch && !pedidoMatch) return null

  const causaPetendi = (causaMatch?.[1] || '').trim()
  const pedido = (pedidoMatch?.[1] || '').trim()
  const artigosCitados = (artMatch?.[1] || '')
    .split(/[,;]/)
    .map(a => a.trim().replace(/\s+/g, ' '))
    .filter(a => a.length > 0 && /\d/.test(a))
  const termosChave = (termosMatch?.[1] || '')
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length >= 3)
    .slice(0, 10)

  const queryParts: string[] = []
  if (causaPetendi) queryParts.push(causaPetendi)
  if (pedido) queryParts.push(pedido)
  if (artigosCitados.length > 0) queryParts.push(artigosCitados.join(' '))
  if (termosChave.length > 0) queryParts.push(termosChave.join(' '))

  const queryRag = queryParts.join(' ').trim().slice(0, 1500)

  return {
    causaPetendi,
    pedido,
    artigosCitados,
    termosChave,
    queryRag: queryRag || causaPetendi || pedido || '',
  }
}

/**
 * Extrai causa petendi e pedido de texto processual para formular query RAG.
 * Retorna query otimizada para busca vetorial + lexical.
 */
export async function extractCausaPetendi(
  texto: string,
  invokeLlm: (system: string, user: string) => Promise<string>
): Promise<CausaPetendiResult | null> {
  if (!texto || texto.trim().length < 100) return null

  const userContent = `Extraia causa petendi, pedido, artigos citados e termos-chave deste texto processual.
Retorne APENAS no formato TOON: ⟨PET⟩⟨CAUSA:...⟩⟨PEDIDO:...⟩⟨ART:...⟩⟨TERMOS:...⟩⟨/PET⟩

TEXTO:
${texto.slice(0, 4000)}`

  try {
    const raw = await invokeLlm(EXTRACT_PETITION_SYSTEM, userContent)
    return parseToonPetition(raw)
  } catch (err) {
    console.warn('[extract-causa-petendi] failed', err)
    return null
  }
}
