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
  { id: 'cp-2', titulo: 'Art. 2º CP - Lei penal no tempo', tema: 'Princípios', texto: 'Ninguém pode ser punido por fato que lei posterior deixa de considerar crime, cessando em virtude dela a execução e os efeitos penais da sentença condenatória.' },
  { id: 'cp-20', titulo: 'Art. 20 CP - Erro sobre elementos do tipo', tema: 'Teoria do crime', texto: 'O erro sobre elemento constitutivo do tipo legal de crime exclui o dolo, mas permite a punição por crime culposo, se previsto em lei.' },
  { id: 'cp-21', titulo: 'Art. 21 CP - Erro sobre a ilicitude do fato', tema: 'Teoria do crime', texto: 'O desconhecimento da lei é inescusável. O erro sobre a ilicitude do fato, se inevitável, isenta de pena; se evitável, poderá diminuí-la de um sexto a um terço.' },
  { id: 'cp-25', titulo: 'Art. 25 CP - Legítima defesa', tema: 'Teoria do crime', texto: 'Entende-se em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem.' },
  { id: 'cp-26', titulo: 'Art. 26 CP - Inimputabilidade', tema: 'Imputabilidade', texto: 'É isento de pena o agente que, por doença mental ou desenvolvimento mental incompleto ou retardado, era, ao tempo da ação ou da omissão, inteiramente incapaz de entender o caráter ilícito do fato ou de determinar-se de acordo com esse entendimento.' },
  { id: 'cp-29', titulo: 'Art. 29 CP - Concurso de pessoas', tema: 'Concurso de agentes', texto: 'Quem, de qualquer modo, concorre para o crime incide nas penas a este cominadas, na medida de sua culpabilidade.' },
  { id: 'cp-33', titulo: 'Art. 33 CP - Regime de cumprimento de pena', tema: 'Penas', texto: 'A pena de reclusão deve ser cumprida em regime fechado, semi-aberto ou aberto. A de detenção, em regime semi-aberto, ou aberto, salvo necessidade de transferência a regime fechado.' },
  { id: 'cp-44', titulo: 'Art. 44 CP - Penas restritivas de direitos', tema: 'Penas', texto: 'As penas restritivas de direitos são autônomas e substituem as privativas de liberdade, quando: I - aplicada pena privativa de liberdade não superior a quatro anos e o crime não for cometido com violência ou grave ameaça à pessoa [...]' },
  { id: 'cp-59', titulo: 'Art. 59 CP - Fixação da pena', tema: 'Penas', texto: 'O juiz, atendendo à culpabilidade, aos antecedentes, à conduta social, à personalidade do agente, aos motivos, às circunstâncias e consequências do crime, bem como ao comportamento da vítima, estabelecerá, conforme seja necessário e suficiente para reprovação e prevenção do crime [...]' },
  { id: 'cp-69', titulo: 'Art. 69 CP - Concurso material', tema: 'Concurso de crimes', texto: 'Quando o agente, mediante mais de uma ação ou omissão, pratica dois ou mais crimes, idênticos ou não, aplicam-se cumulativamente as penas privativas de liberdade em que haja incorrido.' },
  { id: 'cp-70', titulo: 'Art. 70 CP - Concurso formal', tema: 'Concurso de crimes', texto: 'Quando o agente, mediante uma só ação ou omissão, pratica dois ou mais crimes, idênticos ou não, aplica-se-lhe a mais grave das penas cabíveis ou, se iguais, somente uma delas, mas aumentada, em qualquer caso, de um sexto até metade.' },
  { id: 'cp-71', titulo: 'Art. 71 CP - Crime continuado', tema: 'Concurso de crimes', texto: 'Quando o agente, mediante mais de uma ação ou omissão, pratica dois ou mais crimes da mesma espécie e, pelas condições de tempo, lugar, maneira de execução e outras semelhantes, devem os subsequentes ser havidos como continuação do primeiro, aplica-se-lhe a pena de um só dos crimes, se idênticas, ou a mais grave, se diversas, aumentada, em qualquer caso, de um sexto a dois terços.' },
  { id: 'cp-107', titulo: 'Art. 107 CP - Extinção da punibilidade', tema: 'Punibilidade', texto: 'Extingue-se a punibilidade: I - pela morte do agente; II - pela anistia, graça ou indulto; III - pela retroatividade de lei que não mais considera o fato como criminoso; IV - pela prescrição, decadência ou perempção [...]' },
  { id: 'cp-109', titulo: 'Art. 109 CP - Prescrição', tema: 'Punibilidade', texto: 'A prescrição, antes de transitar em julgado a sentença final, salvo o disposto no § 1º do art. 110 deste Código, regula-se pelo máximo da pena privativa de liberdade cominada ao crime [...]' },
  { id: 'cp-147', titulo: 'Art. 147 CP - Ameaça', tema: 'Crimes contra a liberdade pessoal', texto: 'Ameaçar alguém, por palavra, escrito ou gesto, ou qualquer outro meio simbólico, de causar-lhe mal injusto e grave: Pena – detenção, de um a seis meses, ou multa.' },
  { id: 'cp-148', titulo: 'Art. 148 CP - Sequestro e cárcere privado', tema: 'Crimes contra a liberdade pessoal', texto: 'Privar alguém de sua liberdade, mediante sequestro ou cárcere privado: Pena – reclusão, de um a três anos.' },
  { id: 'cp-158', titulo: 'Art. 158 CP - Extorsão', tema: 'Crimes contra o patrimônio', texto: 'Constranger alguém, mediante violência ou grave ameaça, e com o intuito de obter para si ou para outrem indevida vantagem econômica, a fazer, tolerar que se faça ou deixar de fazer alguma coisa: Pena – reclusão, de quatro a dez anos, e multa.' },
  { id: 'cp-180', titulo: 'Art. 180 CP - Receptação', tema: 'Crimes contra o patrimônio', texto: 'Adquirir, receber, transportar, conduzir ou ocultar, em proveito próprio ou alheio, coisa que sabe ser produto de crime, ou influir para que terceiro, de boa-fé, a adquira, receba ou oculte: Pena – reclusão, de um a quatro anos, e multa.' },
  { id: 'cp-217-A', titulo: 'Art. 217-A CP - Estupro de vulnerável', tema: 'Crimes contra a dignidade sexual', texto: 'Ter conjunção carnal ou praticar outro ato libidinoso com menor de 14 (catorze) anos: Pena – reclusão, de 8 (oito) a 15 (quinze) anos.' },
  { id: 'cp-250', titulo: 'Art. 250 CP - Incêndio', tema: 'Crimes contra a incolumidade pública', texto: 'Causar incêndio, expondo a perigo a vida, a integridade física ou o patrimônio de outrem: Pena – reclusão, de três a seis anos, e multa.' },
  { id: 'cp-288', titulo: 'Art. 288 CP - Associação criminosa', tema: 'Crimes contra a paz pública', texto: 'Associarem-se 3 (três) ou mais pessoas, para o fim específico de cometer crimes: Pena – reclusão, de 1 (um) a 3 (três) anos.' },
  { id: 'cp-297', titulo: 'Art. 297 CP - Falsificação de documento público', tema: 'Crimes contra a fé pública', texto: 'Falsificar, no todo ou em parte, documento público, ou alterar documento público verdadeiro: Pena – reclusão, de dois a seis anos, e multa.' },
  { id: 'cp-317', titulo: 'Art. 317 CP - Corrupção passiva', tema: 'Crimes contra a Administração Pública', texto: 'Solicitar ou receber, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida, ou aceitar promessa de tal vantagem: Pena – reclusão, de 2 (dois) a 12 (doze) anos, e multa.' },
  { id: 'cp-329', titulo: 'Art. 329 CP - Resistência', tema: 'Crimes contra a Administração Pública', texto: 'Opor-se à execução de ato legal, mediante violência ou ameaça a funcionário competente para executá-lo ou a quem lhe esteja prestando auxílio: Pena – detenção, de dois meses a dois anos.' },
  { id: 'cp-330', titulo: 'Art. 330 CP - Desobediência', tema: 'Crimes contra a Administração Pública', texto: 'Desobedecer a ordem legal de funcionário público: Pena – detenção, de quinze dias a seis meses, e multa.' },
  { id: 'cp-331', titulo: 'Art. 331 CP - Desacato', tema: 'Crimes contra a Administração Pública', texto: 'Desacatar funcionário público no exercício da função ou em razão dela: Pena – detenção, de seis meses a dois anos, ou multa.' },
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
