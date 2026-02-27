import OpenAI from 'openai'

const geminiApiKey = process.env.GEMINI_API_KEY
const openAiApiKey = process.env.OPENAI_API_KEY

const activeProvider = geminiApiKey ? 'gemini' : 'openai'
const activeApiKey = geminiApiKey || openAiApiKey

if (!activeApiKey) {
  throw new Error('Missing API key. Set GEMINI_API_KEY (recommended) or OPENAI_API_KEY.')
}

const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/'

export const aiClient = new OpenAI({
  apiKey: activeApiKey,
  baseURL: activeProvider === 'gemini' ? geminiBaseUrl : undefined,
})

export const aiModels = {
  chat: process.env.AI_CHAT_MODEL || (activeProvider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'),
  embedding:
    process.env.AI_EMBEDDING_MODEL ||
    (activeProvider === 'gemini' ? 'text-embedding-004' : 'text-embedding-3-small'),
}

export const aiProvider = activeProvider
