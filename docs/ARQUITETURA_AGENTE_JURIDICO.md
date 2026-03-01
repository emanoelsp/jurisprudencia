# Arquitetura de Agentes e LLMs para JurisprudencIA

> Fundamentação acadêmica e rigor técnico para aplicação de alta fidelidade em processos jurídicos

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Mapeamento: semantic_agent → JurisprudencIA](#mapeamento-semantic_agent--jurisprudencia)
3. [Pilar 1: Estratégia de Recuperação (RAG Híbrido)](#pilar-1-estratégia-de-recuperação-rag-híbrido)
4. [Pilar 2: Arquitetura do Agente](#pilar-2-arquitetura-do-agente)
5. [Pilar 3: Desafios Técnicos e Integração](#pilar-3-desafios-técnicos-e-integração)
6. [Referências Acadêmicas](#referências-acadêmicas)

---

## Arquitetura da Tela de Funções (5 Abas)

```
graph TD
    classDef frontend fill:#1a1a2e,stroke:#4ecca3,stroke-width:2px,color:#fff;
    classDef orchestrator fill:#16213e,stroke:#4ecca3,stroke-width:2px,color:#fff;
    classDef agents fill:#0f3460,stroke:#e94560,stroke-width:2px,color:#fff;
    classDef data fill:#533483,stroke:#fff,stroke-width:1px,color:#fff;
    classDef external fill:#2d3436,stroke:#dfe6e9,stroke-width:1px,color:#fff;

    subgraph UI [Camada de Apresentação - Next.js]
        Editor[Editor da Peça Final]:::frontend
        Tabs[Painel de 5 Abas: DataJud | Gemini | CP | CF | Histórico]:::frontend
        BtnAnalyze[Botão: Analisar com JurisprudencIA]:::frontend
        BtnApprove[Botão: Aprovar]:::frontend
    end

    subgraph Backend [Orquestrador & API Routes]
        Orch[Orquestrador Central]:::orchestrator
        Guard[Guardrail Jurídico]:::orchestrator
        Rerank[Cohere Rerank]:::orchestrator
        ToonParser[Parser TOON]:::orchestrator
    end

    subgraph Intelligence [Agentes Cognitivos - Temp: 0.1]
        A1[Agente DataJud]:::agents
        A2[Agente Gemini SDK]:::agents
        A3[Agente RAG CP]:::agents
        A4[Agente RAG CF]:::agents
        A5[Agente RAG User]:::agents
    end

    subgraph Persistence [Data Layer]
        Pinecone[(Pinecone Vector DB - Namespaces: CP, CF, User)]:::data
        DJAPI[API Pública DataJud]:::external
        Sync[LegalSync Tool]:::data
    end

    BtnAnalyze --> Guard --> Orch
    Orch --> A1 & A2 & A3 & A4 & A5
    A1 --> DJAPI
    A3 & A4 & A5 --> Pinecone
    A1 & A2 & A3 & A4 & A5 --> Rerank --> ToonParser --> Tabs
    Tabs --> Editor
    BtnApprove --> A5
```

---

## Visão Geral

O **semantic_agent** implementa uma pipeline cognitiva controlada:

```
Input → Guardrail → Orchestrator → Agent (LLM) → Parser TOON → JSON estruturado
```

O **JurisprudencIA** já possui:

- **Guardrail** (`isLegalScopeText`) – filtra contexto jurídico
- **RAG** – Vector Search (Pinecone) + DataJud API + Reranking (Cohere)
- **TOON** – Anti-alucinação em jurisprudência
- **Streaming** – Justificativas em tempo real

Este documento propõe **evoluir** o JurisprudencIA com:

1. **RAG Híbrido** – BM25 + Vector + Re-ranking (cross-encoder)
2. **Arquitetura de Agente** – Tools específicas e sub-agentes
3. **Integrações** – Context window, privacidade, conteinerização

---

## Mapeamento: semantic_agent → JurisprudencIA

| Componente | semantic_agent | JurisprudencIA (atual) | Evolução proposta |
|------------|----------------|------------------------|-------------------|
| **Guardrail** | `validateIndustrialContext` (regex industrial) | `isLegalScopeText` (regex jurídico) | ✅ Manter, enriquecer termos |
| **Orchestrator** | `/api/orchestrator` linear | `/api/analyze` streaming | ✅ Adicionar camada de orquestração explícita |
| **Agent** | `invokeAgent` + TOON input/output | LLM direto com TOON no prompt | ✅ Extrair `invokeJuridicalAgent` com tools |
| **TOON** | `⟨MAP_START⟩⟨SRC⟩⟨TGT⟩⟨CONF⟩` | `ToonJurisprudencia` + XML | ✅ Manter, alinhar gramática |
| **Parser** | `parseToonOrchestrator` | `serializeToonForPrompt` | ✅ Unificar em lib |
| **Tools** | `validate_eclass_format`, `trigger_pdf_generation` | — | 🆕 `search_public_bases`, `extract_causa_petendi`, `verify_precedent` |
| **RAG** | Planejado (Qdrant) | Pinecone + DataJud + Cohere | 🆕 Adicionar BM25 híbrido |

---

## Pilar 1: Estratégia de Recuperação (RAG Híbrido)

### Estado Atual

- **Vector Search**: Pinecone (embeddings Gemini text-embedding-004)
- **API Pública**: DataJud (full-text nos tribunais)
- **Reranking**: Cohere rerank-multilingual-v3.0 ou fallback lexical local

### Evolução: RAG Híbrido

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    Query de Busca                         │
                    │         (causa petendi + pedido + termos-chave)           │
                    └─────────────────────────────────────────────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
            ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
            │ Busca Vetorial │           │  BM25 (sparse) │           │   DataJud     │
            │   (Pinecone)   │           │  termos exatos │           │   API full-text│
            │  semântica     │           │ art. 138, TJSC │           │  por tribunal │
            └───────┬───────┘           └───────┬───────┘           └───────┬───────┘
                    │                           │                           │
                    └───────────────────────────┼───────────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │   Fusão Recíproca     │
                                    │  (RRF ou média)       │
                                    └───────────┬───────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │   Re-ranking          │
                                    │  Cross-Encoder        │
                                    │  (Cohere / local)     │
                                    └───────────┬───────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │   Top-K Acórdãos      │
                                    │   TOON-enriched       │
                                    └───────────────────────┘
```

### Implementação Sugerida

1. **BM25** – Usar `flexsearch` ou integração com Pinecone metadata filtering por termos exatos (ex: números de artigos, nomes de tribunais).
2. **Fusão** – Reciprocal Rank Fusion (RRF) para combinar scores vetoriais e BM25.
3. **Re-ranking** – Manter Cohere; opcional: cross-encoder local (ex: `cross-encoder/ms-marco-MiniLM-L-6-v2`) para privacidade.

**Arquivo-alvo**: `src/lib/rag.ts` – adicionar `searchHybrid(query, options)` que orquestra vector + BM25 + rerank.

---

## Pilar 2: Arquitetura do Agente

### Padrão do semantic_agent

O semantic_agent usa **function calling** do Gemini:

```typescript
// semantic_agent/tools/index.ts
export const AGENT_TOOLS = [
  { functionDeclarations: [
    { name: "validate_eclass_format", parameters: {...} },
    { name: "trigger_pdf_generation", parameters: {...} },
  ]}
]
```

### Tools Jurídicas Propostas

| Tool | Descrição | Implementação |
|------|-----------|---------------|
| `search_public_bases` | Interface com APIs de tribunais (DataJud, Jusbrasil, etc.) para extrair inteiro teor | Wrapper sobre `fetchDataJudByQuery` + possíveis APIs futuras |
| `extract_causa_petendi` | Sub-agente: extrai causa petendi e pedido de petição/queixa-crime | LLM dedicado com prompt jurídico estruturado |
| `verify_precedent` | Consulta se decisão foi superada por súmula vinculante ou tese de repercussão geral | Integração com base de súmulas STF/STJ (API ou corpus estático) |

### Sub-Agente: Analisador de Petições

Inspirado no `extract-datasheet` do semantic_agent (PDF → variáveis → TOON), criar:

```
Petição (PDF/texto) → LLM com prompt estruturado → { causaPetendi, pedido, artigosCitados }
                                                    ↓
                                            Query de busca RAG
```

**Prompt sugerido** (estilo TOON para economia de tokens):

```
Extraia do texto processual:
⟨PET⟩⟨CAUSA:[causa petendi resumida]⟩⟨PEDIDO:[pedido principal]⟩⟨ART:[artigos citados]⟩⟨/PET⟩
NUNCA invente números de processo. Use apenas o que está no texto.
```

### Orquestrador Explícito

Criar `/api/orchestrator` (ou renomear fluxo em `/api/analyze`) seguindo o padrão:

```
1. Guardrail (isLegalScopeText)
2. Sub-agente: extract_causa_petendi(texto) → query
3. RAG híbrido: searchHybrid(query, tribunal)
4. Re-ranking
5. TOON enrichment
6. Agent principal: invokeJuridicalAgent(toonPayloads, query) → justificativas
7. validateToonIntegrity
```

---

## Pilar 3: Desafios Técnicos e Integração

### Context Window

Processos judiciais são extensos. Estratégias:

| Técnica | Descrição | Status no projeto |
|---------|-----------|-------------------|
| **Chunking** | 1000 chars, overlap 200 | ✅ `chunkText` em `rag.ts` |
| **Summarização incremental** | Resumo por tópicos (fatos, pedidos, fundamentos) | 🆕 Sub-agente dedicado |
| **LongContext** | Modelos com janela grande (Gemini 1.5 Pro, Claude) | 🆕 Configurável por plano |
| **Sliding window** | Janela deslizante sobre o texto | 🆕 Para processos muito longos |

### Privacidade e Segurança

- **Docker**: conteinerizar a aplicação para isolar dados sensíveis (padrão já usado em outros projetos).
- **Dados sensíveis**: não persistir texto completo de processos em logs; usar hashes para auditoria.
- **TOON**: `ementaHash` já garante integridade; considerar criptografia em repouso para Firestore.

### Estrutura de Diretórios Proposta

```
src/
├── lib/
│   ├── agent.ts              # invokeJuridicalAgent (novo, inspirado em semantic_agent)
│   ├── guardrail.ts          # isLegalScopeText (existente) + termos enriquecidos
│   ├── rag.ts                # + searchHybrid, BM25
│   ├── toon.ts               # (existente)
│   ├── tools/
│   │   ├── index.ts          # AGENT_TOOLS jurídicas
│   │   ├── search-public-bases.ts
│   │   ├── extract-causa-petendi.ts
│   │   └── verify-precedent.ts
│   └── prompts/
│       ├── system-juridical.txt
│       ├── extract-petition.txt
│       └── few-shot-juridical.txt
├── app/api/
│   ├── analyze/route.ts      # (existente) evoluir para orquestrador
│   └── orchestrator/route.ts # (opcional) camada explícita
```

---

## Referências Acadêmicas

### Legal Prompt Engineering

1. **An Integrated Framework of Prompt Engineering and Multidimensional Knowledge Graphs for Legal Dispute Analysis**  
   - Combina prompt engineering com knowledge graphs; F1 de 0.356 → 0.714; melhora de 29.5–39.7% em citação.  
   - [arXiv:2507.07893](https://arxiv.org/pdf/2507.07893)

2. **L4M: Towards Trustworthy Legal AI through LLM Agents and Formal Reasoning**  
   - Agentes LLM adversariais + SMT-solver para verificação formal; supera GPT-4-mini, DeepSeek-V3, Claude 4 em benchmarks jurídicos.  
   - [arXiv:2511.21033](https://arxiv.org/abs/2511.21033)

3. **CLEAR** – Legal Rule Understanding Enhancement  
   - Recuperação de regras, insights, análise de casos e raciocínio jurídico.  
   - [ACL 2025](https://aclanthology.org/2025.findings-emnlp.475.pdf)

### Multi-Agent e RAG Híbrido

4. **L-MARS: Legal Multi-Agent Workflow with Orchestrated Reasoning and Agentic Search**  
   - Decomposição de consultas, multi-agentes, busca em fontes heterogêneas; Judge Agent verifica suficiência, jurisdição e validade temporal.  
   - [arXiv:2509.00761](https://arxiv.org/abs/2509.00761)

5. **HyPA-RAG: Hybrid Parameter Adaptive RAG for AI Legal and Policy Applications**  
   - RAG híbrido (dense + sparse + knowledge graph); classificador de complexidade de query para parâmetros adaptativos.  
   - [arXiv:2409.09046](https://arxiv.org/abs/2409.09046v1)

6. **PAKTON** – Multi-Agent Framework for Legal Agreements  
   - Framework open-source; RAG multi-estágio; lida com terminologia complexa e cláusulas sobrepostas.  
   - [arXiv:2506.00608](https://arxiv.org/html/2506.00608v2)

---

## Próximos Passos

1. ~~**Fase 1**~~ – RAG Híbrido: DataJud + Pinecone em paralelo, fusão RRF ✅
2. ~~**Fase 2**~~ – Sub-agente `extract_causa_petendi` e prompt TOON para petições ✅
3. ~~**Fase 3**~~ – Tools jurídicas (`searchPublicBases`, `verifyPrecedent`) + `invokeJuridicalAgent` ✅
4. **Fase 4** – Integrar `invokeJuridicalAgent` no fluxo de justificativas (opcional)
5. **Futuro** – Expandir `verifyPrecedent` com corpus de súmulas STF/STJ

---

## Implementação Realizada (2025)

### Fase 1 – RAG Híbrido
- `searchHybrid()` em `src/lib/rag.ts`: executa DataJud e Pinecone em paralelo
- `fuseWithRRF()`: fusão Reciprocal Rank entre keyword e vetorial
- `extractRelevantTerms()`: enriquecido com números de artigo e siglas de tribunais (Art. 138, TJSC, STJ)

### Fase 2 – Sub-agente extract_causa_petendi
- `src/lib/tools/extract-causa-petendi.ts`: extrai causa petendi, pedido, artigos e termos
- Formato TOON: `⟨PET⟩⟨CAUSA:...⟩⟨PEDIDO:...⟩⟨ART:...⟩⟨TERMOS:...⟩⟨/PET⟩`
- Integrado no `/api/analyze`: usa `queryRag` para busca quando extração bem-sucedida

### Fase 3 – Tools e Agente
- `src/lib/tools/search-public-bases.ts`: wrapper DataJud
- `src/lib/tools/verify-precedent.ts`: stub para verificação de súmulas (expansível)
- `src/lib/agent.ts`: `invokeJuridicalAgent()` – wrapper LLM para tarefas jurídicas

---

*Documento gerado com base na análise do semantic_agent e na arquitetura atual do JurisprudencIA.*
