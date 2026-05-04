// Busca artigos da CF/88 em https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm

export interface ArtigoCF {
  id: string
  titulo: string
  texto: string
}

let cachedArticles: ArtigoCF[] | null = null
let cacheTime = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

function parseCfHtml(html: string): ArtigoCF[] {
  const articles: ArtigoCF[] = []
  const text = stripHtml(html)
  const artBlocks = text.split(/(?=Art\.\s*\d+[ºª]?)/i)
  for (const block of artBlocks) {
    const m = block.match(/Art\.\s*(\d+[ºª]?)(?:\s*,\s*([^.]+?))?\s+[-–—]?\s*([\s\S]+)/i)
    if (m) {
      const num = m[1].trim()
      const inciso = m[2]?.trim().slice(0, 80) || ''
      let corpo = (m[3] || '').trim().slice(0, 1800)
      const nextArt = corpo.search(/\bArt\.\s*\d+[ºª]?\b/i)
      if (nextArt > 0) corpo = corpo.slice(0, nextArt).trim()
      if (corpo.length > 30) {
        const titulo = inciso ? `Art. ${num}, ${inciso}` : `Art. ${num}`
        const id = `art-${num.replace(/[ºª]/g, '')}`.replace(/\s+/g, '-')
        articles.push({ id, titulo, texto: corpo })
      }
    }
  }
  return articles.slice(0, 200)
}

const FALLBACK_ARTIGOS: ArtigoCF[] = [
  { id: 'art-5', titulo: 'Art. 5º, V', texto: 'é assegurado o direito de resposta, proporcional ao agravo, além da indenização por dano material, moral ou à imagem' },
  { id: 'art-5-x', titulo: 'Art. 5º, X', texto: 'são invioláveis a intimidade, a vida privada, a honra e a imagem das pessoas, assegurado o direito à indenização pelo dano material ou moral decorrente de sua violação' },
  { id: 'art-5-xxxv', titulo: 'Art. 5º, XXXV', texto: 'a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito' },
  { id: 'art-5-lv', titulo: 'Art. 5º, LV', texto: 'aos litigantes, em processo judicial ou administrativo, e aos acusados em geral são assegurados o contraditório e ampla defesa, com os meios e recursos a ela inerentes' },
  { id: 'art-5-xxxix', titulo: 'Art. 5º, XXXIX', texto: 'não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal' },
]

export async function fetchCfPlanalto(): Promise<ArtigoCF[]> {
  if (cachedArticles && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedArticles
  }
  try {
    const res = await fetch('https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm', {
      headers: { 'Accept': 'text/html; charset=iso-8859-1' },
      next: { revalidate: 86400 },
    })
    const buf = await res.arrayBuffer()
    const decoder = new TextDecoder('iso-8859-1')
    const html = decoder.decode(buf)
    const parsed = parseCfHtml(html)
    if (parsed.length > 5) {
      cachedArticles = parsed
      cacheTime = Date.now()
      return cachedArticles
    }
  } catch (err) {
    console.warn('[cf-planalto] fetch failed', err)
  }
  cachedArticles = FALLBACK_ARTIGOS
  cacheTime = Date.now()
  return cachedArticles
}

export function getArtigoResumoParaIA(arts: ArtigoCF[], maxChars = 12000): string {
  return arts
    .map(a => `[${a.titulo}]\n${a.texto.slice(0, 500)}`)
    .join('\n\n')
    .slice(0, maxChars)
}
