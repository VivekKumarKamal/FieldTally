export const TONES = {
  casual: {
    label: "Casual",
    emoji: "😎",
    colorClass: "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-800",
    activeClass: "bg-blue-50 border-blue-200 text-blue-600 shadow-sm ring-1 ring-blue-300/20",
    instruction: "Write questions in a friendly, conversational tone. MCQ options should be expressive, human, and slightly humorous. Avoid corporate language."
  },
  professional: {
    label: "Professional",
    emoji: "💼",
    colorClass: "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-800",
    activeClass: "bg-blue-50 border-blue-200 text-blue-600 shadow-sm ring-1 ring-blue-300/20",
    instruction: "Write questions formally and concisely. Options should be clear and business-appropriate."
  },
  quantitative: {
    label: "Quantitative",
    emoji: "📊",
    colorClass: "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-800",
    activeClass: "bg-blue-50 border-blue-200 text-blue-600 shadow-sm ring-1 ring-blue-300/20",
    instruction: "Prefer number inputs, scales (1–10), and terse MCQ options. Minimize open text fields. Use numberAnswerBlock where possible."
  },
  objective: {
    label: "Objective",
    emoji: "⚖️",
    colorClass: "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-800",
    activeClass: "bg-blue-50 border-blue-200 text-blue-600 shadow-sm ring-1 ring-blue-300/20",
    instruction: "Neutral, factual language. No leading questions. Balanced MCQ options."
  },
  empathetic: {
    label: "Empathetic",
    emoji: "🤗",
    colorClass: "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-800",
    activeClass: "bg-blue-50 border-blue-200 text-blue-600 shadow-sm ring-1 ring-blue-300/20",
    instruction: "Warm, supportive tone. Suitable for sensitive topics like health or welfare surveys."
  }
} as const;

export type ToneKey = keyof typeof TONES;
