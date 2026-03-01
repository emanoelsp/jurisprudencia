#!/usr/bin/env node
/**
 * Cria o índice Pinecone com dimensão 3072 (gemini-embedding-001)
 * Namespaces: jurisprudencia_publica, legislação (CF, CP), cli-* (usuários)
 *
 * Uso: node scripts/create-pinecone-index.mjs
 * Ou:  PINECONE_API_KEY=xxx node scripts/create-pinecone-index.mjs
 *
 * Requer: PINECONE_API_KEY no .env.local ou ambiente
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Carrega .env.local se existir
function loadEnvLocal() {
  const paths = [resolve(root, '.env.local'), resolve(root, '.env')]
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8')
        content.split('\n').forEach((line) => {
          const match = line.match(/^([^#=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const val = match[2].trim().replace(/^["']|["']$/g, '')
            if (!process.env[key]) process.env[key] = val
          }
        })
        return
      } catch (e) {
        console.warn('Could not read', p, e.message)
      }
    }
  }
}

loadEnvLocal()

const apiKey = process.env.PINECONE_API_KEY
const indexName = process.env.PINECONE_INDEX || 'jurisprudencia'
const region = process.env.PINECONE_ENVIRONMENT || 'us-east-1'

const EMBEDDING_DIMENSION = 3072 // gemini-embedding-001

async function main() {
  if (!apiKey) {
    console.error('❌ PINECONE_API_KEY não definida. Configure em .env.local ou env.')
    process.exit(1)
  }

  const pc = new Pinecone({ apiKey })

  try {
    const existing = await pc.listIndexes()
    const names = existing.indexes?.map((i) => i.name) || []
    let targetName = indexName

    if (names.includes(indexName)) {
      const info = await pc.describeIndex(indexName)
      if (Number(info.dimension) === EMBEDDING_DIMENSION) {
        console.log(`✅ Índice "${indexName}" já existe com dimensão correta (${EMBEDDING_DIMENSION}).`)
        return
      }
      targetName = `${indexName}-3072`
      if (names.includes(targetName)) {
        console.log(`✅ Índice "${targetName}" já existe.`)
        const info2 = await pc.describeIndex(targetName)
        console.log('   Dimension:', info2.dimension)
        return
      }
      console.log(
        `⚠️  Índice "${indexName}" tem dimensão ${info.dimension}. Criando novo "${targetName}" com ${EMBEDDING_DIMENSION}.`
      )
    }

    console.log(`📦 Criando índice "${targetName}" com dimensão ${EMBEDDING_DIMENSION}...`)
    await pc.createIndex({
      name: targetName,
      dimension: EMBEDDING_DIMENSION,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: region,
        },
      },
      deletionProtection: 'disabled',
    })
    console.log(`✅ Índice "${targetName}" criado com sucesso.`)
    console.log('   Dimensão:', EMBEDDING_DIMENSION, '(gemini-embedding-001)')
    console.log('   Metric: cosine')
    console.log('   Region:', region)
    console.log('')
    if (targetName !== indexName) {
      console.log('   ⚠️  Atualize .env.local:')
      console.log(`   PINECONE_INDEX=${targetName}`)
      console.log('   O host será algo como: https://' + targetName + '-xxx.svc.' + region + '.pinecone.io')
      console.log('   (Copie o host completo do Pinecone Console após o índice ficar Ready)')
      console.log('')
    }
    console.log('   Namespaces usados pela aplicação:')
    console.log('   - legislacao (CF/88, Código Penal)')
    console.log('   - jurisprudencia_publica (DataJud ingerido)')
    console.log('   - cli-<userId> (histórico de pareceres do usuário)')
  } catch (err) {
    console.error('❌ Erro ao criar índice:', err.message)
    if (err.body) console.error(err.body)
    process.exit(1)
  }
}

main()
