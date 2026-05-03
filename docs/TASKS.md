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
- [ ] **Provider Pattern** — `src/lib/providers/` com wrappers finos em volta dos libs existentes (`datajud`, `lexml`, `pinecone-public`, `pinecone-user`, `stj`, `cf88`, `codigo-penal`)
- [ ] **`multiSourceSearch()` + `groupByTab()`** — orquestrador em `src/lib/orchestrator.ts`; substitui o `searchHybrid` como entry point do `/api/analyze`
- [ ] **LLM em paralelo** — `Promise.allSettled` com concorrência 3 nos `justification-{id}` em `analyze/route.ts`

### Semana 2 (2026-05-11 →)
- [ ] **Abas dinâmicas por `natureza`** — `src/lib/providers/tab-config.ts`; aba CP para processos criminais, CLT para trabalhistas
- [ ] **Curadoria Camada 3** — mapear 10 leis frequentes (CP, CF/88 emendas principais, CDC, CLT) com URNs e datas de vigência históricas; ingerir via `/api/admin/lexml-historical-ingest`

### Semana 3 (2026-05-18 →)
- [ ] **Testes E2E (Playwright)** — upload PDF → análise completa → inserir no editor → salvar parecer (alta prioridade: cada deploy é um risco sem cobertura)

### Backlog (sem prazo)
- [ ] **Testes unitários — rag.ts**: `chunkText`, RRF, `calculateEvidenceCoverage` (requer mock de Pinecone/Cohere)
- [ ] **Dashboard do escritório**: plano Escritório precisa de visão agregada de uso por membro
- [ ] **Alertas de quota**: notificar quando Gemini/Cohere estiver próximo do limite (painel admin)
- [ ] **Restaurar versão de parecer**: botão "Restaurar" que carrega HTML da versão no editor
- [ ] **STF provider offline**: ingestão via cron, mesmo padrão do STJ CKAN

---

## Scripts úteis

```bash
npm run test:regression    # testes de regressão das guards
npm run test:unit          # testes unitários (pii, toon, plans) — 39 testes
npm run test:gold          # avaliação do gold set RAG
npm run pinecone:create-index  # criar índice Pinecone (setup inicial)
npm run release:check      # regressão + gold + build (rodar antes de deploy)
```
