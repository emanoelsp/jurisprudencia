# Arquitetura do Agente de IA — IurisPrudentIA

## Stack de IA (implementada)

| Componente | Implementação |
|-----------|--------------|
| LLM primário | Gemini 2.5 Flash (`gemini-2.5-flash`) via `@google/genai` |
| LLM fallback 1 | Groq `llama-3.1-8b-instant` |
| LLM fallback 2 | OpenRouter `llama-3.1-8b-instruct:free` |
| Embedding | `gemini-embedding-001` |
| Banco vetorial | Pinecone (index `jurisprudencia`, namespace `jurisprudencia_publica` + `cli-{userId}`) |
| Reranking | Cohere `rerank-v3.5` + fallback lexical local |
| Anti-alucinação | TOON (Typed Object-Oriented Notation) — `src/lib/toon.ts` |
| Busca híbrida | RRF: DataJud CNJ + Pinecone + LexML |
| Bases legais | CF/88 (scraper planalto.gov.br), Código Penal, STJ CKAN, DataJud |
| Streaming | SSE via ReadableStream (Next.js Route Handler) |

---

## Pipeline de análise (`/api/analyze`)

```
PDF upload
  → extractTextFromBuffer()          [pdf-parse]
  → extractMetadata()                [LLM + regex fallback]
  → isLegalScopeText()               [guard: mínimo 80 chars + keywords jurídicos]
  → checkPlanLimits()                [plano + contadores Firestore]
  → searchHybrid()                   [DataJud keyword + Pinecone vetorial + LexML]
  → rerankResults()                  [Cohere rerank-v3.5 || lexical local]
  → filter(score >= MIN_RERANK_SCORE) [default 0.5]
  → assert(results >= MIN_RESULTS)   [default 2 — aborta se insuficiente]
  → fetchLegislacao()                [CF/88 artigos + Código Penal + bases-publicas]
  → enrichWithToon()                 [ToonPayload com hash SHA-256 ementa]
  → serializeToonForPrompt()         [XML <IMMUTABLE_FACTS>]
  → LLM.generate(prompt)             [Gemini → Groq → OpenRouter]
  → validateToonIntegrity()          [valida números CNJ na saída]
  → parseJustificationJson()         [schema obrigatório]
  → computeConfidence()              [retrieval + coverage + generation_risk]
  → stream SSE chunks                [metadata → results → justification → complete]
  → saveToFirestore()                [análise + fontes + score]
```

---

## Saída estruturada obrigatória

Todo parecer do LLM deve retornar JSON com o schema:

```typescript
{
  conclusao: string,           // tese final — não pode ser vazio
  fundamentoJuridico: string,  // base legal — não pode ser vazio
  aplicabilidade: string,      // como se aplica ao caso — não pode ser vazio
  citacoes: [{
    numero: string,            // número CNJ exato — validado pelo TOON
    tribunal: string,
    relator: string,
    dataJulgamento: string,
    trecho: string             // citação literal da ementa
  }]
}
```

Validado por `validateJustificationSchema()` em `src/lib/guards.js`. Saídas que não passam nesse schema são rejeitadas antes de chegar ao usuário.

---

## Grau de confiança (0–100)

O campo `scoreIa` (e exibido via `ConfidenceBadge`) é calculado a partir de três componentes:

| Componente | Descrição |
|-----------|-----------|
| `retrieval_confidence` | Qualidade e quantidade dos resultados recuperados pós-rerank |
| `evidence_coverage` | Proporção de fontes distintas cobertas (DataJud, Pinecone, LexML, STJ) |
| `generation_risk` | Risco estimado de alucinação (inversamente proporcional ao score) |

Fórmula final: `score = (retrieval_confidence × 0.5) + (evidence_coverage × 0.3) + ((1 - generation_risk) × 0.2)` × 100

Exibição via badge:
- 0–49: `baixa` (vermelho)
- 50–74: `media` (amarelo)
- 75–100: `alta` (verde)

---

## Camada TOON (anti-alucinação)

**Princípio**: Fatos jurídicos críticos são serializados como XML imutável antes de serem enviados ao LLM. O modelo recebe instrução explícita de que não pode reparafrasear, inferir ou inventar esses campos.

```xml
<IMMUTABLE_FACTS>
  <processo>
    <numero>XXXXX-XX.XXXX.X.XX.XXXX</numero>   <!-- NUNCA modificar -->
    <tribunal>STJ</tribunal>
    <relator>Min. Fulano</relator>
    <dataJulgamento>2023-05-10</dataJulgamento>
    <ementaHash>sha256:abc123...</ementaHash>
    <ementaOriginal>texto verbatim...</ementaOriginal>
  </processo>
</IMMUTABLE_FACTS>
```

Pós-geração, `validateToonIntegrity()` confere se todos os números CNJ citados pelo LLM existem nos ToonPayloads carregados. Discrepâncias bloqueiam a entrega do parecer.

---

## Bases de dados jurídicas

| Base | Tipo | Cobertura | Integração |
|------|------|-----------|-----------|
| DataJud CNJ | API pública | STF, STJ, TST, TSE, STM, TRF1-6, todos os TJs | `src/lib/datajud.ts` |
| Pinecone (pública) | Vetorial | Processos ingeridos via admin | `src/lib/pinecone.ts` |
| Pinecone (privada) | Vetorial | Pareceres aprovados do usuário | namespace `cli-{userId}` |
| CF/88 | Scraper | Todos os artigos — planalto.gov.br | `src/lib/cf-planalto.ts` (cache 24h) |
| Código Penal | Estático + vetorial | Artigos relevantes | `src/lib/codigo-penal.ts` |
| LexML | API pública | Legislação federal, estadual, municipal | `src/lib/lexml.ts` |
| STJ CKAN | API pública | Dados abertos STJ | `src/lib/stj-dados-abertos.ts` |

---

## Estratégia de chunking

Para documentos extensos (CF/88, CP, peças processuais):

- **Tamanho do chunk**: 1000 caracteres
- **Overlap**: 200 caracteres (preserva continuidade semântica entre chunks)
- **Modelo de embedding**: `gemini-embedding-001`
- **Namespace de legislação**: `jurisprudencia_publica` (compartilhado)
- **Namespace privado**: `cli-{userId}` (isolado por usuário)

Chunks de legislação são seeded na inicialização do servidor (dev) via `instrumentation.ts` e via endpoint `/api/admin/legislacao-ingest` em produção.

---

## Configuração por variáveis de ambiente

```env
AI_CHAT_MODEL=gemini-2.5-flash          # modelo LLM primário
AI_EMBEDDING_MODEL=gemini-embedding-001  # modelo de embedding
MIN_RESULTS_FOR_ANALYSIS=2               # mínimo de resultados para análise
MIN_RERANK_SCORE=0.5                     # score mínimo pós-rerank
COHERE_RERANK_MODEL=rerank-v3.5          # modelo de reranking
LEXML_ENABLED=true                       # ativa busca LexML
SKIP_LEGISLACAO_SEED=true                # skip seed em produção
DATAJUD_REQUEST_DELAY_MS=120             # throttle DataJud
```

---

## Tools do agente (`src/lib/tools/`)

| Tool | Descrição |
|------|-----------|
| `extract-causa-petendi.ts` | Extrai a causa de pedir e pedidos do texto do processo |
| `search-public-bases.ts` | Busca nas bases públicas (DataJud, LexML, STJ CKAN) |
| `verify-precedent.ts` | Verifica a existência e integridade de um precedente |

Toda tool deve validar input e output antes de passar ao agente.

---

## Formato de prompt das bases públicas

Saídas das bases públicas são formatadas no padrão TOON compacto `⟨BP⟩`:

```
⟨BP⟩⟨F:Art. 138 CP⟩⟨T:lei⟩⟨E:Caluniar alguém...⟩⟨A:aplicável pois...⟩⟨/BP⟩
```

Onde:
- `F` = fonte (ex: "Art. 138 CP", "Súmula 486 STJ")
- `T` = tipo (lei, sumula, jurisprudencia)
- `E` = ementa/resumo
- `A` = aplicabilidade ao caso concreto

---

## Versionamento temporal de leis

**Problema**: A redação de uma lei na data do fato pode diferir da redação atual. Processos históricos precisam da lei "à época".

### Camada 1 — Metadado no Pinecone (implementado)

Todo vetor de legislação indexado carrega:
```
dataVigencia:  "YYYY-MM-DD"   # quando esta redação entrou em vigor
dataRevogacao: "YYYY-MM-DD"   # quando foi revogada/emendada; "9999-12-31" = vigente
isHistoricalVersion: bool      # true se indexado especificamente para uma data histórica
```

Valores iniciais:
- CF/88: `dataVigencia = "1988-10-05"`, `dataRevogacao = "9999-12-31"`
- Código Penal: `dataVigencia = "1942-01-01"`, `dataRevogacao = "9999-12-31"`
- LexML: `dataVigencia` extraída do campo `data` da API SRU; `dataRevogacao = "9999-12-31"` por padrão

`searchHybrid()` aceita `options.dataFato` (= `processo.dataProtocolo`) e filtra pós-busca:
- Remove legislação cujo `dataVigencia > dataFato` (não existia ainda)
- Remove legislação cujo `dataRevogacao < dataFato` (já revogada)
- Documentos sem `dataVigencia` passam sempre (retrocompat com vetores antigos)

### Camada 2 — Badge na UI (implementado)

`EprocResultCard` exibe badge para fontes de legislação (`lexml`, `cf_88`, `codigo_penal`):
- **"Redação na data do fato"** (verde) — vigente quando o fato ocorreu
- **"Redação vigente"** (verde) — sem `dataFato` informado, exibe versão atual
- **"Redação posterior ao fato"** (âmbar) — lei não existia na data do fato ⚠️
- **"Revogada em YYYY-MM-DD"** (vermelho) — lei já foi revogada ⚠️

### Camada 3 — Ingestão histórica (estrutura pronta, requer curadoria)

`src/lib/providers/lexml-historical.ts` + `POST /api/admin/lexml-historical-ingest`:
- Busca a redação histórica de uma URN LexML via SRU
- Indexa com `dataVigencia`, `dataRevogacao` e `isHistoricalVersion: true`
- IDs únicos: `lexml-hist:{urnSlug}:{dataVigencia}:{chunkIndex}` — sem colisão entre versões
- Vetores históricos nunca expiram (leis do passado são imutáveis)

**Limitação**: LexML não versiona automaticamente todas as redações. Curadoria manual necessária para emendas constitucionais e reformas penais de alto impacto. Ver `docs/TASKS.md` → Semana 2.

---

## Pendências de infra de agente

- [ ] **Observabilidade LLM**: integrar Langfuse ou Helicone para rastrear tokens, custo e latência por request
- [ ] **Jobs assíncronos**: integrar Inngest ou Trigger.dev para ingestão STJ CKAN agendada
- [ ] **Cache externo**: Upstash Redis para cache distribuído de embeddings e resultados (substituir cache in-memory atual)
- [ ] **Orquestrador**: LangGraph ou Mastra para fluxos multi-step mais complexos (atualmente pipeline sequencial simples)
