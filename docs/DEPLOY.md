# Deploy — IurisPrudentIA

## Plataforma

Vercel (Next.js 14 App Router)

---

## Checklist antes do deploy

- [ ] `npm run release:check` (regressão + gold + build) passa sem erros
- [ ] TypeScript sem erros (`npx tsc --noEmit`)
- [ ] Testar upload de PDF → análise completa → parecer
- [ ] Testar login (e-mail + Google)
- [ ] Testar fluxo de pagamento (Mercado Pago sandbox)
- [ ] Testar responsividade mobile
- [ ] Verificar que todas as variáveis de ambiente estão configuradas no painel Vercel

---

## Variáveis de ambiente obrigatórias

```env
# Firebase (cliente — NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (servidor — NUNCA expor ao cliente)
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# IA — LLM e Embedding
GEMINI_API_KEY=
AI_CHAT_MODEL=gemini-2.5-flash
AI_EMBEDDING_MODEL=gemini-embedding-001

# Pinecone
PINECONE_API_KEY=
PINECONE_HOST=
PINECONE_INDEX=jurisprudencia
PINECONE_NAMESPACE=jurisprudencia_publica

# Reranking
COHERE_API_KEY=
COHERE_RERANK_MODEL=rerank-v3.5

# DataJud CNJ
DATAJUD_API_KEY=
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
DATAJUD_REQUEST_DELAY_MS=120

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=

# STJ CKAN
STJ_CKAN_BASE=https://dadosabertos.web.stj.jus.br/api/3/action

# Configurações do pipeline
MIN_RESULTS_FOR_ANALYSIS=2
MIN_RERANK_SCORE=0.5
LEXML_ENABLED=true
SKIP_LEGISLACAO_SEED=true      # sempre true em produção (seed via /api/setup)
```

---

## Variáveis opcionais (fallback LLM)

```env
GROQ_API_KEY=             # fallback LLM 1
OPENROUTER_API_KEY=       # fallback LLM 2
OPENAI_API_KEY=           # fallback LLM 3 (opcional)
```

---

## Variáveis opcionais — Observabilidade, Cache e Admin

```env
# Langfuse — traces de LLM (https://cloud.langfuse.com)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com   # opcional — padrão cloud.langfuse.com

# Upstash Redis — cache L2 para embeddings (https://console.upstash.com)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Vercel Cron — autenticação do job de ingestão STJ
# Vercel injeta automaticamente em /api/cron/stj-ingest (vercel.json)
CRON_SECRET=                              # gere com: openssl rand -hex 32

# Admin dashboard (/dashboard/admin) — e-mail do admin
NEXT_PUBLIC_ADMIN_EMAIL=                  # e.g. admin@escritorio.com.br
```

### Ativação do Cron STJ

O Vercel Cron requer:
1. `CRON_SECRET` configurado nas env vars da Vercel
2. `vercel.json` commitado na raiz (já incluído)
3. Deploy no Vercel — Cron não roda em `localhost`

Teste manual via painel: `/dashboard/admin` → "Executar ingestão STJ"  
Ou via cURL: `curl -X GET https://sua-url.vercel.app/api/cron/stj-ingest -H "Authorization: Bearer {CRON_SECRET}"`

---

## Configurações Next.js para Vercel

`next.config.js` já inclui:
- `serverComponentsExternalPackages: ['pdf-parse', 'firebase-admin']`
- `instrumentationHook: true` (seed de legislação no boot — desabilitado em prod via `SKIP_LEGISLACAO_SEED=true`)
- Imagens do Firebase Storage permitidas

---

## Seed de legislação em produção

O seed automático de CF/88 e Código Penal no Pinecone **não roda** em produção (Vercel serverless não permite I/O de arquivo).

Para fazer o seed inicial ou atualizar a base de legislação:
1. Configurar as variáveis de ambiente localmente
2. Rodar `curl -X POST https://sua-url.vercel.app/api/setup` com header de admin

---

## Regras

- Nunca commitar `.env.local` — está no `.gitignore`
- Firebase config pública (`NEXT_PUBLIC_*`) pode estar no cliente, mas `FIREBASE_ADMIN_PRIVATE_KEY` nunca
- `MERCADOPAGO_WEBHOOK_SECRET` nunca exposto ao cliente
- Todos os secrets ficam no painel da Vercel → Settings → Environment Variables
- Usar environments distintos: Preview (branch) e Production (main)

---

## Ingestão de dados (pós-deploy)

```bash
# Seed CF/88 + Código Penal (primeira vez ou atualização)
POST /api/setup

# Ingestão DataJud (admin)
POST /api/admin/datajud-ingest

# Ingestão STJ CKAN (admin)
POST /api/admin/stj-ckan-ingest

# Ingestão de legislação via LexML (admin)
POST /api/admin/legislacao-ingest
```

Endpoints de admin devem ser chamados com header `Authorization: Bearer {ADMIN_SECRET}`.
