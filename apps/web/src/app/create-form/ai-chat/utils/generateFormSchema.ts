import { Message, ToneKey, DocSchema } from "../types"
import { buildGenerationPrompt } from "./buildGenerationPrompt"
import { validateFormSchema } from "./validateFormSchema"

const callAI = async (systemPrompt: string, messages: Message[]): Promise<string> => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, messages, jsonMode: true })
  })
  const data = await response.json()
  return data.content
}

export const generateFormSchema = async (
  tone: ToneKey,
  conversationHistory: Message[],
  currentSchema?: any
): Promise<DocSchema> => {
  const systemPrompt = buildGenerationPrompt(tone, currentSchema)

  // Attempt 1
  const raw = await callAI(systemPrompt, conversationHistory)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Attempt 2 — ask model to fix its own output
    const fixMessages: Message[] = [
      ...conversationHistory,
      { role: "assistant", content: raw },
      { role: "user", content: "The output was not valid JSON. Return only the corrected JSON object, nothing else." }
    ]
    const retryRaw = await callAI(systemPrompt, fixMessages)
    parsed = JSON.parse(retryRaw)
  }

  // Zod validation — throws if schema shape is wrong
  return validateFormSchema(parsed)
}