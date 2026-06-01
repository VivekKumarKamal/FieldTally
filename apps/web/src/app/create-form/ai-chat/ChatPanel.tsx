"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, X, Bot, User, ArrowRight, Play, RefreshCw, Pencil } from "lucide-react";
import { TONES } from "./constants/tones";
import { ToneKey, Message } from "./types";
import { useAIFormBuilder } from "./hooks/useAIFormBuilder";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySchema: (schema: any, title: string) => void;
  currentFormTitle: string;
  getCurrentSchema?: () => any;
}

const SUGGESTIONS = [
  { label: "Create a Contact Form", prompt: "I need a contact form with name, email, phone and message" },
  { label: "Generate Customer Survey", prompt: "I need a customer feedback survey with satisfaction ratings" },
  { label: "Safety Audit Form", prompt: "I need a site safety inspection form with GPS, photos, signatures and conditional logic" },
  { label: "Hiring Application Form", prompt: "I need a job application form to collect candidate details" }
];

export default function ChatPanel({ isOpen, onClose, onApplySchema, currentFormTitle, getCurrentSchema }: ChatPanelProps) {
  const {
    phase, messages, tone, setTone, generatedSchema, error, loading,
    sendMessage, setToneAndStart, regenerate, editPrompt, acceptSchema
  } = useAIFormBuilder(getCurrentSchema);

  const [inputVal, setInputVal] = useState("");
  const [applied, setApplied] = useState(false);

  // Typewriter streaming state
  const [streamingText, setStreamingText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const lastAnimatedCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, loading, isOpen, phase]);

  // Clean up typewriter interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Detect new assistant message and start typewriter
  useEffect(() => {
    if (messages.length > lastAnimatedCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        startTypewriter(lastMsg.content);
      }
      lastAnimatedCountRef.current = messages.length;
    }
  }, [messages]);

  // Reset state when panel opens or tone changes
  useEffect(() => {
    setApplied(false);
    lastAnimatedCountRef.current = 0;
  }, [tone]);

  const startTypewriter = (fullText: string) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setIsAnimating(true);
    setStreamingText("");

    let currentIndex = 0;
    const increment = 3;

    timerRef.current = setInterval(() => {
      if (currentIndex < fullText.length) {
        currentIndex += increment;
        setStreamingText(fullText.substring(0, currentIndex));
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsAnimating(false);
        setStreamingText("");
      }
    }, 15);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading || isAnimating) return;
    setInputVal("");
    await sendMessage(textToSend);
  };

  const handleApply = () => {
    if (!generatedSchema) return;
    // Extract title from first heading node
    let title = "AI Generated Form";
    const firstHeading = generatedSchema.content.find(n => n.type === "heading") as any;
    if (firstHeading?.content?.[0]?.text) {
      title = firstHeading.content[0].text;
    }
    onApplySchema(generatedSchema, title);
    setApplied(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputVal);
    }
  };

  // Basic markdown/formatting parser
  const renderMessageContent = (text: string) => {
    if (!text || typeof text !== "string") return [];
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const isListItem = line.trim().startsWith("- ") || line.trim().startsWith("* ");

      // Format bold markup **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(<strong key={`b-${idx}-${match.index}`} className="font-semibold text-zinc-900">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      const inlineContent = parts.length > 0 ? parts : [line];

      if (isListItem) {
        const itemText = line.trim().substring(2);
        elements.push(
          <li key={idx} className="ml-4 list-disc pl-1 mb-1 text-[12.5px] text-zinc-600 font-sans leading-relaxed">
            {itemText}
          </li>
        );
      } else if (line.trim() === "") {
        elements.push(<br key={idx} />);
      } else {
        elements.push(
          <p key={idx} className="mb-2.5 text-[12.5px] text-zinc-600 font-sans leading-relaxed">
            {inlineContent}
          </p>
        );
      }
    });

    return elements;
  };

  // Get messages to display (hide last assistant if still animating)
  const getDisplayMessages = (): Message[] => {
    if (isAnimating && messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      return messages.slice(0, -1);
    }
    return messages;
  };

  const displayMessages = getDisplayMessages();

  return (
    <div
      data-ai-panel="true"
      className={`fixed top-[72px] right-4 h-[calc(100vh-5.5rem)] w-[400px] bg-white border border-zinc-200 flex flex-col rounded-2xl z-[90] transition-all duration-300 ease-in-out transform ${
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)] pointer-events-none"
      }`}
    >
      {/* Drawer Header */}
      <div className="h-14 border-b border-zinc-100 px-5 flex items-center justify-between shrink-0 rounded-t-2xl bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-800 tracking-tight">AI Form Assistant</h3>
            <span className="text-[10px] font-medium text-zinc-400">Powered by Gemini</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tone Selection Screen (when no tone is selected) */}
      {!tone && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-800 mb-2">Welcome to AI Form Builder</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Choose a tone for your form, then describe what you need. I&apos;ll ask a few questions and generate the perfect form for you.
            </p>
          </div>

          <div className="w-full space-y-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Select a tone</p>
            {Object.entries(TONES).map(([key, toneConfig]) => (
              <button
                key={key}
                onClick={() => setToneAndStart(key as ToneKey)}
                className="w-full text-left px-4 py-3 rounded-xl border border-zinc-200/80 bg-zinc-50 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer group flex items-center gap-3"
              >
                <span className="text-lg">{toneConfig.emoji}</span>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-zinc-700 group-hover:text-blue-600 transition-colors">{toneConfig.label}</span>
                  <p className="text-[10px] text-zinc-400 leading-snug mt-0.5">{toneConfig.instruction.substring(0, 60)}…</p>
                </div>
                <ArrowRight size={14} className="text-zinc-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Interface (once tone is selected) */}
      {tone && (
        <>
          {/* Message Feed */}
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6 scrollbar-thin">
            {/* Welcome message */}
            {displayMessages.length === 0 && !loading && (
              <div className="flex gap-3 max-w-[90%] self-start">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border bg-blue-50 border-blue-100 text-blue-600">
                  <Bot size={14} />
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 rounded-tl-none">
                  <p className="mb-2.5 text-[12.5px] text-zinc-600 font-sans leading-relaxed">
                    Welcome to <strong className="font-semibold text-zinc-900">FieldTally AI</strong>! I&apos;m your form design assistant.
                  </p>
                  <p className="mb-2.5 text-[12.5px] text-zinc-600 font-sans leading-relaxed">
                    Tell me what kind of form you need, or pick one of the suggestions below. I&apos;ll ask a few clarifying questions, then generate the complete form for you.
                  </p>
                  <p className="text-[10px] text-zinc-400 font-sans">
                    Tone: <strong>{TONES[tone].emoji} {TONES[tone].label}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Conversation messages */}
            {displayMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 max-w-[90%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border ${
                  msg.role === "user" ? "bg-zinc-100 border-zinc-200 text-zinc-600" : "bg-blue-50 border-blue-100 text-blue-600"
                }`}>
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>

                <div className="flex flex-col gap-2">
                  <div className={`p-4 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-zinc-900 text-white rounded-tr-none text-[13px]"
                      : "bg-zinc-50 border border-zinc-100 rounded-tl-none"
                  }`}>
                    {msg.role === "user" ? (
                      <p className="font-sans leading-relaxed text-[12.5px]">{msg.content}</p>
                    ) : (
                      renderMessageContent(msg.content)
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming Message (typewriter) */}
            {isAnimating && (
              <div className="flex gap-3 max-w-[90%] self-start">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border bg-blue-50 border-blue-100 text-blue-600">
                  <Bot size={14} />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 rounded-tl-none">
                    {renderMessageContent(streamingText)}
                    <span className="inline-block w-1.5 h-3.5 bg-blue-500 ml-0.5 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* Thinking Indicator */}
            {loading && !isAnimating && (
              <div className="flex gap-3 max-w-[90%] self-start animate-fade-in">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border bg-blue-50 border-blue-100 text-blue-600">
                  <Bot size={14} />
                </div>
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-1">
                  {phase === "generating" ? (
                    <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin" /> Generating form schema…
                    </span>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Preview Phase — Schema Generated */}
            {phase === "preview" && generatedSchema && (
              <div className="flex gap-3 max-w-[90%] self-start">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border bg-blue-50 border-blue-100 text-blue-600">
                  <Bot size={14} />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 rounded-tl-none">
                    <p className="mb-2 text-[12.5px] text-zinc-600 font-sans leading-relaxed">
                      ✅ Your form has been generated with <strong className="font-semibold text-zinc-900">{generatedSchema.content.filter((n: any) => n.type !== "heading" && n.type !== "paragraph" && n.type !== "horizontalRule" && n.type !== "logicBlock").length} questions</strong> and <strong className="font-semibold text-zinc-900">{generatedSchema.content.filter((n: any) => n.type === "logicBlock").length} logic rules</strong>.
                    </p>
                    <p className="text-[11px] text-zinc-400 font-sans">Click below to apply it to the builder.</p>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={handleApply}
                      disabled={applied}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer ${
                        applied
                          ? "bg-green-50 border border-green-200 text-green-600"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                      }`}
                    >
                      {applied ? (
                        <span>✓ Applied</span>
                      ) : (
                        <>
                          <Play size={10} className="fill-current" />
                          <span>Apply to Builder</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={regenerate}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={10} />
                      <span>Regenerate</span>
                    </button>

                    <button
                      onClick={() => { editPrompt(); setApplied(false); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
                    >
                      <Pencil size={10} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Phase */}
            {error && (
              <div className="flex gap-3 max-w-[90%] self-start">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border bg-red-50 border-red-100 text-red-500">
                  <Bot size={14} />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 rounded-tl-none">
                    <p className="text-[12.5px] text-red-600 font-sans leading-relaxed">{error}</p>
                  </div>
                  <button
                    onClick={regenerate}
                    disabled={loading}
                    className="self-start ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={10} />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            )}

            <div ref={messageEndRef} />
          </div>

          {/* Suggestion Chips (show only at start of conversation) */}
          {messages.length === 0 && !loading && phase === "eliciting" && (
            <div className="px-5 pb-4 flex flex-col gap-2 shrink-0">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Suggestions</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((chip, index) => (
                  <button
                    key={index}
                    onClick={() => setInputVal(chip.prompt)}
                    className="text-left bg-zinc-50 hover:bg-zinc-100/80 active:bg-zinc-100 border border-zinc-200/50 rounded-xl px-3 py-2 text-xs text-zinc-600 hover:text-zinc-800 transition-colors flex items-center justify-between group cursor-pointer font-sans"
                  >
                    <span>{chip.label}</span>
                    <ArrowRight size={12} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form (only during elicitation phase) */}
          {(phase === "eliciting" && tone) && (
            <div className="p-4 border-t border-zinc-100 bg-white shrink-0 rounded-b-2xl">
              {/* Interactive Tone Pill Selector */}
              <div className="flex flex-col gap-1.5 pb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tone</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(TONES).map(([key, toneConfig]) => {
                    const isSelected = key === tone;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTone(key as ToneKey)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm ring-1 ring-blue-300/20"
                            : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300"
                        }`}
                        title={toneConfig.instruction}
                      >
                        <span>{toneConfig.emoji}</span>
                        <span>{toneConfig.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputVal);
                }}
              >
                <div className="relative flex items-end">
                  <textarea
                    rows={3}
                    placeholder="Describe the form you need…"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading || isAnimating}
                    className="w-full pl-4 pr-12 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-sans text-zinc-700 placeholder-zinc-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 transition-all disabled:opacity-50 resize-none leading-relaxed"
                  />
                  <button
                    type="submit"
                    disabled={!inputVal.trim() || loading || isAnimating}
                    className="absolute right-2.5 bottom-2.5 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer disabled:bg-zinc-100 disabled:text-zinc-300"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </form>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[9px] text-zinc-400 font-sans">Powered by Google Gemini</span>
                {currentFormTitle && (
                  <span className="text-[9px] text-zinc-400 font-sans max-w-[200px] truncate">
                    Editing: <strong>{currentFormTitle}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
