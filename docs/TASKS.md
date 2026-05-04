# Tasks — IurisPrudentIA

## Concluído

- [x] Autenticação Firebase (e-mail/senha + Google OAuth)
- [x] Upload e extração de PDF (`pdf-parse` + `/api/ingest`)
- [x] Extração de metadados via LLM + fallback regex CNJ
- [x] Chunking de texto (1000 chars, 200 overlap)
- [x] Embeddings com `gemini-embedding-001`
- [x] Indexação no Pinecone (namespace público + privado por usuário)
- [x] Seed automático CF/88 e Código Penal (`instrumentation.ts` + `/api/setup`)
- [x] Integração DataJud CNJ (busca keyword em todos os tribunais)
- [x] Integração LexML (legislação federal/estadual/municipal)
- [x] Integração STJ CKAN (endpoint de ingestão pronto)
- [x] Busca híbrida com RRF (DataJud + Pinecone + LexML)
- [x] Reranking Cohere rerank-v3.5 + fallback lexical local
- [x] Camada TOON de anti-alucinação (hash SHA-256 + XML imutável)
- [x] Pipeline de análise completo com streaming SSE (`/api/analyze`)
- [x] Saída estruturada obrigatória (schema JSON validado por guards)
- [x] Cálculo de grau de confiança (retrieval + coverage + generation_risk)
- [x] `ConfidenceBadge` (alta/media/baixa)
- [x] `EprocResultCard` com fonte e badge de confiança
- [x] Dashboard: listagem e criação de processos
- [x] Dashboard: interface de análise com SSE (`/dashboard/analisar/[id]`)
- [x] Dashboard: base de conhecimento (pareceres salvos)
- [x] Dashboard: upgrade de plano
- [x] Planos e limites de uso (Free, Starter, Pro, Escritório, Enterprise)
- [x] Cobrança via Mercado Pago (checkout + webhook + provisioning)
- [x] Multi-tenancy Pinecone (namespace `cli-{userId}`)
- [x] Testes de regressão das guards (`tests/regression-guards.test.js`)
- [x] Avaliação gold set (`scripts/evaluate-gold.mjs`)
- [x] LLM fallback chain (Gemini → Groq → OpenRouter)
- [x] Regras de segurança Firestore e Firebase Storage
- [x] Editor rich text TipTap (`LegalEditor`) com toolbar, exportação PDF e API ref-based
- [x] Sanitização PII LGPD (`sanitizePii`) — CPF, CNPJ, telefone, email, CEP sem tocar números CNJ
- [x] Observabilidade LLM — Langfuse REST (fire-and-forget, scores por trace em `/api/analyze`)
- [x] Cache L2 Redis/Upstash para embeddings — TTL 24h, HTTP REST sem SDK, fallback in-memory
- [x] Vercel Cron STJ — `GET /api/cron/stj-ingest` toda segunda-feira 04:00 UTC (`vercel.json`)
- [x] Painel Admin — `/dashboard/admin` com trigger manual STJ, links Langfuse/Upstash
- [x] **Busca semântica na base de conhecimento** — toggle IA + filtro de tribunal + `POST /api/base-conhecimento/search` (Pinecone `cli-{userId}`)
- [x] **Exportação da base de conhecimento** — botão Exportar → HTML bundle via `GET /api/base-conhecimento/export`
- [x] **Testes unitários (Node.js test runner + strip-types)** — `pii.ts`, `toon.ts`, `plans.ts` (39 testes, `npm run test:unit`)
- [x] **Langfuse avançado** — generation spans por LLM call em `extract` e `justification-{id}` com latência e tamanho de output
- [x] **UI do modo expandido** — modal de confirmação antes de `expandScope=true` com aviso de custo e tempo
- [x] **Histórico de versões do parecer** — `processos/{id}/versoes` (Firestore subcollection), painel lateral com últimas 10 versões

- [x] **Versionamento temporal de leis (Camadas 1–3)**
  - Camada 1: `dataVigencia` + `dataRevogacao` no metadata do Pinecone para CF/88, CP e LexML (`run-legislacao-ingest.ts`, `rag.ts`)
  - Camada 2: Badge "Redação na data do fato / Redação vigente / Revogada" em `EprocResultCard`; `dataProtocolo` propagado do processo até o search
  - Camada 3: `src/lib/providers/lexml-historical.ts` + endpoint `POST /api/admin/lexml-historical-ingest` — estrutura para ingestão histórica pronta; requer curadoria manual das URNs/datas

---

## Goals por semana

### Semana atual (2026-05-04 →)
- [x] **Provider Pattern** — `src/lib/providers/` com orchestrator + tab-config
- [x] **`multiSourceSearch()` + `groupByTab()`** — orquestrador em `src/lib/orchestrator.ts`
- [x] **LLM em paralelo** — `Promise.allSettled` com concorrência 3 nos `justification-{id}` em `analyze/route.ts`

### Semana 2 (2026-05-04 → concluído)
- [x] **Abas dinâmicas por `natureza`** — `src/lib/providers/tab-config.ts`; CP reordenado para processos criminais
- [x] **Análise em lote** — `POST /api/analyze/batch` + UI com checkboxes em processos (Pro+, batchSize por plano)
- [x] **Log de auditoria** — `src/lib/audit.ts` + `GET /api/admin/audit-log` + painel admin (Escritório+)
- [x] **Restaurar versão de parecer** — botão "Restaurar esta versão" no histórico carrega HTML no editor
- [x] **Curadoria Camada 3** — mapear 10 leis frequentes (CP, CF/88 emendas, CDC, CLT) com URNs e datas históricas; ingerir via `/api/admin/lexml-batch-ingest`

### Fase 3 (2026-05-04 → concluído)
- [x] **Templates personalizados** — `GET/POST/DELETE /api/templates` + `/dashboard/templates` + seletor no analisar + 4 modelos prontos para importar (Pro+)
- [x] **Dashboard do escritório** — `/dashboard/escritorio` + `GET /api/escritorio/stats`: KPIs, uso diário, membros por escritorio, atividade recente (Escritório+)
- [x] **Alertas de quota / Saúde das APIs** — `GET /api/admin/health`: verifica todas as env vars críticas, painel com status por serviço no admin
- [x] **Testes E2E (Playwright)** — `tests/e2e/fixtures.ts` com helper `loginAs` + fixture `loggedInPage`; cobertura: auth, dashboard, processos, planos, templates, perfil, base de conhecimento

### Backlog — Sprint atual (2026-05-04 →)
- [ ] **#1 Compartilhamento de pareceres** — link público com expiração (7 dias), sem login, só leitura. `POST /api/shares` + `GET /api/shares/[token]` + `/share/[token]` + botão no analisar.
- [ ] **#2 Notificação ao terminar análise em lote** — toast em tempo real via Firestore listener + e-mail opcional (Resend) quando batch termina (Pro+).
- [ ] **#3 Filtros avançados nos processos** — filtrar por tribunal, natureza, data de protocolo e status da análise na página de processos.
- [ ] **#4 Landing page atualizada** — screenshots reais, CTAs atualizados (templates, batch, escritório), copy revisado.
- [ ] **#5 Exportar parecer para Word (.docx)** — via `docx` npm + botão no LegalEditor ao lado do PDF.

### Backlog (sem prazo)
- [x] **Curadoria Camada 3** — `src/lib/lexml-curacao.ts` com 10 leis (CP, CF/88, CDC, CLT, CC, CPC, CPP, LIA, Maria da Penha, ECA). Batch ingest via `POST /api/admin/lexml-batch-ingest` + botão no painel admin.
- [x] **Testes unitários — rag.ts** — `chunkText`, `fuseWithRRF`, `scoreToBadge`, `dedupeEprocResults` em `tests/unit-rag.test.js` (22 testes). Funções puras extraídas para `src/lib/rag-pure.ts`. Total: 61 testes unitários.
- [x] **STF provider offline** — `src/lib/providers/stf-provider.ts` (DataJud CNJ) + `POST /api/admin/stf-ingest` + `GET /api/cron/stf-ingest` (cron seg 05:00 UTC) + seção no painel admin.

---

## Scripts úteis

```bash
npm run test:regression    # testes de regressão das guards
npm run test:unit          # testes unitários (pii, toon, plans) — 39 testes
npm run test:gold          # avaliação do gold set RAG
npm run pinecone:create-index  # criar índice Pinecone (setup inicial)
npm run release:check      # regressão + gold + build (rodar antes de deploy)
```
