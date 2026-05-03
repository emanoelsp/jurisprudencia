# Estratégia de Testes — IurisPrudentIA

## Testes existentes

### Testes de regressão das guards (`tests/regression-guards.test.js`)

Cobrem as funções de validação críticas em `src/lib/guards.js`:
- `isLegalScopeText()` — aceita/rejeita texto com base em keywords jurídicos e tamanho
- `validateExtractedMetadataSchema()` — valida schema dos metadados extraídos do processo
- `validateJustificationSchema()` — valida schema da saída estruturada do LLM
- `parseJustificationJson()` / `parseExtractedMetadataJson()` — parse + validação combinada

Rodar: `npm run test:regression`

### Avaliação gold set (`scripts/evaluate-gold.mjs`)

Avalia a qualidade do pipeline RAG + LLM contra um conjunto de casos conhecidos:
- Mede `retrieval_confidence`, `evidence_coverage` e `generation_risk` para cada caso
- Compara com scores esperados (thresholds definidos no gold set)
- Falha o build se a qualidade média cair abaixo do baseline

Rodar: `npm run test:gold`

### Script de release (`npm run release:check`)

Combina: `test:regression && test:gold && build`

Deve passar antes de qualquer deploy para produção.

---

## Testes a implementar

### Unitários com Jest — lógica de negócio crítica

| Módulo | O que testar |
|--------|-------------|
| `src/lib/toon.ts` | `createToonPayload()` — hash SHA-256 correto; `validateToonIntegrity()` — detecta número CNJ ausente; `serializeToonForPrompt()` — XML bem formado |
| `src/lib/rag.ts` | `chunkText()` — tamanho e overlap corretos; RRF formula — scores normalizados; `dedupeEprocResults()` — sem duplicatas |
| `src/lib/plans.ts` | Limites corretos por plano; `normalizePlan()` — não quebra em inputs inválidos |
| `src/lib/tenant.ts` | Namespace gerado corretamente para diferentes userIds |
| `src/lib/guards.js` | Já cobertos — expandir edge cases |

### E2E com Cypress — fluxos críticos

| Fluxo | Casos |
|-------|-------|
| Autenticação | Login e-mail, login Google, signup, logout, senha incorreta |
| Upload de processo | PDF válido, PDF inválido, arquivo não-PDF, limite de tamanho |
| Pipeline de análise | Análise completa com sucesso, análise com resultados insuficientes, timeout LLM |
| Editor e salvamento | Inserir parecer, editar, salvar na base, download |
| Planos | Atingir limite diário, upgrade de plano, webhook de pagamento (mock) |

### Testes de componente com React Testing Library

| Componente | Estados a testar |
|-----------|-----------------|
| `ConfidenceBadge` | Renderização correta para alta/media/baixa |
| `EprocResultCard` | Exibição de todos os campos, badge de fonte, "já utilizado" |
| Formulário de upload | Validação, drag-and-drop, feedback de erro |
| Pipeline de análise (SSE) | Estados loading → results → complete → error |
| Editor TipTap (quando implementado) | Inserção programática, estados idle/editing/saving/saved |

---

## Regras de teste

- Toda feature nova tem teste cobrindo o caminho feliz e pelo menos um caso de erro.
- Todo bug corrigido tem teste de regressão que reproduz o cenário antes da correção.
- Não testar detalhes internos de implementação — testar comportamento observável.
- Testes do TOON são obrigatórios: nenhuma mudança em `toon.ts` ou `guards.js` sem testes.
- Não criar mocks do Firestore para testes de integração — testar contra Firestore emulado.
- Rodar `npm run release:check` antes de qualquer PR/deploy.

---

## Scripts

```json
{
  "test:regression": "node --test tests/regression-guards.test.js",
  "test:gold": "node scripts/evaluate-gold.mjs",
  "release:check": "npm run test:regression && npm run test:gold && npm run build",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:e2e": "cypress open",
  "test:e2e:run": "cypress run",
  "test:ci": "npm run test:regression && npm run test:gold && jest && cypress run"
}
```
