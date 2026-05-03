# Regras do Agente de Desenvolvimento — IurisPrudentIA

Você é o agente principal de desenvolvimento deste projeto de IA jurídica.

---

## Regras obrigatórias

- Sempre leia PRD.md, ARCHITECTURE.md, AI_AGENT.md, DESIGN.md, TESTING.md e TASKS.md antes de agir.
- Antes de codar, explique o plano de implementação.
- Implemente uma etapa por vez — mudanças pequenas, revisáveis e seguras.
- **Nunca quebre funcionalidades existentes**: pipeline RAG, TOON, streaming SSE e autenticação são críticos.
- Sempre atualize TASKS.md após concluir uma tarefa.
- Sempre rode `npm run release:check` antes de considerar uma tarefa concluída.
- Corrija todos os erros de TypeScript e lint antes de finalizar.
- Não adicione dependências sem justificar no PR/tarefa.
- Use TypeScript estrito — sem `any` implícito.
- Use shadcn/ui sempre que houver componente equivalente.
- Use Tailwind CSS para todos os estilos.
- Firebase Auth para autenticação — nunca armazene tokens fora do contexto Firebase.
- Toda operação de banco usa Firestore via rotas de API — nunca acesso direto em componentes.
- Vercel como deploy padrão — nunca commitar `.env.local`.

---

## Regras específicas do domínio jurídico

- **Nunca gere ou modifique números de processo CNJ** — esses campos são imutáveis e validados pelo TOON.
- **Nunca altere o schema do ToonPayload** sem atualizar `validateToonIntegrity()` e `validateJustificationCitations()`.
- **Nunca remova ou baixe os thresholds de qualidade** (`MIN_RESULTS_FOR_ANALYSIS`, `MIN_RERANK_SCORE`) sem aprovação explícita — eles existem para prevenir pareceres com base em evidências insuficientes.
- **Toda nova fonte de dados** (tribunal, base pública, API) deve gerar `EprocResult` com campo `fonte` preenchido e `ToonPayload` associado.
- **Saídas do LLM** são sempre validadas por `validateJustificationSchema()` antes de chegar ao usuário.
- **Prompts importantes** devem ser versionados em `src/lib/prompts/`.

---

## Regras de segurança

- Toda rota de API deve verificar o bearer token via `server-auth.ts` antes de qualquer operação.
- Acesso a `Processo`, `JurisprudenciaCriada` e namespace Pinecone privado deve sempre verificar `userId` do token contra o documento.
- Dados de PII no texto do processo (CPF, nomes de terceiros) devem ser sanitizados antes de envio ao LLM e antes de geração de embeddings em namespace público.
- Nunca logar o conteúdo completo de processos — logar apenas `processoId`, `tribunal`, `userId` e métricas de performance.

---

## Fluxo de trabalho

1. Ler toda a documentação em `/docs`.
2. Criar plano detalhado — identificar arquivos afetados, riscos de regressão.
3. Atualizar TASKS.md: mover tarefa para "Em andamento".
4. Implementar a próxima tarefa (uma de cada vez).
5. Criar ou atualizar testes cobrindo o comportamento implementado.
6. Rodar `npm run release:check` (regressão + gold + build).
7. Corrigir todos os problemas antes de finalizar.
8. Mover tarefa para "Concluído" no TASKS.md.
9. Explicar o que foi feito e quais arquivos foram alterados.

---

## O que não fazer

- Não usar `console.log` com dados sensíveis do processo.
- Não usar `any` — tipar corretamente com os tipos de `src/types/index.ts`.
- Não contornar o TOON — nunca enviar texto ao LLM sem serializar os ToonPayloads.
- Não alterar `firestore.rules` ou `storage.rules` sem revisar o impacto de segurança.
- Não chamar a API DataJud sem respeitar `DATAJUD_REQUEST_DELAY_MS`.
- Não remover o fallback chain do LLM — o sistema precisa ser resiliente a falhas de provider.
- Não criar rotas de API sem autenticação — mesmo endpoints de consulta.
