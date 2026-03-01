# JurisprudencIA 🏛️

**Plataforma SaaS de Elite para Análise de Jurisprudência com IA**

Uma plataforma completa para advogados que combina RAG (Retrieval-Augmented Generation), Reranking, o modelo anti-alucinação **TOON** e streaming de resposta para construir peças jurídicas com precisão cirúrgica.

---

## 🎯 Funcionalidades

### ETAPA 1 — Frontend e Tools de Ingestão
- **Dashboard de Processos** com lista, status e filtros
- **Auto-Preenchimento por IA**: upload de PDF → extração automática de Número CNJ, Cliente e Natureza
- **Interface de Co-Criação Split-Screen**:
  - 🔵 Esquerdo: Resultados do eproc ordenados por Reranking com badges de confiança
  - 🟡 Direito: Editor de texto jurídico com botão "Inserir no Editor" por jurisprudência
- **Streaming em Tempo Real** da justificativa de relevância da IA

### ETAPA 2 — Backend, APIs e Persistência
- **Firebase Schema** completo: `processos`, `jurisprudencias`, `users`
- **Pipeline de IA com Streaming**:
  - PDF → Chunks → Vector Search (eproc mock) → Reranking → **TOON** → LLM → Stream
- **Base de Conhecimento**: jurisprudências aprovadas salvas com TOON preservado
- **TOON Anti-Alucinação**: zero confusão de números de processo e nomes

---

## 🏗️ Stack Técnica

| Camada       | Tecnologia                         |
|--------------|------------------------------------|
| Framework    | Next.js 14+ (App Router)           |
| Estilo       | Tailwind CSS                       |
| Auth         | Firebase Authentication            |
| Database     | Firestore                          |
| Storage      | Firebase Storage                   |
| Embeddings   | Gemini gemini-embedding-001          |
| LLM          | Gemini 2.0 Flash (streaming)       |
| Reranking    | Cohere rerank-multilingual-v3.0    |
| Anti-Aluc.   | **TOON** (Typed Object Notation)   |

---

## 🚀 Setup

### 1. Clone e instale as dependências
```bash
npm install
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.local.example .env.local
# Preencha todas as variáveis no .env.local
```

### 3. Configure Firebase
1. Crie um projeto em [firebase.google.com](https://firebase.google.com)
2. Ative: **Authentication** (Email/Password + Google), **Firestore**, **Storage** (opcional)
3. Copie as credenciais do SDK para `.env.local`
4. **Sem Firebase Storage?** Defina `NEXT_PUBLIC_SKIP_FIREBASE_STORAGE=true` – o processo salva apenas o texto extraído do PDF. Alternativas: Supabase Storage, Vercel Blob, Cloudflare R2.
4. Implante as regras: `firebase deploy --only firestore:rules`
5. Crie os índices: `firebase deploy --only firestore:indexes`

### 4. Configure Gemini (SDK @google/genai)
- Obtenha uma API Key em [Google AI Studio](https://aistudio.google.com/app/apikey)
- Adicione em `GEMINI_API_KEY`
- **Instale o SDK**: `npm install @google/genai` (mesmo padrão do projeto semantic_agent)
- Modelos padrão:
  - `AI_CHAT_MODEL=gemini-2.0-flash`
  - `AI_EMBEDDING_MODEL=text-embedding-004`

### 5. (Opcional) Cohere Reranking
- Para reranking real, obtenha API key em [cohere.com](https://cohere.com)
- Configure:
  - `COHERE_API_KEY`
  - `COHERE_RERANK_MODEL=rerank-v3.5` (opcional)
- Sem chave Cohere, o sistema usa reranking local como fallback.

### 6. Rode em desenvolvimento
```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### 7. DataJud CNJ (API Pública)

**DataJud – apenas URL e API Key**: A autenticação usa `Authorization: APIKey [Chave Pública]`. Não é necessária outra chave. Configure:

- `DATAJUD_API_KEY` – Chave Pública disponível na [Wiki DataJud](https://datajud-wiki.cnj.jus.br/)
- `DATAJUD_BASE_URL` – Opcional; padrão: `https://api-publica.datajud.cnj.jus.br`

**Fluxo RAG (sem mock)**: Upload PDF → extração de metadados (LLM) → busca jurisprudência (DataJud API como fonte principal; Pinecone opcional se configurado) → rerank → CF/88 do Planalto (IA identifica artigos aplicáveis) → TOON → justificativa LLM. Guard rails: `isLegalScopeText`. Temperatura 0.1, top_p 0.6, top 6–8 resultados.

**Tribunais**: Selecione um tribunal (ex.: TJSC, TJSP) – obrigatório para DataJud. A UI usa siglas; o DataJud usa aliases (`api_publica_tjsc`, `api_publica_tjsp`, etc.). Para "TODOS", apenas Pinecone é consultado.

**Arquitetura recomendada**:
- **Aba DataJud**: jurisprudência da API DataJud (busca full-text + fallback: últimos processos do tribunal)
- **Aba CF/88**: artigos constitucionais aplicáveis (Planalto + IA)
- **Aba Pareceres**: jurisprudências já salvas pelo usuário em Firestore
- **LLM**: temperatura 0.1, top_p 0.6 (respostas determinísticas)

**Ingestão opcional (Pinecone)**: Se quiser busca vetorial em vez de full-text:
1. Preencha `PINECONE_API_KEY` e `PINECONE_HOST` (ou `PINECONE_INDEX` para conexão por nome)
2. Crie o índice com dimensão 3072 (gemini-embedding-001): `npm run pinecone:create-index`
3. Rode a aplicação (`npm run dev`).
4. Execute uma ingestão inicial via HTTP:
```bash
curl -X POST http://localhost:3000/api/admin/datajud-ingest \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tribunalAlias": "api_publica_tjsp",
    "userId": "uid-do-cliente",
    "namespace": "cli-uid-do-cliente",
    "size": 20,
    "dateFrom": "2024-01-01",
    "dateTo": "2024-12-31",
    "dryRun": false
  }'
```
5. Após ingestão, a busca da análise usa o Pinecone com metadados `fonte=datajud_cnj`.

**Seed automático no primeiro run**: Ao iniciar a aplicação (`npm run dev`), a CF/88 e o Código Penal são buscados dos links oficiais do Planalto e inseridos no Pinecone (namespace `legislacao`) automaticamente. A flag `.legislacao-seeded` indica que o seed já foi executado. Para forçar o seed manualmente (ex.: em Vercel):
```bash
curl -X POST http://localhost:3000/api/setup/seed-legislacao
```
Em localhost não requer auth; em produção, configure `SETUP_SECRET` e use `Authorization: Bearer <SETUP_SECRET>`.

**Ingestão manual** (reingestão via admin): Para injetar Constituição Federal e Código Penal no namespace de legislação:

1. Configure `PINECONE_LEGISLACAO_NAMESPACE=legislacao` em `.env.local` (opcional; padrão: `legislacao`).
2. Execute:
```bash
curl -X POST http://localhost:3000/api/admin/legislacao-ingest \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"fonte":"ambos"}'
```
3. Parâmetros: `fonte` = `"cf"` | `"cp"` | `"ambos"` (padrão: ambos); `dryRun: true` para validar sem gravar.
4. A busca RAG consulta o namespace de legislação quando Pinecone está configurado (ex.: DataJud vazio).

Observações:
- Use `dryRun: true` para validar sem gravar vetores.
- Respeite limites e termos do DataJud/CNJ; ajuste `DATAJUD_REQUEST_DELAY_MS` para reduzir pressão na API pública.
- **DataJud é a fonte principal** quando tribunal está selecionado; Pinecone é usado apenas se configurado e DataJud retornar vazio.
- Namespace por cliente:
  - Se enviar `namespace`, ele será usado.
  - Se enviar `userId`, o sistema gera automaticamente `cli-<userId-sanitizado>`.
  - Se não enviar nenhum, usa `PINECONE_NAMESPACE` (ou default).

### 8. Gate de release (anti-regressão)
Antes de produção, rode:
```bash
npm run release:check
```
Esse comando executa:
- `test:regression` (guardrails)
- `test:gold` (100 casos ouro offline com thresholds)
- `build`

---

## 🔬 Modelo TOON (Anti-Alucinação)

O **TOON (Typed Object-Oriented Notation)** é a camada estrutural entre o Reranker e o LLM final que garante integridade factual:

```typescript
interface ToonPayload {
  _type: 'ToonJurisprudencia'
  numeroProcesso: string  // IMUTÁVEL - nunca alterado pela IA
  tribunal: string        // IMUTÁVEL
  relator: string         // IMUTÁVEL
  dataJulgamento: string  // IMUTÁVEL
  ementaHash: string      // SHA-256 para verificação de integridade
  ementaOriginal: string  // verbatim do eproc
}
```

O LLM recebe os dados TOON em XML com instruções explícitas de nunca modificar os campos `IMMUTABLE_FACTS`. Após a geração, o sistema valida o output com regex para garantir que nenhum número de processo foi inventado.

---

## 🗄️ Schema Firestore

### Collection: `processos`
```typescript
{
  id: string
  numero: string          // CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  cliente: string
  natureza: string
  vara?: string
  tribunal?: string
  dataProtocolo?: string
  textoOriginal: string   // texto extraído do PDF
  teseFinal?: string      // peça construída pelo advogado
  scoreIa?: number        // 0-100
  aprovadoPeloAdvogado: boolean
  status: 'pending' | 'processing' | 'analyzed' | 'approved' | 'error'
  userId: string
  storageUrl?: string
  createdAt: string
  updatedAt: string
}
```

### Collection: `jurisprudencias`
```typescript
{
  id: string
  processoId: string
  titulo: string
  ementa: string
  tribunal: string
  numero: string          // verbatim do eproc via TOON
  relator: string         // verbatim do eproc via TOON
  dataJulgamento: string
  justificativaIa: string // análise de relevância com streaming
  confianca: number       // 0-100, score original do reranker
  toonData: ToonPayload   // payload TOON completo para auditoria
  edicaoManual?: string   // edições do advogado
  aprovado: boolean
  userId: string
  createdAt: string
}
```

---

## 🔄 Pipeline de IA

```
PDF Upload
    ↓
extractTextFromBuffer (pdf-parse)
    ↓
extractMetadata (Gemini, JSON mode) ← Auto-Preenchimento
    ↓
chunkText (1000 chars, 200 overlap)
    ↓
generateEmbedding (text-embedding-004)
    ↓
searchEproc (Vector DB: Pinecone/Weaviate/pgvector)
    ↓
rerankResults (Cohere rerank-multilingual-v3.0)
    ↓
enrichWithToon (createToonPayload)  ← Anti-Alucinação
    ↓
serializeToonForPrompt (XML com IMMUTABLE_FACTS)
    ↓
Gemini Streaming (com TOON anchors no system prompt)
    ↓
validateToonIntegrity (verifica números no output)
    ↓
Stream SSE → Cliente React
```

---

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── layout.tsx              # Root layout com fonts + providers
│   ├── page.tsx                # Login / Landing page
│   ├── globals.css             # Design tokens + componentes
│   ├── dashboard/
│   │   ├── layout.tsx          # Sidebar navigation
│   │   ├── page.tsx            # Visão geral com stats
│   │   ├── processos/
│   │   │   └── page.tsx        # Lista + Upload + Auto-fill modal
│   │   ├── analisar/[id]/
│   │   │   └── page.tsx        # Interface de Co-Criação Split-Screen
│   │   └── base-conhecimento/
│   │       └── page.tsx        # Base de conhecimento
│   └── api/
│       ├── analyze/route.ts    # Pipeline RAG + TOON + Streaming
│       ├── ingest/route.ts     # PDF upload + metadata extraction
│       ├── processes/route.ts  # CRUD processos
│       └── jurisprudencia/     # Salvar jurisprudência criada
├── components/
│   ├── ui/
│   │   ├── Logo.tsx            # Logo "Jurisprudenc|IA|"
│   │   └── ConfidenceBadge.tsx # Badge alta/média/baixa
│   └── features/
│       └── EprocResultCard.tsx # Card com streaming justificativa
├── lib/
│   ├── firebase.ts             # Firebase client SDK
│   ├── firebase-admin.ts       # Firebase Admin SDK (server)
│   ├── auth-context.tsx        # Auth provider + hooks
│   ├── rag.ts                  # Pipeline: extract, chunk, embed, search, rerank
│   ├── toon.ts                 # TOON model anti-alucinação
│   └── utils.ts                # Formatadores e helpers
└── types/
    └── index.ts                # TypeScript types completos
```

---

## 🎨 Design System

### Paleta de Cores
| Token              | Hex       | Uso                          |
|--------------------|-----------|------------------------------|
| `brand-navy`       | `#0B1628` | Background principal         |
| `brand-navylt`     | `#132040` | Cards e sidebar              |
| `brand-indigo`     | `#4F46E5` | **"IA"** + CTAs primários    |
| `brand-gold`       | `#C9A94E` | Destaques de elite + badges  |
| `brand-cream`      | `#F8F5EF` | Texto principal              |
| `brand-slate`      | `#8B96B0` | Texto secundário             |
| `brand-border`     | `#1E2D4A` | Bordas e divisores           |

### Tipografia
- **Display**: Playfair Display (serifada clássica)
- **Body**: Source Sans 3 (clean, legível)
- **Mono**: JetBrains Mono (números CNJ)

---

## 📜 Licença

Propriedade de JurisprudencIA. Todos os direitos reservados.
### 6.1 Auth server-side obrigatório nas APIs
- As rotas `/api/*` agora exigem `Authorization: Bearer <Firebase ID Token>`.
- O `uid` é derivado exclusivamente do token validado no backend.
- Não envie `userId` no body para autorização.

### 6.2 Planos e billing
- Cadastro exige seleção de plano.
- Plano `Free`:
  - 7 dias de teste
  - 2 documentos por dia
- Anti-abuso de free por e-mail:
  - e-mails que já usaram free ficam registrados em `billing_free_email_registry`.
  - não é possível excluir conta e recriar para renovar free no mesmo e-mail.
- Upgrade:
  - Dashboard → `Planos` → `Fazer upgrade`
  - Checkout via Mercado Pago (`/api/billing/checkout`)
  - webhook em `/api/billing/webhook`
