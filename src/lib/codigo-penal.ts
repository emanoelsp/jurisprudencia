// Artigos do Código Penal (Decreto-lei 2.848/1940)
// Fonte: Planalto - https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm

export interface ArtigoPenal {
  id: string
  titulo: string
  texto: string
  tema: string
}

export const ARTIGOS_PENAIS: ArtigoPenal[] = [
  { id: 'cp-1', titulo: 'Art. 1º CP - Anterioridade da lei', tema: 'Princípios', texto: 'Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal.' },
  { id: 'cp-13', titulo: 'Art. 13 CP - Relação de causalidade', tema: 'Teoria do crime', texto: 'O resultado, de que depende a existência do crime, somente é imputável a quem lhe deu causa. Considera-se causa a ação ou omissão sem a qual o resultado não teria ocorrido.' },
  { id: 'cp-14', titulo: 'Art. 14 CP - Crime consumado e tentativa', tema: 'Teoria do crime', texto: 'Diz-se o crime: I - consumado, quando nele se reúnem todos os elementos de sua definição legal; II - tentado, quando, iniciada a execução, não se consuma por circunstâncias alheias à vontade do agente.' },
  { id: 'cp-18', titulo: 'Art. 18 CP - Crime doloso e culposo', tema: 'Teoria do crime', texto: 'Diz-se o crime: I - doloso, quando o agente quis o resultado ou assumiu o risco de produzi-lo; II - culposo, quando o agente deu causa ao resultado por imprudência, negligência ou imperícia.' },
  { id: 'cp-23', titulo: 'Art. 23 CP - Exclusão de ilicitude', tema: 'Teoria do crime', texto: 'Não há crime quando o agente pratica o fato: I - em estado de necessidade; II - em legítima defesa; III - em estrito cumprimento de dever legal ou no exercício regular de direito.' },
  { id: 'cp-100', titulo: 'Art. 100 CP - Ação penal pública e privada', tema: 'Ação penal', texto: 'A ação penal é pública, salvo quando a lei expressamente a declara privativa do ofendido.' },
  { id: 'cp-103', titulo: 'Art. 103 CP - Decadência do direito de queixa', tema: 'Ação penal', texto: 'Salvo disposição expressa em contrário, o ofendido decai do direito de queixa ou de representação se não o exerce dentro do prazo de 6 (seis) meses, contado do dia em que veio a saber quem é o autor do crime.' },
  { id: 'cp-121', titulo: 'Art. 121 CP - Homicídio', tema: 'Crimes contra a pessoa', texto: 'Matar alguém: Pena – reclusão, de seis a vinte anos.' },
  { id: 'cp-129', titulo: 'Art. 129 CP - Lesão corporal', tema: 'Crimes contra a pessoa', texto: 'Ofender a integridade corporal ou a saúde de outrem: Pena – detenção, de três meses a um ano.' },
  { id: 'cp-138', titulo: 'Art. 138 CP - Calúnia', tema: 'Crimes contra a honra', texto: 'Caluniar alguém, imputando-lhe falsamente fato definido como crime: Pena – detenção, de seis meses a dois anos, e multa.' },
  { id: 'cp-139', titulo: 'Art. 139 CP - Difamação', tema: 'Crimes contra a honra', texto: 'Difamar alguém, imputando-lhe fato ofensivo à sua reputação: Pena – detenção, de três meses a um ano, e multa.' },
  { id: 'cp-140', titulo: 'Art. 140 CP - Injúria', tema: 'Crimes contra a honra', texto: 'Injuriar alguém, ofendendo-lhe a dignidade ou o decoro: Pena – detenção, de um a seis meses, ou multa.' },
  { id: 'cp-141', titulo: 'Art. 141 CP - Disposições comuns crimes contra honra', tema: 'Crimes contra a honra', texto: 'As penas cominadas neste Capítulo aumentam-se de um terço, se qualquer dos crimes é cometido: III - na presença de várias pessoas, ou por meio que facilite a divulgação da calúnia, da difamação ou da injúria; IV - contra criança, adolescente, pessoa maior de 60 anos ou pessoa com deficiência.' },
  { id: 'cp-145', titulo: 'Art. 145 CP - Ação penal nos crimes contra honra', tema: 'Crimes contra a honra', texto: 'Nos crimes previstos neste Capítulo somente se procede mediante queixa, salvo quando, no caso do art. 140, § 2º, da violência resulta lesão corporal.' },
  { id: 'cp-155', titulo: 'Art. 155 CP - Furto', tema: 'Crimes contra o patrimônio', texto: 'Subtrair, para si ou para outrem, coisa alheia móvel: Pena – reclusão, de um a quatro anos, e multa.' },
  { id: 'cp-157', titulo: 'Art. 157 CP - Roubo', tema: 'Crimes contra o patrimônio', texto: 'Subtrair coisa móvel alheia, para si ou para outrem, mediante grave ameaça ou violência a pessoa, ou depois de havê-la, por qualquer meio, reduzido à impossibilidade de resistência: Pena – reclusão, de quatro a dez anos, e multa.' },
  { id: 'cp-168', titulo: 'Art. 168 CP - Apropriação indébita', tema: 'Crimes contra o patrimônio', texto: 'Apropriar-se de coisa alheia móvel, de que tem a posse ou a detenção: Pena – reclusão, de um a quatro anos, e multa.' },
  { id: 'cp-171', titulo: 'Art. 171 CP - Estelionato', tema: 'Crimes contra o patrimônio', texto: 'Obter, para si ou para outrem, vantagem ilícita, em prejuízo alheio, induzindo ou mantendo alguém em erro, mediante artifício, ardil, ou qualquer outro meio fraudulento: Pena – reclusão, de um a cinco anos, e multa.' },
  { id: 'cp-213', titulo: 'Art. 213 CP - Estupro', tema: 'Crimes contra a dignidade sexual', texto: 'Constranger alguém, mediante violência ou grave ameaça, a ter conjunção carnal ou a praticar ou permitir que com ele se pratique outro ato libidinoso: Pena – reclusão, de 6 (seis) a 10 (dez) anos.' },
  { id: 'cp-312', titulo: 'Art. 312 CP - Peculato', tema: 'Crimes contra a Administração Pública', texto: 'Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio: Pena – reclusão, de dois a doze anos, e multa.' },
]

export function getCodigoPenalResumoParaIA(maxChars = 6000, arts?: ArtigoPenal[]): string {
  const list = arts ?? ARTIGOS_PENAIS
  return list
    .map(a => `[${a.titulo}]\n${a.texto}`)
    .join('\n\n')
    .slice(0, maxChars)
}

const CP_PLANALTO_URL = 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm'

let cachedCpArticles: ArtigoPenal[] | null = null
let cpCacheTime = 0
const CP_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function stripHtmlCp(html: string): string {
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
    .replace(/\[\([^)]*\)\]/g, '') // remove links tipo [(Vide Lei...)]
    .trim()
}

function parseCpHtml(html: string): ArtigoPenal[] {
  const articles: ArtigoPenal[] = []
  const text = stripHtmlCp(html)
  const artBlocks = text.split(/(?=Art\.\s*\d+[ºª°]?)/i)
  for (const block of artBlocks) {
    const m = block.match(/Art\.\s*(\d+)[ºª°]?\s*[-–—]?\s*([\s\S]+?)(?=Art\.\s*\d+[ºª°]?|$)/i)
    if (m) {
      const num = m[1].trim()
      let corpo = (m[2] || '').trim()
      corpo = corpo.replace(/\s*\(\[Reda[^)]*\)\)/gi, '').replace(/\s*\(\[Inclu[^)]*\)\)/gi, '').trim()
      if (corpo.length > 20) {
        const id = `cp-${num}`
        const titulo = `Art. ${num} CP`
        articles.push({ id, titulo, texto: corpo.slice(0, 2000), tema: '' })
      }
    }
  }
  return articles.slice(0, 400)
}

/**
 * Busca o Código Penal completo no site do Planalto.
 * Fallback para ARTIGOS_PENAIS estático em caso de falha de rede.
 */
export async function fetchCodigoPenalPlanalto(): Promise<ArtigoPenal[]> {
  if (cachedCpArticles && Date.now() - cpCacheTime < CP_CACHE_TTL_MS) {
    return cachedCpArticles
  }
  try {
    const res = await fetch(CP_PLANALTO_URL, {
      headers: { Accept: 'text/html; charset=iso-8859-1' },
      next: { revalidate: 86400 },
    })
    const buf = await res.arrayBuffer()
    const decoder = new TextDecoder('iso-8859-1')
    const html = decoder.decode(buf)
    const parsed = parseCpHtml(html)
    if (parsed.length > 10) {
      cachedCpArticles = parsed
      cpCacheTime = Date.now()
      return cachedCpArticles
    }
  } catch (err) {
    console.warn('[codigo-penal] fetch planalto failed', err)
  }
  cachedCpArticles = ARTIGOS_PENAIS
  cpCacheTime = Date.now()
  return ARTIGOS_PENAIS
}
