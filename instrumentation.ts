// Next.js Instrumentation - executa no startup do servidor
// Faz seed automático de CF/88 e Código Penal no primeiro run

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const fs = await import('fs')
    const path = await import('path')
    const flagPath = path.join(process.cwd(), '.legislacao-seeded')

    const isSeeded = () => {
      try {
        return fs.existsSync(flagPath)
      } catch {
        return false
      }
    }

    const markSeeded = () => {
      try {
        fs.writeFileSync(flagPath, new Date().toISOString(), 'utf-8')
      } catch {
        // ignore
      }
    }

    if (!isSeeded() && process.env.PINECONE_API_KEY && process.env.PINECONE_HOST && process.env.GEMINI_API_KEY) {
      // Executa seed em background (não bloqueia startup)
      setImmediate(async () => {
        try {
          const { runLegislacaoIngest } = await import('./src/lib/run-legislacao-ingest')
          const result = await runLegislacaoIngest({ dryRun: false, fonte: 'ambos' })
          if (result.success) {
            markSeeded()
            console.log('[instrumentation] CF/88 e Código Penal inseridos no RAG:', result.vectorsUpserted, 'vetores')
          } else {
            console.warn('[instrumentation] seed legislação falhou:', result.error)
          }
        } catch (err) {
          console.warn('[instrumentation] seed legislação error:', err)
        }
      })
    }
  }
}
