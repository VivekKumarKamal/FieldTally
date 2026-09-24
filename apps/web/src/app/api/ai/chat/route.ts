import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"
import { getRequestContext, jsonError, unauthorized, serverError, readJsonBody } from "@/lib/supabaseServer"
import { rateLimit } from "@/lib/rateLimit"

/**
 * This route spends money on every call, so it is gated twice: the caller must
 * be signed in, and each account gets a capped number of generations per window.
 * Without both, anyone who finds the URL can drain the project's Gemini quota.
 */
const REQUESTS_PER_WINDOW = 20
const WINDOW_MS = 60_000

/** Guard rails on the prompt itself — tokens are billed by size. */
const MAX_MESSAGES = 60
const MAX_TOTAL_CHARS = 100_000
const MAX_SYSTEM_PROMPT_CHARS = 50_000

interface ChatMessage {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getRequestContext(req)

    if (!userId) {
      return unauthorized("You must be signed in to use AI form generation.")
    }

    const { allowed, retryAfter } = rateLimit(`ai:${userId}`, {
      limit: REQUESTS_PER_WINDOW,
      windowMs: WINDOW_MS,
    })

    if (!allowed) {
      return NextResponse.json(
        { error: `Too many AI requests. Please wait ${retryAfter}s and try again.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      )
    }

    const body = await readJsonBody<{ systemPrompt?: string; messages?: ChatMessage[]; jsonMode?: boolean }>(req)

    if (!body) {
      return jsonError("Invalid JSON body", 400)
    }

    const { systemPrompt, messages, jsonMode } = body

    if (!systemPrompt || typeof systemPrompt !== "string" || !Array.isArray(messages)) {
      return jsonError("Missing systemPrompt or messages", 400)
    }

    if (systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS) {
      return jsonError("System prompt is too large", 413)
    }

    if (messages.length > MAX_MESSAGES) {
      return jsonError(`Conversation is too long (max ${MAX_MESSAGES} messages)`, 413)
    }

    const totalChars = messages.reduce((sum, msg) => sum + (typeof msg?.content === "string" ? msg.content.length : 0), 0)
    if (totalChars > MAX_TOTAL_CHARS) {
      return jsonError("Conversation is too large", 413)
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.error("[/api/ai/chat] No GOOGLE_API_KEY or GEMINI_API_KEY configured")
      return jsonError("AI is not configured on this server.", 503)
    }

    // Initialize the new GoogleGenAI SDK client
    const ai = new GoogleGenAI({ apiKey })

    // Format chat history to comply with Gemini API constraints:
    // 1. Ensure message content is never empty (prevents 400 Bad Request).
    // 2. Map 'assistant' role to 'model'.
    const formatted = messages.map((msg: ChatMessage) => {
      let content = (msg?.content || "").trim()
      if (!content) {
        content = "..."
      }
      return {
        role: msg?.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: content }]
      }
    })

    // 3. Merge consecutive messages with the same role.
    const merged: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = []
    for (const msg of formatted) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        merged[merged.length - 1].parts[0].text += "\n\n" + msg.parts[0].text
      } else {
        merged.push(msg)
      }
    }

    // 4. Ensure the last message in the sequence is from the 'user'
    if (merged.length > 0 && merged[merged.length - 1].role === "model") {
      merged.push({
        role: "user",
        parts: [{ text: "Please continue and generate the form JSON schema based on the above discussion." }]
      })
    } else if (merged.length === 0) {
      merged.push({
        role: "user",
        parts: [{ text: "Hello" }]
      })
    }

    // Call the model via generateContent
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: merged,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: jsonMode ? "application/json" : undefined,
        temperature: jsonMode ? 0.1 : undefined
      }
    })

    const text = response.text || ""

    return NextResponse.json({ content: text })
  } catch (err: unknown) {
    // The upstream error can echo the prompt or key material — log it, don't return it.
    return serverError("/api/ai/chat", err)
  }
}
