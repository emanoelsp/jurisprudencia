## Arquitetura anti-alucinação do JurisprudencIA

Este documento descreve, de ponta a ponta, como o JurisprudencIA foi desenhado para **reduzir alucinações**, **ancorar as respostas em evidências reais** e **manter a responsabilidade profissional do advogado**.

Organizei em camadas, do request HTTP até a UI.

---

### 1. Entrada e guardrails de escopo

- **Endpoint**: `POST /api/analyze`
- **Objetivo**: garantir que o texto enviado é uma **peça processual ou documento jurídico**, antes de gastar recursos em IA.

**Passos principais**

- Validação inicial do payload (`processoId`, `texto`, `tribunal` etc.).
- Chamada a `isLegalScopeText(texto)` em `src/lib/guards.js`:
  - Verifica tamanho mínimo (≈ 80+ caracteres).
  - Procura presença de múltiplos termos jurídicos (lista enriquecida: “decisão”, “recurso”, “embargos”, “agravo”, “execução”, “penhora”, “mandado”, “habeas”, “apelação”, “recurso especial”, “recurso extraordinário” etc.).
- Se falhar:
  - Retorna **422** com mensagem clara ao usuário:<br>
    > “O conteúdo não parece ser uma peça processual. Envie petição, decisão ou documento jurídico.”
  - Nada de IA é executado, evitando alucinações fora de domínio.

---

### 2. Extração de causa de pedir (TOON PET) – opcional, mas segura

- **Arquivo**: `src/lib/tools/extract-causa-petendi.ts`
- **Função**: `extractCausaPetendi(...)` (chamada dentro de `/api/analyze`)

**Ideia**

- A partir do texto completo, a IA gera um resumo estruturado em formato **TOON** (`⟨PET⟩...⟨/PET⟩`) contendo:
  - causa de pedir
  - pedidos
  - artigos relevantes
  - termos de busca
- O campo `queryRag` extraído é usado como **query mais focada** para o RAG (quando existir), melhorando a relevância sem inventar fatos.

**Segurança**

- Saída é somente usada como *texto de busca*, não como fato jurídico.
- O formato TOON é estrutural, mas não impacta diretamente as citações finais.

---

### 3. RAG híbrido: DataJud + Pinecone + LexML

- **Arquivo**: `src/lib/rag.ts`
- **Chamado por**: `/api/analyze`

**Fontes**

1. **DataJud CNJ (API pública)** – fonte oficial de processos e acórdãos.
2. **Pinecone** (`jurisprudencia_publica` + `cli-*`) – vetores de jurisprudência ingerida (DataJud, STJ CKAN, base interna).
3. **LexML** – legislação/normas/jurisprudência de apoio.

**Processo**

- Gera **embedding** do `queryText` com `gemini-embedding-001` (3072 dims).
- Executa:
  - `fetchDataJudResults` (busca DataJud por tribunal).
  - `fetchPineconeResults` (busca vetorial, filtrando por tribunal/namespace).
  - `fetchLexMLResults` (LexML, se habilitado).
- Usa **RRF (Reciprocal Rank Fusion)** para juntar DataJud e Pinecone quando ambos retornam.
- Deduplica por número de processo, marcando metadados:
  - `fonte`: `datajud_cnj` | `base_interna` | `lexml` | `stj_dados_abertos`.
  - `alreadyUsed` + `usageCount` (TOON/pareceres usados em processos anteriores).

**Pontos anti-alucinação**

- LLM só vê jurisprudência que passou por esse pipeline.
- `fonte` é exibida na UI por card (DataJud / LexML / STJ etc.).

---

### 4. Thresholds e early-stop (evidência mínima)

- **Arquivo**: `src/app/api/analyze/route.ts`

**Constantes**

- `MIN_RESULTS_FOR_ANALYSIS` (env, default `2`)
- `MIN_RERANK_SCORE` (env, default `0.5`)
- Limiares derivados:
  - `MIN_RETRIEVAL_CONFIDENCE`
  - `MIN_EVIDENCE_COVERAGE`

**Fluxo**

1. **Poucos resultados após rerank** (`deduped.length < MIN_RESULTS_FOR_ANALYSIS`):
   - Loga `too few results`.
   - Envia `type: 'results'` com o pouco que encontrou (para transparência).
   - **Ainda assim** resolve CP/CF/Bases e envia em `metadata` se houver algo.
   - Envia `type: 'error'` com:
     > “Poucos precedentes encontrados; amplie o tribunal ou o texto do processo.”
   - Envia `type: 'complete'` e retorna.

2. **Nenhum resultado confiável** (`topRanked.length === 0`):
   - Envia resultados vazios.
   - Resolve CP/CF/Bases via `validateLegislacaoComRag` e manda se existir.
   - Envia erro específico sugerindo **expansão de escopo** (outros tribunais).

3. **Baixa confiança de recuperação / cobertura de evidência**:
   - Calcula `retrieval_confidence`, `evidence_coverage`, `generation_risk`.
   - Se abaixo dos limiares, segue mesma lógica de **abstenção**: retorna resultados + CP/CF/Bases, mas com erro dizendo que não atingiu nível mínimo de confiança.

**Resultado**: o modelo só gera justificativas quando há **evidência mínima**; caso contrário, o advogado vê claramente que o agente “preferiu não opinar”.

---

### 5. TOON – camada de fatos imutáveis

- **Arquivo**: `src/lib/toon.ts`

**Ideia central**

- TOON (Typed Object-Oriented Notation) é o formato canônico dos fatos:
  - número do processo
  - tribunal
  - relator
  - data de julgamento
  - ementa original + hash de integridade
- O LLM recebe TOON como **“ground truth que não pode ser modificado”**.

**Componentes**

- `createToonPayload(result: EprocResult)` – constrói o objeto TOON a partir do resultado do RAG.
- `serializeToonForPrompt(payloads: ToonPayload[])` – serializa TOON em XML estruturado, com seção de `IMMUTABLE_FACTS`.
- `validateToonIntegrity(rawText, toonPayloads)` – garante que:
  - o texto gerado não contém números de processo não presentes no TOON.

**Validação de citações**

- `validateJustificationCitations(citacoes, toonPayloads)`:
  - Para cada citação no JSON de saída:
    - Garante que `numero` existe no TOON.
    - Compara `tribunal`, `relator`, `dataJulgamento` com o payload correspondente.
  - Gera lista de violações:
    - número não presente,
    - tribunal divergente,
    - relator divergente,
    - data divergente.

**Retry rígido**

- Se houver violação na primeira tentativa:
  - Loga `TOON Violation` com detalhes.
  - Reenvia a mesma tarefa ao modelo com prompt mais rígido:
    - reforça que deve **copiar e colar** valores do TOON,
    - repete os campos imutáveis.
- Se ainda houver violação:
  - Envia `type: 'error'` com mensagem de violação TOON e não utiliza a justificativa.

---

### 6. Justificativa estruturada e conservadora

- **Camada**: dentro de `/api/analyze`, após o RAG e TOON.

**Formato**

- LLM recebe:
  - System prompt de “especialista em direito brasileiro”.
  - TOON em XML.
  - JSON schema esperado para a justificativa:
    - `conclusao`
    - `fundamentoJuridico`
    - `aplicabilidade` (pode ser `"Relevância limitada"`)
    - `citacoes` (com `numero`, `tribunal`, `relator`, `dataJulgamento`, `trecho` literal).

**Regras reforçadas em prompt**

- Trecho das ementas deve ser **literal** (copiar e colar).
- Quando a aplicabilidade for fraca:
  - usar `"Relevância limitada"`,
  - explicar de forma conservadora.
- Modelo é explicitamente instruído:
  - “Você auxilia o advogado; a decisão final e a responsabilidade profissional são sempre do advogado.”

**Fallback**

- Se o JSON não puder ser parseado ou houver problema menor:
  - sistema pode construir justificativa a partir do próprio TOON (`buildFallbackJustification`), sem inventar fatos (usa número, tribunal, relator e ementa originais).

---

### 7. Bases complementares: CF/88, Código Penal, Bases públicas

#### 7.1 Legislação no Pinecone

- **Namespace**: `legislacao`
- **Seed**:
  - Dev: `instrumentation.ts` (seed automático se não houver `.legislacao-seeded`, a menos que `SKIP_LEGISLACAO_SEED=true`).
  - Produção: `POST /api/setup/seed-legislacao` com `Authorization: Bearer SETUP_SECRET`.
- Fonte:
  - Planalto (CF/88, CP) + fallback para listas curtas internas (`ARTIGOS_CONSTITUCIONAIS`, `ARTIGOS_PENAIS`).

#### 7.2 TOON para CF/88 e CP

- **Arquivos**:
  - `src/lib/toon-cf.ts` – parse de TOON CF (`⟨CF⟩⟨ID⟩⟨TIT⟩⟨APLIC⟩⟨/CF⟩`).
  - `src/lib/toon-bases-publicas.ts` – parse de TOON bases públicas (`⟨BP⟩⟨F⟩⟨T⟩⟨E⟩⟨A⟩⟨/BP⟩`).
  - `src/lib/prompts/bases-publicas.ts` – prompts específicos.

#### 7.3 Integração na análise

- `/api/analyze` dispara em paralelo:
  - `basesPublicasPromise`
  - `codigoPenalPromise`
  - `cfPromise`
- Em todos os caminhos (normal, poucos resultados, baixa evidência), ao final:
  - chama `validateLegislacaoComRag(texto, cfArticles, codigoPenal)`,
  - envia metadados:
    - `cf_articles`
    - `bases_publicas`
    - `codigo_penal`
    - `gemini_quota_exceeded` (se houver erro de quota).

---

### 8. Persistência e auditoria (Firestore + TOON)

- **Coleção**: `jurisprudencias`
- **Endpoint**: `POST /api/jurisprudencia`

Ao aprovar resultados na tela de análise:

- Envia até N resultados para `POST /api/jurisprudencia` com:
  - `processoId`
  - `result` completo (inclui metadados do RAG)
  - `justificativaIa` (texto gerado)
  - `toonData` (payload TOON completo, imutável)
  - `confianca` (score do rerank).
- Deduplicação por `numero` + `userId`:
  - se já existir, só atualiza `processoIds` e datas.

**Benefícios**

- Histórico auditável: é possível ver **qual TOON** foi usado para cada parecer.
- Reuso: a aba **Pareceres** carrega essas jurisprudências aprovadas e mostra `usageCount`.

---

### 9. UX de confiança e responsabilidade

- **Arquivo**: `src/app/dashboard/analisar/[id]/page.tsx`

**Modal “Relatório da análise”**

- Mostra:
  - Etapas concluídas (pipeline do agente).
  - Número de jurisprudências retornadas.
  - Confiança média dos resultados.
  - Três KPIs:
    - Confiança da busca.
    - Cobertura de evidências.
    - Risco de alucinação.
  - Mensagem de risco:
    - alta confiança,
    - ou “confiança geral moderada/baixa; revise com cuidado”.

**Cards de resultado**

- Badge de confiança (alta/média/baixa) + porcentagem.
- Estado visual especial para **baixa confiança** (“Revisar com cuidado”).
- Fonte sempre visível: DataJud / LexML / STJ Dados Abertos / base interna.

**Abas laterais**

- `DataJud`, `Bases`, `CP`, `CF/88`, `Pareceres`:
  - deixam explícito de onde vem cada informação (legislação, RAG, base pessoal).

**Disclaimers**

- Texto próximo aos resultados:
  > “As sugestões são de apoio à decisão. A responsabilidade pela peça e pelas citações é do advogado.”

---

### 10. Resumo: por que essa arquitetura é anti-alucinação

1. **Escopo controlado** – só aceita textos jurídicos/processuais.
2. **Grounding forte** – tudo começa no DataJud / Pinecone / LexML, nunca em “imaginação” do modelo.
3. **TOON como verdade imutável** – número, tribunal, relator, data e ementa original são a âncora; qualquer divergência é detectada.
4. **Thresholds de confiança** – sem evidência mínima, o agente prefere se abster a “chutar”.
5. **Validação de citações** – garante que o que o modelo cita bate 1:1 com o que existe no TOON.
6. **Fallback seguro** – quando algo falha, recua para a própria ementa/TOON, sem inventar.
7. **UX honesta** – mostra fontes, confiança, risco, e reforça que a decisão final é sempre do advogado.

Com isso, o JurisprudencIA se comporta mais como um **assistente de pesquisa bem comportado** do que como um “oráculo”: ele só fala com segurança quando tem base, e te sinaliza claramente quando a evidência é fraca ou inexistente.

