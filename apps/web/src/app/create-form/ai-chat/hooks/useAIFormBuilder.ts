import { useState, useCallback } from "react"
import { Phase, Message, ToneKey, DocSchema } from "../types"
import { buildElicitationPrompt } from "../utils/buildElicitationPrompt"
import { generateFormSchema } from "../utils/generateFormSchema"

const READY_TOKEN = "READY_TO_GENERATE"

export const useAIFormBuilder = (getCurrentSchema?: () => any) => {
  const [phase, setPhase] = useState<Phase>("eliciting")
  const [messages, setMessages] = useState<Message[]>([])
  const [tone, setTone] = useState<ToneKey | null>("professional")
  const [generatedSchema, setGeneratedSchema] = useState<DocSchema | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sendMessage = useCallback(async (userText: string) => {
    if (!tone) return
    setLoading(true)
    setError(null)

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: userText }
    ]
    setMessages(updatedMessages)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: buildElicitationPrompt(tone, getCurrentSchema?.()),
          messages: updatedMessages
        })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch response from AI")
      }
      const assistantText: string = data.content
      if (typeof assistantText !== "string") {
        throw new Error("Invalid response format received from AI")
      }

      const withAssistant: Message[] = [
        ...updatedMessages,
        { role: "assistant", content: assistantText }
      ]
      setMessages(withAssistant)

      if (assistantText.includes(READY_TOKEN)) {
        // Strip the token from displayed message
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: m.content.replace(READY_TOKEN, "").trim() }
            : m
        ))
        setPhase("generating")
        await runGeneration(tone, withAssistant)
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [messages, tone, getCurrentSchema])

  const runGeneration = async (t: ToneKey, history: Message[]) => {
    setLoading(true)
    try {
      const currentSchema = getCurrentSchema?.()
      const schema = await generateFormSchema(t, history, currentSchema)
      setGeneratedSchema(schema)
      setPhase("preview")
    } catch (err) {
      setError("Failed to generate a valid form schema. Try regenerating.")
      setPhase("error")
    } finally {
      setLoading(false)
    }
  }

  const regenerate = useCallback(() => {
    if (!tone) return
    setPhase("generating")
    runGeneration(tone, messages)
  }, [tone, messages, getCurrentSchema])

  const editPrompt = useCallback(() => {
    setPhase("eliciting")
    setGeneratedSchema(null)
    setError(null)
  }, [])

  const acceptSchema = useCallback((onAccept: (schema: DocSchema) => void) => {
    if (generatedSchema) onAccept(generatedSchema)
  }, [generatedSchema])

  const setToneAndStart = useCallback((t: ToneKey) => {
    setTone(t)
    setMessages([])
    setPhase("eliciting")
    setGeneratedSchema(null)
    setError(null)
  }, [])

  return {
    phase, messages, tone, setTone, generatedSchema, error, loading,
    sendMessage, setToneAndStart, regenerate, editPrompt, acceptSchema
  }
}