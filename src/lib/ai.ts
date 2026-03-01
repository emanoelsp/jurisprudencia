// src/lib/ai.ts
// Usa SDK nativo @google/genai quando GEMINI_API_KEY está definida (mesmo padrão do semantic_agent).
// Fallback para OpenAI quando apenas OPENAI_API_KEY.

import { GoogleGenAI } from '@google/genai'

const geminiApiKey = process.env.GEMINI_API_KEY
const openAiApiKey = process.env.OPENAI_API_KEY

export const activeProvider = geminiApiKey ? 'gemini' : 'openai'
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

// ─── SDK nativo Gemini (@google/genai) - mesmo padrão do semantic_agent ─────
type AiClientType = {
  chat: {
    completions: {
      create: (params: {
        model: string
        messages: Array<{ role: string; content: string }>
        temperature?: number
        top_p?: number
        max_tokens?: number
        response_format?: { type: string }
      }) => Promise<{
        choices: Array<{ message: { content: string } }>
      }>
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
        create: async (params) => {
          const systemMsg = params.messages.find((m) => m.role === 'system')?.content || ''
          const userMsg = params.messages.find((m) => m.role === 'user')?.content || ''
          const config: Record<string, unknown> = {
            temperature: params.temperature ?? 0.1,
            topP: params.top_p ?? 0.6,
            maxOutputTokens: params.max_tokens ?? 2048,
          }
          if (systemMsg) config.systemInstruction = systemMsg

          const response = await ai.models.generateContent({
            model: params.model,
            contents: userMsg,
            config,
          })

          const text = (response.text ?? '').trim()
          return {
            choices: [{ message: { content: text } }],
          }
        },
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
  const OpenAI = require('openai').default
  client = new OpenAI({
    apiKey: openAiApiKey,
  })
}

export const aiClient = client
export const aiProvider = activeProvider
