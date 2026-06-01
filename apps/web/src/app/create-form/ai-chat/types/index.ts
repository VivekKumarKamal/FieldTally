import { ToneKey } from "../constants/tones"

export type { ToneKey }

export type Phase = "eliciting" | "generating" | "preview" | "error"

export interface Message {
  role: "user" | "assistant"
  content: string
}

export interface AIFormBuilderState {
  phase: Phase
  messages: Message[]
  tone: ToneKey | null
  generatedSchema: DocSchema | null
  error: string | null
}

// ProseMirror doc shape
export interface DocSchema {
  type: "doc"
  content: AnyNode[]
}

export type AnyNode =
  | SimpleQuestionNode
  | MultipleChoiceNode
  | CheckboxNode
  | LogicNode
  | HeadingNode
  | ParagraphNode
  | HorizontalRuleNode

export interface SimpleQuestionNode {
  type:
    | "shortAnswerBlock"
    | "longAnswerBlock"
    | "numberAnswerBlock"
    | "emailAnswerBlock"
    | "phoneAnswerBlock"
    | "linkAnswerBlock"
    | "dateAnswerBlock"
    | "timeAnswerBlock"
    | "gpsAnswerBlock"
    | "imageAnswerBlock"
    | "signatureAnswerBlock"
  attrs: {
    id: string
    required: boolean
    placeholder?: string
    rows?: number
  }
  content: [{ type: "text"; text: string }]
}

export interface MultipleChoiceNode {
  type: "multipleChoiceBlock"
  attrs: { id: string; required: boolean }
  content: Array<{
    type: "multipleChoiceTitle" | "multipleChoiceOption"
    content: [{ type: "text"; text: string }]
  }>
}

export interface CheckboxNode {
  type: "checkboxBlock"
  attrs: { id: string; required: boolean }
  content: Array<{
    type: "checkboxTitle" | "checkboxOption"
    content: [{ type: "text"; text: string }]
  }>
}

export interface LogicNode {
  type: "logicBlock"
  attrs: {
    rule: {
      id: string
      conditionOperator: "AND" | "OR"
      conditions: Array<{
        id: string
        field: string
        operator: "equals" | "notEquals" | "contains"
        value: string
      }>
      action: {
        type: "show" | "hide"
        targets: string[]
      }
    }
  }
}

export interface HeadingNode {
  type: "heading"
  attrs: { level: 1 | 2 | 3 }
  content: [{ type: "text"; text: string }]
}

export interface ParagraphNode {
  type: "paragraph"
  content: [{ type: "text"; text: string }]
}

export interface HorizontalRuleNode {
  type: "horizontalRule"
}