# Arquitetura — IurisPrudentIA

## Stack principal

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 14.x |
| Linguagem | TypeScript (strict) | 5.x |
| Estilo | Tailwind CSS + shadcn/ui | 3.4 / latest |
| Autenticação | Firebase Auth (email + Google) | 10.x |
| Banco de dados | Firestore (NoSQL) | Admin 12.x |
| Armazenamento de arquivos | Firebase Storage | 10.x |
| Banco vetorial | Pinecone | 7.x |
| LLM primário | Gemini 2.5 Flash (`@google/genai`) | 1.x |
| LLM fallback | Groq llama-3.1-8b + OpenRouter | — |
| Reranking | Cohere rerank-v3.5 | — |
| Embedding | `gemini-embedding-001` | — |
| Extração de PDF | `pdf-parse` | 1.1 |
| Pagamentos | Mercado Pago | — |
| Deploy | Vercel | — |

---

## Estrutura de pastas (real)

```
/src
  /app
    /api
      /analyze          ← pipeline RAG + LLM (streaming SSE, ~897 linhas)
      /ingest           ← upload PDF + extração de texto
      /processes        ← CRUD processos
      /jurisprudencia   ← busca base de conhecimento
      /billing          ← checkout, webhook, registro Mercado Pago
      /setup            ← seed legislação (CF/88 + CP)
      /admin            ← DataJud, legislação, STJ CKAN ingest
    /dashboard
      /processos        ← listagem e criação de processos
      /analisar/[id]    ← interface de análise (~1095 linhas)
      /planos           ← upgrade de plano
      /base-conhecimento← pareceres salvos
    layout.tsx
    page.tsx            ← landing + login/signup
  /components
    /ui                 ← shadcn/ui + Logo, ConfidenceBadge, Skeleton
    /features           ← EprocResultCard
  /lib
    rag.ts              ← pipeline completo: extração → chunking → busca → rerank → TOON
    ai.ts               ← cliente LLM com fallback chain (Gemini → Groq → OpenRouter)
    agent.ts            ← wrapper jurídico sobre o LLM
    pinecone.ts         ← upsert / query com suporte a namespaces
    datajud.ts          ← integração API DataJud CNJ
    firebase.ts         ← Firebase client SDK
    firebase-admin.ts   ← Firebase Admin (server-side)
    server-auth.ts      ← verificação bearer token
    tenant.ts           ← mapeamento userId → namespace Pinecone (cli-{userId})
    plans.ts            ← políticas de plano, limites, billing
    toon.ts             ← camada anti-alucinação (TOON)
    lexml.ts            ← API LexML (legislação)
    cf-planalto.ts      ← scraper CF/88 + cache 24h
    codigo-penal.ts     ← dados do Código Penal
    stj-dados-abertos.ts← integração STJ CKAN
    guards.js           ← validação de escopo jurídico + schemas
    /prompts
      bases-publicas.ts ← engenharia de prompt (formato TOON ⟨BP⟩)
    /tools
      extract-causa-petendi.ts
      search-public-bases.ts
      verify-precedent.ts
    /providers               ← Camada 3: providers de fontes externas
      lexml-historical.ts    ← ingestão histórica LexML com metadados temporais
  /types
    index.ts            ← tipos centrais (Processo, EprocResult, ToonPayload, User...)
/tests
  regression-guards.test.js ← testes de regressão das guards
/scripts
  create-pinecone-index.mjs
  evaluate-gold.mjs
firestore.rules         ← regras de segurança Firestore
firestore.indexes.json  ← índices compostos
storage.rules           ← ACLs Firebase Storage
instrumentation.ts      ← seed automático de legislação no boot (dev only)
```

---

## Módulos críticos

### Pipeline RAG (`src/lib/rag.ts`)

1. `extractTextFromBuffer()` — extração de PDF via pdf-parse
2. `extractMetadata()` — metadados via LLM + regex CNJ como fallback
3. `chunkText()` — janela deslizante: 1000 chars, 200 overlap
4. `generateEmbedding()` — gemini-embedding-001, cache 30min TTL
5. `searchHybrid()` — RRF: DataJud (keyword) + Pinecone (vetorial) + LexML opcional
6. `rerankResults()` — Cohere rerank-v3.5; fallback lexical local
7. `enrichWithToon()` — adiciona ToonPayload com hash SHA-256 da ementa
8. `dedupeEprocResults()` — deduplicação por número de processo + ementa

**Fórmula RRF**: `score(d) = Σ 1/(60 + rank(d))`, normalizado para [0, 1]

**Caches internos**:
- Embeddings: 30min TTL, max 200 itens
- Resultados de busca: 10min TTL
- Rerank: 5min TTL

### Camada TOON (`src/lib/toon.ts`)

**Propósito**: Âncora factual para o LLM. Números CNJ, relatores, datas e ementas são marcados como `<IMMUTABLE_FACTS>` no prompt. O LLM não pode reparafrasear ou gerar esses campos.

- `createToonPayload()` — wrap de `EprocResult` com hash SHA-256 da ementa
- `serializeToonForPrompt()` — serialização XML com tags IMMUTABLE
- `validateToonIntegrity()` — confere números CNJ na saída do LLM contra payloads conhecidos
- `validateJustificationCitations()` — verifica consistência tribunal/relator/data no JSON de saída

### Cliente LLM (`src/lib/ai.ts`)

**Fallback chain**:
1. Gemini 2.5 Flash (`AI_CHAT_MODEL=gemini-2.5-flash`) — primário
2. Groq `llama-3.1-8b-instant` — fallback 429/503
3. OpenRouter `llama-3.1-8b-instruct:free` — fallback final

**Config padrão**: temperatura 0.1, top_p 0.6, max_tokens 2048 (determinístico para reduzir alucinações)

**Retry**: 429 → aguarda 4s e tenta novamente; timeout/503 → próximo provider

### Multi-tenancy (`src/lib/tenant.ts`)

Namespace Pinecone por usuário: `cli-{sanitized-userId}`
Garante que a base de conhecimento privada de cada advogado seja completamente isolada.

---

## Tipos centrais (`src/types/index.ts`)

```typescript
Processo              // caso jurídico armazenado no Firestore
JurisprudenciaCriada  // parecer criado e aprovado pelo advogado
EprocResult           // resultado de busca com score e TOON
ToonPayload           // âncora de integridade anti-alucinação
AnalysisChunk         // evento SSE do pipeline de análise
User                  // perfil com plano e contadores de uso
```

---

## Segurança

- Todas as rotas de API exigem bearer token Firebase (`server-auth.ts`)
- Acesso a processos e base de conhecimento é verificado por `userId` — sem acesso cruzado
- Regras do Firestore aplicam isolamento por `userId` no banco
- Namespaces Pinecone isolam embeddings por usuário
- Segredos nunca são commitados — apenas `.env.local` (ignorado pelo git)
- TOON valida hashes de ementas para detectar dados fabricados pelo LLM

---

## Versionamento temporal de legislação

`EprocResult` carrega dois campos opcionais para todos os resultados de legislação:

| Campo | Tipo | Semântica |
|-------|------|-----------|
| `dataVigencia` | `string \| undefined` | `YYYY-MM-DD` — início de vigência desta redação |
| `dataRevogacao` | `string \| undefined` | `YYYY-MM-DD` ou `'9999-12-31'` — vigente se `'9999-12-31'` |
| `isHistoricalVersion` | `boolean` | `true` quando indexado via Camada 3 |

**Fluxo**: `processo.dataProtocolo` → payload `POST /api/analyze` → `searchEproc(options.dataFato)` → `filterByDataFato()` em `rag.ts` → badge na UI via `EprocResultCard.dataFato`.

Vetores de CF/88 e CP já indexados com `dataVigencia`/`dataRevogacao`. Vetores antigos (sem esses campos) passam sempre pelo filtro por retrocompatibilidade.

---

## Regras técnicas

- Preferir Server Components; usar Client Components apenas onde necessário (streaming, interatividade)
- Toda validação de entrada/saída do LLM via `guards.js` (schemas Zod-equivalent)
- Nunca acessar Firestore diretamente em componentes — usar rotas de API ou services
- Centralizar configuração Firebase em `src/lib/firebase.ts` (client) e `firebase-admin.ts` (server)
- Não adicionar dependências sem necessidade — verificar se `pdf-parse`, `@google/genai` ou funções existentes já resolvem
- Qualquer nova tool do agente deve ter schema de validação de entrada e saída em `src/lib/tools/`
- Versionar prompts importantes em `src/lib/prompts/`
