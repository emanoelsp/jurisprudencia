# IurisPrudentIA — Contexto para Agentes de IA

Plataforma de análise jurídica assistida por IA para advogados brasileiros.

**Fluxo principal**: Upload de processo (PDF) → extração de metadados → busca híbrida (DataJud + Pinecone + LexML) → reranking (Cohere) → análise LLM com anti-alucinação (TOON) → parecer em streaming com grau de confiança → editor rich text → salva na base de conhecimento privada do usuário.

---

## Documentação obrigatória — leia antes de agir

- `docs/PRD.md` — requisitos funcionais e não funcionais completos
- `docs/ARCHITECTURE.md` — stack real, estrutura de pastas, módulos críticos
- `docs/AI_AGENT.md` — pipeline de IA, TOON, modelos, chunking, structured outputs
- `docs/AGENTS.md` — regras de desenvolvimento, o que nunca fazer
- `docs/DESIGN.md` — design system, componentes existentes, editor TipTap
- `docs/TASKS.md` — o que está feito, em andamento e no backlog
- `docs/TESTING.md` — testes existentes e a implementar
- `docs/DEPLOY.md` — variáveis de ambiente, checklist, seed de dados

---

## Stack resumida

Next.js 14 · TypeScript strict · Tailwind + shadcn/ui · Firebase Auth/Firestore/Storage · Pinecone · Gemini 2.5 Flash (→ Groq → OpenRouter) · Cohere rerank-v3.5 · Mercado Pago · Vercel

---

## Arquivos críticos

| Arquivo | Propósito |
|---------|-----------|
| `src/lib/rag.ts` | Pipeline RAG completo (extração → chunking → busca híbrida → rerank → TOON) |
| `src/lib/toon.ts` | Camada anti-alucinação — números CNJ são imutáveis |
| `src/lib/ai.ts` | Cliente LLM com fallback chain |
| `src/lib/guards.js` | Validação de escopo jurídico e schemas de saída do LLM |
| `src/lib/plans.ts` | Políticas de plano e limites de uso |
| `src/app/api/analyze/route.ts` | Endpoint principal de análise (streaming SSE) |
| `src/types/index.ts` | Todos os tipos centrais do sistema |

---

## Regras críticas (nunca violar)

1. **Nunca gerar ou modificar números de processo CNJ** — validados pelo TOON com hash SHA-256.
2. **Nunca baixar `MIN_RESULTS_FOR_ANALYSIS` (2) ou `MIN_RERANK_SCORE` (0.5)** sem aprovação explícita.
3. **Toda saída do LLM** passa por `validateJustificationSchema()` antes de chegar ao usuário.
4. **Toda rota de API** verifica bearer token Firebase via `server-auth.ts`.
5. **Nunca remover o fallback chain do LLM** (Gemini → Groq → OpenRouter).

---

## Comandos essenciais

```bash
npm run dev              # servidor de desenvolvimento
npm run release:check    # testes de regressão + gold + build (obrigatório antes do deploy)
npm run test:regression  # testes das guards
npm run test:gold        # avaliação do gold set RAG
npm run pinecone:create-index  # setup inicial do Pinecone
```
