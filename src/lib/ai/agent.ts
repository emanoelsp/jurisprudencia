// Agente jurídico – wrapper para invocação do LLM com contexto jurídico
// Inspirado no semantic_agent/lib/agent.ts

import { aiClient, aiModels } from './ai'

export interface JuridicalAgentInput {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

export interface JuridicalAgentOutput {
  content: string
}

/**
 * Invoca o LLM para tarefas jurídicas (justificativas, análise, etc.).
 * Parâmetros determinísticos (temp 0.1) para reduzir alucinações.
 * Extensível para function calling quando tools forem integradas.
 */
export async function invokeJuridicalAgent(
  input: JuridicalAgentInput
): Promise<JuridicalAgentOutput> {
  const response = await aiClient.chat.completions.create({
    model: aiModels.chat,
    temperature: input.temperature ?? 0.1,
    top_p: 0.6,
    max_tokens: input.maxTokens ?? 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ],
  })

  const content = response.choices?.[0]?.message?.content ?? ''
  if (!content.trim()) {
    throw new Error('Resposta vazia do modelo')
  }

  return { content }
}
