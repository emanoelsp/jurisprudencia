// src/lib/ai.ts
// Chat: Gemini (primário) → Groq llama-3.1-8b-instant → OpenRouter llama-3.1-8b-instruct:free
// Embeddings: Gemini ou OpenAI (sem fallback automático neste arquivo)

import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'

const geminiApiKey = process.env.GEMINI_API_KEY
const openAiApiKey = process.env.OPENAI_API_KEY
const groqApiKey = process.env.GROQ_API_KEY
const openrouterApiKey = process.env.OPENROUTER_API_KEY

export const activeProvider = geminiApiKey ? 'gemini' : 'openai'

export const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'
export const OPENROUTER_CHAT_MODEL =
  process.env.OPENROUTER_CHAT_MODEL || 'meta-llama/llama-3.1-8b-instruct:free'

export const aiModels = {
  chat:
    process.env.AI_CHAT_MODEL ||
    (activeProvider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'),
  embedding:
    process.env.AI_EMBEDDING_MODEL ||
    (activeProvider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small'),
}

if (!geminiApiKey && !openAiApiKey) {
  throw new Error('Missing API key. Set GEMINI_API_KEY (recommended) or OPENAI_API_KEY.')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ChatCompletionParams = {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  top_p?: number
  max_tokens?: number
  response_format?: { type: string }
}

type ChatCompletionResult = {
  choices: Array<{ message: { content: string } }>
}

function isRetryableChatError(err: unknown): boolean {
  const e = err as Record<string, unknown> & { cause?: { status?: number }; code?: string | number }
  const status =
    (e?.status as number) ??
    (e?.statusCode as number) ??
    (typeof e?.cause === 'object' && e.cause ? (e.cause as { status?: number }).status : undefined)
  if (status === 429 || status === 503) return true
  if (typeof status === 'number' && status >= 500) return true
  const code = e?.code
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT') return true
  if (code === 8 || code === 'RESOURCE_EXHAUSTED') return true
  const msg = String(
    err instanceof Error ? err.message : typeof e?.message === 'string' ? e.message : ''
  ).toLowerCase()
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) return true
  if (msg.includes('resource exhausted') || msg.includes('overloaded')) return true
  if (msg.includes('econnreset') || msg.includes('timeout') || msg.includes('timed out')) return true
  if (msg.includes('fetch failed') || msg.includes('socket hang up')) return true
  return false
}

async function geminiGenerateOnce(
  ai: GoogleGenAI,
  params: ChatCompletionParams
): Promise<ChatCompletionResult> {
  const systemMsg = params.messages.find((m) => m.role === 'system')?.content || ''
  const userMsg = params.messages.find((m) => m.role === 'user')?.content || ''
  const config: Record<string, unknown> = {
    temperature: params.temperature ?? 0.1,
    topP: params.top_p ?? 0.6,
    maxOutputTokens: params.max_tokens ?? 2048,
  }
  if (systemMsg) config.systemInstruction = systemMsg
  if (params.response_format?.type === 'json_object') {
    config.responseMimeType = 'application/json'
  }

  const response = await ai.models.generateContent({
    model: params.model,
    contents: userMsg,
    config,
  })

  const text = (response.text ?? '').trim()
  return {
    choices: [{ message: { content: text } }],
  }
}

/** Gemini com 1 retry em 429 (4s), igual ao fluxo anterior. */
async function tryGeminiChat(ai: GoogleGenAI, params: ChatCompletionParams): Promise<ChatCompletionResult> {
  try {
    return await geminiGenerateOnce(ai, params)
  } catch (err: unknown) {
    const e = err as { status?: number; statusCode?: number }
    const is429 = e?.status === 429 || e?.statusCode === 429
    if (is429) {
      await sleep(4000)
      return await geminiGenerateOnce(ai, params)
    }
    throw err
  }
}

let groqClient: OpenAI | null = null
let openrouterClient: OpenAI | null = null

function getGroqClient(): OpenAI | null {
  if (!groqApiKey) return null
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  }
  return groqClient
}

function getOpenRouterClient(): OpenAI | null {
  if (!openrouterApiKey) return null
  if (!openrouterClient) {
    openrouterClient = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
        'X-Title': 'JurisprudencIA',
      },
    })
  }
  return openrouterClient
}

async function tryOpenAiCompatibleChat(
  client: OpenAI,
  model: string,
  params: ChatCompletionParams
): Promise<ChatCompletionResult> {
  const body: OpenAI.Chat.ChatCompletionCreateParams = {
    model,
    messages: params.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    temperature: params.temperature ?? 0.1,
    top_p: params.top_p ?? 0.6,
    max_tokens: params.max_tokens ?? 2048,
  }
  if (params.response_format?.type === 'json_object') {
    body.response_format = { type: 'json_object' }
  }
  try {
    return (await client.chat.completions.create(body)) as ChatCompletionResult
  } catch (first: unknown) {
    const msg = String((first as Error)?.message ?? '').toLowerCase()
    if (params.response_format?.type === 'json_object' && (msg.includes('response_format') || msg.includes('json'))) {
      delete body.response_format
      return (await client.chat.completions.create(body)) as ChatCompletionResult
    }
    throw first
  }
}

/**
 * Ordem: Gemini → Groq → OpenRouter (apenas provedores com API key).
 * Erros não recuperáveis propagam; falhas recuperáveis tentam o próximo.
 */
export async function chatCompletionWithFallbacks(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  let lastErr: unknown

  if (geminiApiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    try {
      const out = await tryGeminiChat(ai, params)
      console.log('[ai] chat via gemini', params.model)
      return out
    } catch (err) {
      lastErr = err
      if (!isRetryableChatError(err)) throw err
      console.warn('[ai] Gemini indisponível, tentando Groq/OpenRouter', err)
    }
  } else if (openAiApiKey) {
    const oa = new OpenAI({ apiKey: openAiApiKey })
    try {
      const out = (await oa.chat.completions.create({
        model: params.model,
        messages: params.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: params.temperature ?? 0.1,
        top_p: params.top_p ?? 0.6,
        max_tokens: params.max_tokens ?? 2048,
        ...(params.response_format?.type === 'json_object'
          ? { response_format: { type: 'json_object' } }
          : {}),
      })) as ChatCompletionResult
      console.log('[ai] chat via openai', params.model)
      return out
    } catch (err) {
      lastErr = err
      if (!isRetryableChatError(err)) throw err
      console.warn('[ai] OpenAI indisponível, tentando Groq/OpenRouter', err)
    }
  }

  const groq = getGroqClient()
  if (groq) {
    try {
      const out = await tryOpenAiCompatibleChat(groq, GROQ_CHAT_MODEL, params)
      console.log('[ai] chat via groq', GROQ_CHAT_MODEL)
      return out
    } catch (err) {
      lastErr = err
      if (!isRetryableChatError(err)) throw err
      console.warn('[ai] Groq falhou, tentando OpenRouter', err)
    }
  }

  const or = getOpenRouterClient()
  if (or) {
    try {
      const out = await tryOpenAiCompatibleChat(or, OPENROUTER_CHAT_MODEL, params)
      console.log('[ai] chat via openrouter', OPENROUTER_CHAT_MODEL)
      return out
    } catch (err) {
      lastErr = err
      throw err
    }
  }

  throw lastErr ?? new Error('Nenhum provedor de chat disponível (configure GROQ_API_KEY ou OPENROUTER_API_KEY para fallback).')
}

// ─── Cliente unificado (embeddings + chat com fallback) ───────────────────────
type AiClientType = {
  chat: {
    completions: {
      create: (params: ChatCompletionParams) => Promise<ChatCompletionResult>
    }
  }
  embeddings: {
    create: (params: { model: string; input: string | string[] }) => Promise<{
      data: Array<{ embedding: number[] }>
    }>
  }
}

let client: AiClientType

if (activeProvider === 'gemini' && geminiApiKey) {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey })

  client = {
    chat: {
      completions: {
        create: (params) => chatCompletionWithFallbacks(params),
      },
    },
    embeddings: {
      create: async (params) => {
        const input = params.input
        const texts = Array.isArray(input) ? input : [input]
        const response = await ai.models.embedContent({
          model: params.model,
          contents: texts,
        })

        const embeddings = (response.embeddings ?? []).map((e: { values?: number[] }) => ({
          embedding: e.values ?? [],
        }))
        return { data: embeddings }
      },
    },
  }
} else {
  const oa = new OpenAI({
    apiKey: openAiApiKey,
  })

  client = {
    chat: {
      completions: {
        create: (params) => chatCompletionWithFallbacks(params),
      },
    },
    embeddings: oa.embeddings as AiClientType['embeddings'],
  }
}

export const aiClient = client
export const aiProvider = activeProvider
