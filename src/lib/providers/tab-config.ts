// Dynamic tab ordering based on processo natureza

export type TabId = 'resultados' | 'tribunais' | 'bases_publicas' | 'codigo_penal' | 'constitucional' | 'pareceres'

export interface TabDef {
  id: TabId
  label: string
  /** If true, this tab is always shown regardless of natureza */
  always?: boolean
}

const ALL_TABS: TabDef[] = [
  { id: 'resultados',     label: 'Resultados',            always: true },
  { id: 'tribunais',      label: 'Tribunais',             always: true },
  { id: 'bases_publicas', label: 'Bases',                 always: true },
  { id: 'codigo_penal',   label: 'Código Penal',          always: false },
  { id: 'constitucional', label: 'Constituição Federal',  always: false },
  { id: 'pareceres',      label: 'Pareceres',             always: true },
]

function isCriminal(natureza: string): boolean {
  const n = natureza.toLowerCase()
  return (
    n.includes('penal') || n.includes('crimin') || n.includes('homicid') ||
    n.includes('furto') || n.includes('roubo') || n.includes('trafico') ||
    n.includes('lesao') || n.includes('estelion') || n.includes('delito') ||
    n.includes('inquerito') || n.includes('denuncia') || n.includes('juri') ||
    n.includes('execucao penal') || n.includes('habeas corpus')
  )
}

function isConstitucional(natureza: string): boolean {
  const n = natureza.toLowerCase()
  return (
    n.includes('constitucional') || n.includes('mandado de seguranca') ||
    n.includes('acao popular') || n.includes('acao civil publica') ||
    n.includes('ms') || n.includes('adi') || n.includes('ação direta')
  )
}

/**
 * Returns the tabs to display, ordered by relevance for the given natureza.
 * Criminal processes → Código Penal appears second (after Resultados/Tribunais).
 * Constitutional/public law → Constituição Federal appears second.
 * Default → all tabs in standard order.
 */
export function getTabsForNatureza(natureza: string | undefined): TabDef[] {
  const n = natureza?.trim() || ''
  const base = ALL_TABS.filter(t => t.always)

  if (!n) return ALL_TABS

  const criminal = isCriminal(n)
  const constitucional = isConstitucional(n)

  const result: TabDef[] = [
    ALL_TABS[0], // resultados
    ALL_TABS[1], // tribunais
    ALL_TABS[2], // bases
  ]

  if (criminal) {
    result.push(ALL_TABS[3]) // codigo_penal first for criminal
    result.push(ALL_TABS[4]) // constitucional
  } else if (constitucional) {
    result.push(ALL_TABS[4]) // constitucional first for constitutional
    result.push(ALL_TABS[3]) // codigo_penal
  } else {
    result.push(ALL_TABS[3]) // codigo_penal
    result.push(ALL_TABS[4]) // constitucional
  }

  result.push(ALL_TABS[5]) // pareceres always last
  return result
}
