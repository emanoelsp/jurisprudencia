// src/types/index.ts

export interface Processo {
  id: string
  numero: string          // CNJ format: NNNNNNN-DD.AAAA.J.TT.OOOO
  cliente: string
  natureza: string
  vara?: string
  tribunal?: string
  dataProtocolo?: string
  textoOriginal: string   // full extracted text
  teseFinal?: string      // final legal brief
  scoreIa?: number        // 0-100 AI confidence
  aprovadoPeloAdvogado: boolean
  status: 'pending' | 'processing' | 'analyzed' | 'approved' | 'error'
  userId: string
  createdAt: string
  updatedAt: string
  storageUrl?: string     // Firebase Storage URL of original PDF
  storagePath?: string    // Firebase Storage path for signed downloads
  chunks?: string[]       // text chunks for RAG
}

export interface JurisprudenciaCriada {
  id: string
  processoId: string
  processoIds?: string[]
  titulo: string
  ementa: string
  tese: string
  tribunal: string
  numero: string          // process number from eproc - NEVER hallucinated (TOON)
  dataJulgamento?: string
  relator?: string
  justificativaIa: string // why this is relevant
  confianca: number       // 0-100 reranker score
  toonData: ToonPayload   // TOON structured data - anti-hallucination anchor
  edicaoManual?: string   // lawyer's manual edits
  aprovado: boolean
  userId: string
  createdAt: string
  updatedAt?: string
  usageCount?: number
}

export interface EprocResult {
  id: string
  numero: string
  ementa: string
  tribunal: string
  relator: string
  dataJulgamento: string
  score: number           // vector similarity
  rerankScore?: number    // cohere reranker score
  badge: ConfidenceBadge
  toonData?: ToonPayload
  fonte?: 'datajud_cnj' | 'base_interna' | 'mock'
  alreadyUsed?: boolean
  usageCount?: number
}

// TOON = Typed Object-Oriented Notation
// Structured container that anchors factual data between Reranker and LLM
// Prevents hallucination of names and numbers
export interface ToonPayload {
  _type: 'ToonJurisprudencia'
  _version: '1.0'
  numeroProcesso: string     // EXACT - never modify
  tribunal: string           // EXACT
  relator: string            // EXACT  
  dataJulgamento: string     // EXACT ISO date
  ementaHash: string         // SHA-256 of original ementa for integrity check
  ementaOriginal: string     // verbatim from eproc
  classeProcessual: string
  orgaoJulgador: string
  tags: string[]
}

export type ConfidenceBadge = 'alta' | 'media' | 'baixa'

export interface AnalysisChunk {
  type: 'metadata' | 'result' | 'results' | 'justification' | 'complete' | 'error'
  data?: Partial<EprocResult> | {
    retrieval_confidence?: number
    evidence_coverage?: number
    generation_risk?: number
    cf_articles?: Array<{ id: string; titulo: string; texto: string; aplicabilidade?: string }>
    bases_publicas?: Array<{ id: string; tipo: string; fonte: string; ementa: string; aplicabilidade?: string }>
    codigo_penal?: Array<{ id: string; tipo: string; fonte: string; ementa: string; aplicabilidade?: string }>
    gemini_quota_exceeded?: boolean
  }
  results?: EprocResult[]
  usedPareceres?: JurisprudenciaCriada[]
  text?: string
  processoId?: string
  error?: string
}

export interface User {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  plano: 'free' | 'plano1' | 'plano2' | 'escritorio' | 'start' | 'trial'
  planoStatus?: 'trialing' | 'active' | 'past_due' | 'canceled'
  trialEndsAt?: string
  usageCounters?: Record<string, { processesCreated: number }>
  mercadopagoCustomerId?: string
  escritorio?: string
  createdAt: string
}

export interface FormularioProcesso {
  numero: string
  cliente: string
  natureza: string
  vara: string
  tribunal: string
  dataProtocolo: string
}
