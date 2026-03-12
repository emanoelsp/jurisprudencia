# Recomendações: Agente LLM anti-alucinação na área jurídica

Recomendações para reforçar a confiabilidade e reduzir alucinações no JurisprudencIA, com foco em **grounding**, **validação** e **responsabilidade profissional**.

---

## 1. Retrieval e grounding (RAG)

| Recomendação | Status atual | Ação sugerida |
|--------------|--------------|----------------|
| **Só gerar sobre o que foi recuperado** | ✅ TOON ancorado nos resultados do RAG | Manter: o LLM recebe apenas jurisprudências que existem no TOON. |
| **Mínimo de evidência** | Parcial | Rejeitar análise se `rawResults.length < 2` (ou threshold configurável) e exibir: "Poucos precedentes encontrados; amplie o tribunal ou o texto do processo." |
| **Score mínimo no rerank** | Parcial | Filtrar resultados com `rerankScore < 0.5` antes de enviar ao LLM (ou threshold em env), para não ancorar em trechos irrelevantes. |
| **Citação = trecho literal** | ✅ Schema exige `trecho` em citacoes | Reforçar no prompt: "trecho deve ser citação literal da ementa, sem parafrasear". |
| **Fonte sempre visível** | ✅ DataJud / base_interna / lexml no card | Manter; considerar "Ver fonte original" (link para DataJud/portal) quando disponível. |

---

## 2. TOON e validação pós-geração

| Recomendação | Status atual | Ação sugerida |
|--------------|--------------|----------------|
| **Número de processo imutável** | ✅ Validado em `validateToonIntegrity` | Manter. |
| **Relator e tribunal imutáveis** | ⚠️ Só número é validado | **Estender** `validateToonIntegrity`: extrair do output as menções a relator/tribunal por processo e checar se batem com o TOON (evitar troca de relator entre processos). |
| **Data de julgamento** | Não validada | Opcional: validar formato e que a data citada existe no TOON. |
| **Nunca inventar processo que não está no TOON** | ✅ Regex CNJ + whitelist do TOON | Manter. |
| **Hash de integridade** | ✅ `ementaHash` no TOON | Opcional: no output da justificativa, exigir que a citação referencie o hash quando houver risco de confusão entre ementas. |

---

## 3. Guardrails e escopo

| Recomendação | Status atual | Ação sugerida |
|--------------|--------------|----------------|
| **Texto jurídico-processual** | ✅ `isLegalScopeText` (CNJ ou 2+ termos) | Enriquecer lista de termos (ex.: "decisão", "recurso", "embargos", "agravo", "execução", "penhora"). |
| **Tamanho mínimo** | ✅ 80 caracteres | Manter. |
| **Não analisar fora do escopo** | ✅ 422 + mensagem clara | Manter; considerar mensagem: "O conteúdo não parece ser uma peça processual. Envie petição, decisão ou documento jurídico." |
| **Abstenção quando incerto** | Parcial | No prompt da justificativa: "Se não houver fundamento jurídico claro para citar este precedente, retorne aplicabilidade com 'Relevância limitada' e seja conservador." |

---

## 4. Engenharia de prompt

| Recomendação | Status atual | Ação sugerida |
|--------------|--------------|----------------|
| **Temperatura baixa** | ✅ 0.1 | Manter. |
| **Formato estruturado (TOON/JSON)** | ✅ JSON com schema | Manter; em caso de falha de parse, não usar texto livre como fallback – repetir com prompt mais restritivo ou usar fallback não-alucinante (ex.: só ementa + "Ver processo no DataJud"). |
| **Few-shot** | ✅ Bases públicas, CF, CP | Manter e ampliar com 1–2 exemplos de justificativa "conservadora" (quando a aplicabilidade é limitada). |
| **Instrução explícita "NUNCA invente"** | ✅ No system e no TOON | Manter. |
| **Papel do modelo** | "Especialista em direito" | Deixar explícito: "Você auxilia o advogado; a decisão final e a responsabilidade profissional são sempre do advogado." |

---

## 5. UX e responsabilidade profissional

| Recomendação | Ação sugerida |
|---------------|----------------|
| **Disclaimer visível** | Na tela de análise ou no rodapé: "As sugestões são de apoio à decisão. A responsabilidade pela peça e pelas citações é do advogado." |
| **Confiança por resultado** | ✅ Badge alta/média/baixa + % | Manter; considerar ocultar ou desvalorizar visualmente resultados com confiança muito baixa. |
| **Auditoria** | ✅ TOON e dados salvos no Firestore | Manter; considerar log de qual TOON foi usado em cada justificativa (ids) para rastreabilidade. |
| **Correção pelo usuário** | ✅ "Inserir no editor" + edição manual | Reforçar que o advogado pode e deve revisar cada citação antes de aprovar. |

---

## 6. Fluxo de justificativa (anti-alucinação)

| Recomendação | Ação sugerida |
|---------------|----------------|
| **Uma justificativa por resultado** | ✅ 1:1 com TOON | Manter. |
| **Fallback sem invenção** | ✅ `buildFallbackJustification` com dados do TOON | Garantir que o fallback nunca inclua número/relator que não venha do resultado. |
| **Após violação TOON** | ✅ Envia `error` ao cliente | Manter; na UI, exibir aviso claro e sugerir "Tente novamente" ou usar apenas a ementa sem justificativa gerada. |
| **Retry com prompt mais rígido** | Não implementado | Opcional: em caso de violação, 1 retry com prompt que repete os IMMUTABLE_FACTS e exige "copie e cole o número do processo abaixo". |

---

## 7. Resumo de prioridades (status de implementação)

1. **Alto impacto, baixo esforço**  
   - ✅ Estender validação para **relator e tribunal** (`validateJustificationCitations`).  
   - ✅ **Disclaimer** na interface.  
   - ✅ **Threshold de confiança**: `MIN_RERANK_SCORE` (env, default 0.5) e filtro antes do LLM.

2. **Médio impacto**  
   - ✅ Rejeitar análise quando poucos resultados: `MIN_RESULTS_FOR_ANALYSIS` (env, default 2).  
   - ✅ Enriquecer `LEGAL_KEYWORDS` em `isLegalScopeText`.  
   - ✅ Few-shot de justificativa conservadora + prompt "Relevância limitada".

3. **Opcional / longo prazo**  
   - ✅ Validação de data de julgamento em `validateJustificationCitations`.  
   - ✅ Retry com prompt mais rígido após violação TOON (1 retry com valores copiar/colar).  
   - Link "Ver fonte original" por resultado (DataJud/portal) – pendente.

---

## Referência rápida (o que você já tem)

- **Guardrail**: `isLegalScopeText`  
- **TOON**: `createToonPayload`, `serializeToonForPrompt`, `validateToonIntegrity` (número de processo)  
- **RAG**: DataJud + Pinecone + LexML, rerank, fusão RRF  
- **Prompt**: temperatura 0.1, JSON com schema, IMMUTABLE_FACTS no XML  
- **Fallback**: justificativa com dados do TOON, sem invenção  
- **Persistência**: TOON e jurisprudência no Firestore para auditoria  

Implementar as prioridades "alto impacto, baixo esforço" já eleva bastante a segurança jurídica e a percepção de confiabilidade do agente.
