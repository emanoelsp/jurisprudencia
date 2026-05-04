/**
 * Camada 3 — Ingestão histórica LexML
 *
 * Estrutura para buscar e indexar versões históricas de leis no Pinecone.
 * Cada versão histórica recebe metadados temporais (dataVigencia, dataRevogacao)
 * e nunca expira do índice (leis históricas são imutáveis).
 *
 * ESTADO: estrutura implementada — requer curadoria manual das URNs e datas.
 * Veja docs/TASKS.md para roadmap de preenchimento.
 */

import { fetchLexMLByQuery, parseLexMLDate } from '@/lib/legal/lexml'
import { chunkText, generateEmbedding } from '@/lib/ai/rag'
import { upsertPinecone } from '@/lib/ai/pinecone'

export interface LexMLHistoricalOptions {
  /** URN LexML canônica da lei, ex: "urn:lex:br:federal:lei:2002-01-10;10406" */
  urn: string
  /** Data de início de vigência desta redação (YYYY-MM-DD) */
  dataVigencia: string
  /** Data de revogação ou emenda que encerra esta redação (YYYY-MM-DD).
   *  Omitir ou passar '9999-12-31' significa "ainda vigente". */
  dataRevogacao?: string
  /** Texto completo da redação histórica. Se omitido, tenta buscar via LexML SRU. */
  textoCompleto?: string
  /** Namespace Pinecone de destino (default: PINECONE_LEGISLACAO_NAMESPACE) */
  namespace?: string
  dryRun?: boolean
}

export interface LexMLHistoricalIngestResult {
  success: boolean
  urn: string
  dataVigencia: string
  dataRevogacao: string
  vectorsPrepared: number
  vectorsUpserted: number
  dryRun: boolean
  error?: string
}

/**
 * Busca o texto de uma lei via LexML SRU a partir da URN.
 * Retorna o texto concatenado das ementas encontradas ou string vazia.
 */
async function fetchTextoFromLexml(urn: string): Promise<string> {
  const queryText = urn.replace(/[:/;,]/g, ' ').replace(/\s+/g, ' ').trim()
  try {
    const docs = await fetchLexMLByQuery({ queryText, size: 3 })
    return docs.map(d => `${d.titulo}\n${d.ementa}`).join('\n\n')
  } catch {
    return ''
  }
}

/**
 * Indexa uma versão histórica de lei no Pinecone.
 *
 * O vector ID usa o padrão `lexml-hist:{urnSlug}:{dataVigencia}:{chunkIndex}`
 * para permitir múltiplas versões da mesma lei sem colisão.
 */
export async function ingestLexMLHistorical(
  options: LexMLHistoricalOptions
): Promise<LexMLHistoricalIngestResult> {
  const {
    urn,
    dataVigencia,
    dataRevogacao = '9999-12-31',
    dryRun = false,
  } = options

  const namespace =
    options.namespace ||
    process.env.PINECONE_LEGISLACAO_NAMESPACE?.trim() ||
    'legislacao'

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
    return {
      success: false, urn, dataVigencia, dataRevogacao,
      vectorsPrepared: 0, vectorsUpserted: 0, dryRun,
      error: 'Pinecone config missing.',
    }
  }

  if (!dataVigencia.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return {
      success: false, urn, dataVigencia, dataRevogacao,
      vectorsPrepared: 0, vectorsUpserted: 0, dryRun,
      error: 'dataVigencia must be YYYY-MM-DD.',
    }
  }

  let texto = options.textoCompleto || ''
  if (!texto) {
    texto = await fetchTextoFromLexml(urn)
  }
  if (!texto || texto.length < 30) {
    return {
      success: false, urn, dataVigencia, dataRevogacao,
      vectorsPrepared: 0, vectorsUpserted: 0, dryRun,
      error: 'Could not retrieve text for this URN from LexML.',
    }
  }

  const urnSlug = urn.replace(/[^a-z0-9]/gi, '-').slice(0, 60)
  const chunks = chunkText(texto, 1000, 200).slice(0, 10)
  const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i])
    vectors.push({
      id: `lexml-hist:${urnSlug}:${dataVigencia}:${i}`,
      values: embedding,
      metadata: {
        urn,
        numero: urn,
        ementa: chunks[i].slice(0, 1800),
        texto: chunks[i].slice(0, 1800),
        tribunal: 'LexML',
        relator: '',
        dataJulgamento: dataVigencia,
        fonte: 'lexml',
        dataVigencia,
        dataRevogacao,
        isHistoricalVersion: true,
        ingestedAt: new Date().toISOString(),
      },
    })
  }

  let vectorsUpserted = 0
  if (!dryRun && vectors.length > 0) {
    await upsertPinecone(vectors, namespace)
    vectorsUpserted = vectors.length
  }

  return {
    success: true, urn, dataVigencia, dataRevogacao,
    vectorsPrepared: vectors.length,
    vectorsUpserted,
    dryRun,
  }
}

/**
 * Parseia a data de vigência a partir do campo `data` retornado pelo LexML.
 * Re-exportado para uso em outros providers.
 */
export { parseLexMLDate }
