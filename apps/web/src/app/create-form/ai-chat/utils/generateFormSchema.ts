import { Message, ToneKey, DocSchema } from "../types"
import { buildGenerationPrompt } from "./buildGenerationPrompt"
import { validateFormSchema } from "./validateFormSchema"
import { apiSend } from "@/lib/apiClient"

/** The model produced something unusable — as opposed to the request failing. */
export class SchemaGenerationError extends Error {}

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

  // Attempt 1. A transport failure (not signed in, rate limited, network) throws
  // out of callAI and must reach the caller unchanged — only the model's own bad
  // output is worth retrying.
  const raw = await callAI(systemPrompt, conversationHistory)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Attempt 2 — ask the model to fix its own output
    const fixMessages: Message[] = [
      ...conversationHistory,
      { role: "assistant", content: raw },
      { role: "user", content: "The output was not valid JSON. Return only the corrected JSON object, nothing else." }
    ]
    const retryRaw = await callAI(systemPrompt, fixMessages)
    try {
      parsed = JSON.parse(retryRaw)
    } catch {
      throw new SchemaGenerationError("The AI did not return valid JSON.")
    }
  }

  try {
    return validateFormSchema(parsed)
  } catch (err: any) {
    // Surface which field the model got wrong — every cause so far has been one
    // bad node rejecting the whole document.
    const issue = err?.issues?.[0]
    const where = issue ? `${issue.path?.join(".") || "schema"}: ${issue.message}` : "unexpected shape"
    throw new SchemaGenerationError(`The AI returned a form we could not read (${where}).`)
  }
}