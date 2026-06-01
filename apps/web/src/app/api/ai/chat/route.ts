import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, messages, jsonMode } = await req.json()

    if (!systemPrompt || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing systemPrompt or messages" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured (neither GOOGLE_API_KEY nor GEMINI_API_KEY found)" },
        { status: 500 }
      )
    }

    // Initialize the new GoogleGenAI SDK client
    const ai = new GoogleGenAI({ apiKey })

    // Format chat history to comply with Gemini API constraints:
    // 1. Ensure message content is never empty (prevents 400 Bad Request).
    // 2. Map 'assistant' role to 'model'.
    const formatted = messages.map((msg: { role: string; content: string }) => {
      let content = (msg.content || "").trim()
      if (!content) {
        content = "..."
      }
      return {
        role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
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
  } catch (err: any) {
    console.error("[/api/ai/chat] Error:", err?.message || err)
    return NextResponse.json(
      { error: "AI request failed", details: err?.message },
      { status: 500 }
    )
  }
}
