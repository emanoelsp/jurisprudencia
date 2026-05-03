# PRD — IurisPrudentIA

## Tipo de projeto

Sistema Web com Agente de IA

---

## Objetivo

Plataforma de análise jurídica assistida por IA que permite a advogados e escritórios de advocacia brasileiros fazer upload de processos judiciais, obter uma análise fundamentada com base em jurisprudências reais, legislação vigente e bases públicas, e redigir seu próprio parecer com suporte editorial — tudo com rastreabilidade e grau de confiança mensurável.

---

## Público-alvo

Advogados e escritórios de advocacia no Brasil que precisam acelerar pesquisa jurídica e redação de peças processuais sem comprometer a qualidade das citações.

---

## Problema que resolve

- Pesquisa jurisprudencial manual é lenta, fragmentada e propensa a erros de citação.
- Modelos de linguagem "inventam" números de processo, nomes de relatores e ementas — o chamado problema da alucinação.
- Não há ferramenta integrada que vá do upload do PDF até a redação assistida com base em fontes verificáveis e rastreáveis.

---

## Funcionalidades principais

- [x] Autenticação (e-mail/senha + Google OAuth)
- [x] Upload e extração de texto de processos em PDF
- [x] Extração de metadados estruturados do processo (número CNJ, cliente, vara, tribunal, natureza, data)
- [x] Busca híbrida: DataJud (keyword) + Pinecone (vetorial) + LexML + STJ CKAN → fusão por RRF
- [x] Reranking com Cohere rerank-v3.5 + fallback lexical local
- [x] Análise com LLM (Gemini 2.5 Flash primário, com fallback Groq → OpenRouter)
- [x] Camada TOON de anti-alucinação (imutabilidade de fatos — número, relator, data, hash da ementa)
- [x] Parecer jurídico em streaming (SSE) com grau de confiança (0–100)
- [x] Dashboard com gestão de processos e base de conhecimento
- [x] Planos e limites por usage com cobrança via Mercado Pago
- [x] Download do texto final em PDF/texto
- [ ] Editor rich text integrado (TipTap/Lexical) para redação do parecer — **em desenvolvimento**
- [ ] Ingestão agendada do STJ CKAN (endpoint pronto, sem scheduler)
- [ ] Observabilidade LLM (Langfuse/Helicone) — pendente
- [ ] Testes E2E com Cypress — pendente

---

## Requisitos funcionais

- **RF001**: O sistema deve extrair texto de PDFs enviados via upload e identificar automaticamente número CNJ, cliente, vara, tribunal, natureza e data de protocolo.
- **RF002**: A busca deve combinar busca por palavras-chave (DataJud) e busca semântica (Pinecone vetorial) via Reciprocal Rank Fusion (RRF), devolvendo resultados de múltiplas fontes (datajud_cnj, base_interna, lexml, stj_dados_abertos).
- **RF003**: O sistema deve reranquear resultados com Cohere rerank-v3.5; se indisponível, usar scorer lexical local. Resultados com `rerankScore < MIN_RERANK_SCORE` (default 0.5) devem ser descartados.
- **RF004**: A análise deve ser rejeitada se o número de resultados válidos pós-rerank for inferior a `MIN_RESULTS_FOR_ANALYSIS` (default 2).
- **RF005**: O agente LLM deve retornar saída estruturada em JSON com campos obrigatórios: `conclusao`, `fundamentoJuridico`, `aplicabilidade`, `citacoes[]` (com numero, tribunal, relator, dataJulgamento, trecho).
- **RF006**: O grau de confiança (0–100) deve ser calculado como combinação de `retrieval_confidence` (qualidade dos resultados recuperados), `evidence_coverage` (cobertura das bases) e inversão do `generation_risk` (risco de alucinação).
- **RF007**: Todo resultado vinculado ao parecer deve carregar um `ToonPayload` com hash SHA-256 da ementa original; a saída do LLM deve ser validada contra esses payloads antes de ser exibida ao usuário.
- **RF008**: O usuário deve poder editar o parecer gerado num editor rich text integrado, salvar na sua base de conhecimento pessoal (Firestore + Pinecone namespace privado) e fazer download do texto final.
- **RF009**: O sistema deve respeitar os limites de uso por plano (documentos/dia, máximo de processos armazenados) e atualizar contadores via transação atômica no Firestore.
- **RF010**: Toda interação com a API deve ser protegida por bearer token Firebase; o acesso a processos e base de conhecimento deve ser restrito ao `userId` proprietário.

---

## Requisitos não funcionais

- **RNF001 — LGPD**: Textos de processos enviados ao LLM devem passar por sanitização de PII antes da transmissão. Dados pessoais de terceiros nos autos (CPF, nome de partes não representadas) não devem ser armazenados em embeddings públicos.
- **RNF002 — Integridade jurídica**: Números de processo CNJ, nomes de relatores e datas de julgamento nunca podem ser modificados ou gerados pelo LLM. Violações detectadas pelo TOON devem invalidar a análise.
- **RNF003 — Performance**: A análise completa (upload → parecer final) deve ser concluída em menos de 30 segundos em condições normais de carga. O streaming SSE deve entregar o primeiro chunk em menos de 3 segundos.
- **RNF004 — Disponibilidade**: O sistema deve degradar graciosamente: se Gemini falhar, usar Groq; se Cohere falhar, usar scorer local. Nenhuma falha de provider externo deve resultar em erro 500 para o usuário.
- **RNF005 — Isolamento de dados**: A base de conhecimento privada de cada usuário (pareceres aprovados) deve ser armazenada em namespace exclusivo no Pinecone (`cli-{userId}`) e protegida por regras de segurança do Firestore.
- **RNF006 — Auditabilidade**: Toda análise deve registrar fontes utilizadas, scores de confiança e provider LLM usado, de forma rastreável no Firestore.
- **RNF007 — Escalabilidade**: A arquitetura de planos deve suportar de 1 (Free) a 20 usuários simultâneos (Enterprise) sem alteração de código.

---

## Critérios de aceite

- Upload de PDF extrai metadados corretamente em ≥ 95% dos casos com formato CNJ válido.
- A busca híbrida retorna resultados de pelo menos 2 fontes distintas em ≥ 80% das análises.
- O parecer gerado sempre cita fontes com número CNJ, tribunal e trecho — nunca campos vazios.
- O grau de confiança é sempre um número entre 0 e 100 e reflete corretamente a qualidade dos resultados recuperados.
- Nenhuma análise é entregue com `rerankScore < 0.5` ou com menos de 2 resultados válidos.
- A TOON detecta e bloqueia pareceres com números CNJ não presentes nos resultados recuperados.
- O build passa sem erros (`npm run release:check` — testes de regressão + avaliação gold + build).
- O sistema funciona em desktop e mobile (dashboard responsivo).
