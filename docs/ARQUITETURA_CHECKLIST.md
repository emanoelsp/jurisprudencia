# Checklist: Arquitetura do Agente JurisprudencIA

Resumo do que está implementado para **carregar processos, trazer jurisprudências compatíveis com percentual de confiança**, **evitar alucinações** e garantir um pipeline completo.

---

## ✅ Guardrails

| Item | Onde | Descrição |
|------|------|-----------|
| **isLegalScopeText** | `src/lib/guards.js` | Garante que o texto é contexto jurídico-processual (número CNJ ou 2+ termos jurídicos). Bloqueia análise de conteúdo fora do escopo. |
| **422 na API** | `src/app/api/analyze/route.ts` | Se o texto não passar no guardrail, a análise retorna 422 e a UI exibe mensagem clara. |

---

## ✅ Engenharia de prompt

| Item | Onde | Descrição |
|------|------|-----------|
| **TOON (formatos estruturados)** | `src/lib/toon.ts`, `toon-bases-publicas.ts`, `toon-cf.ts` | Respostas em tokens ⟨BP⟩, ⟨CF⟩ etc. Reduz JSON quebrado e força o modelo a seguir estrutura. |
| **Few-shot** | `src/lib/prompts/bases-publicas.ts`, artigos CF/CP no analyze | Exemplos no system/user para Bases Públicas, CF/88 e Código Penal. |
| **Persona + regras** | `BASES_PUBLICAS_PERSONA`, prompts no analyze | "NUNCA invente número de processo", "Cite apenas fontes reais ou plausíveis". |
| **Temperatura baixa** | `src/app/api/analyze/route.ts` | temperature 0.1, top_p 0.6 para respostas determinísticas. |

---

## ✅ Tools

| Tool | Onde | Uso |
|------|------|-----|
| **search_public_bases** | `src/lib/tools/search-public-bases.ts` | Busca jurisprudência em bases públicas (DataJud). |
| **extract_causa_petendi** | `src/lib/tools/extract-causa-petendi.ts` | Extrai causa petendi, pedido e artigos do texto em TOON. |
| **verify_precedent** | `src/lib/tools/verify-precedent.ts` | Verificação de precedente. |

---

## ✅ RAG (Retrieval-Augmented Generation)

| Camada | Onde | Descrição |
|--------|------|-----------|
| **Busca híbrida** | `src/lib/rag.ts` – `searchHybrid` | DataJud (keyword) + Pinecone (vetorial) em paralelo. |
| **Fusão RRF** | `fuseWithRRF` | Reciprocal Rank Fusion para combinar rankings sem scores absolutos. |
| **LexML** | `src/lib/lexml.ts` | Legislação/normas (fallback página de busca se SRU indisponível). |
| **Namespaces** | Pinecone | `jurisprudencia_publica`, `legislacao`, `cli-<userId>`. |
| **Embeddings** | `generateEmbedding` | Gemini gemini-embedding-001 (3072 dim). |

---

## ✅ Rerank

| Item | Onde | Descrição |
|------|------|-----------|
| **Cohere** | `rerankWithCohere` em `rag.ts` | Quando `COHERE_API_KEY` está definida, usa rerank (ex.: rerank-v3.5). |
| **Fallback local** | `rerankResults` | Score por termos em comum entre query e ementa + posição no ranking. |
| **Badge de confiança** | `scoreToBadge`, `ConfidenceBadge` | Alta / Média / Baixa a partir do score (0–1). |
| **Percentual na UI** | `EprocResultCard`, modal "O que o agente fez" | Exibição de confiança por resultado e média. |

---

## ✅ Anti-alucinação (TOON)

| Item | Onde | Descrição |
|------|------|-----------|
| **ToonPayload** | `src/types/index.ts`, `src/lib/toon.ts` | Número do processo, tribunal, relator, data, ementa original e hash como fatos imutáveis. |
| **Enriquecimento** | `enrichWithToon` | Cada resultado do RAG vira payload TOON antes de ir para o LLM. |
| **Prompt ancorado** | `serializeToonForPrompt` | LLM recebe XML com "Use o número e o relator EXATAMENTE como no TOON". |
| **Validação pós-geração** | `validateToonIntegrity` em analyze | Detecta se o modelo alterou número de processo ou relator; envia erro ao cliente. |
| **Persistência** | Firestore `jurisprudencias` | `toonData` guardado para auditoria. |

---

## ✅ Fluxo completo do agente

1. **Upload/PDF** → extração de texto e metadados (LLM).
2. **Guardrail** → `isLegalScopeText`; se falhar, 422.
3. **Bases Públicas + CP + CF** (em paralelo) → LLM com TOON para normas/súmulas e artigos aplicáveis.
4. **Busca** → `searchEproc` (DataJud + Pinecone + LexML) com tribunal selecionado.
5. **Rerank** → Cohere ou local; dedupe.
6. **TOON** → enriquecimento dos resultados; envio ao LLM com ancoragem.
7. **Streaming** → justificativas por resultado; validação TOON ao final.
8. **UI** → resultados com percentual de confiança; modal "O que o agente fez" em linguagem natural.

---

## STJD (Superior Tribunal de Justiça Desportiva)

O **STJD** não possui API pública de dados abertos como o DataJud/CNJ. Jurisprudência e decisões estão no site oficial ([stjd.org.br](https://www.stjd.org.br/jurisprudencia/acordaos-decisoes)). Para temas desportivos, use a busca por tribunal no DataJud quando houver oferta de dados do órgão, ou consulte o portal do STJD manualmente.
