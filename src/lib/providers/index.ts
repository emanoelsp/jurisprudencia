// Provider Pattern — wrappers finos para cada fonte de dados
// Cada provider expõe search(query, opts) → EprocResult[]
// O orchestrator (src/lib/orchestrator.ts) chama todos em paralelo.

export type { SourceResult } from '../ai/orchestrator'
export { multiSourceSearch, groupByTab } from '../ai/orchestrator'
