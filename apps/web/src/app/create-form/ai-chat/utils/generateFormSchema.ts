import { Message, ToneKey, DocSchema } from "../types"
import { buildGenerationPrompt } from "./buildGenerationPrompt"
import { validateFormSchema } from "./validateFormSchema"
import { apiSend } from "@/lib/apiClient"

const callAI = async (systemPrompt: string, messages: Message[]): Promise<string> => {
  const result = await apiSend<{ content: string }>("/api/ai/chat", "POST", {
    systemPrompt,
    messages,
    jsonMode: true
  })

  // Surface auth/rate-limit/server failures instead of letting `undefined`
  // reach JSON.parse and surface as a confusing syntax error.
  if (!result.ok) throw new Error(result.error || "AI request failed")
  if (typeof result.data?.content !== "string") throw new Error("Invalid response format received from AI")

  return result.data.content
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