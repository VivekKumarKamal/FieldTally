
import { z } from "zod"
import { DocSchema } from "../types"

const TextNode = z.object({ type: z.literal("text"), text: z.string() })

const SimpleQuestionBlock = z.object({
  type: z.enum([
    "shortAnswerBlock", "longAnswerBlock", "numberAnswerBlock",
    "emailAnswerBlock", "phoneAnswerBlock", "linkAnswerBlock",
    "dateAnswerBlock", "timeAnswerBlock", "gpsAnswerBlock",
    "imageAnswerBlock", "signatureAnswerBlock"
  ]),
  attrs: z.object({
    id: z.string().regex(/^q_/),
    required: z.boolean(),
    placeholder: z.string().optional(),
    rows: z.number().optional()
  }),
  content: z.array(TextNode).min(1)
})

const MultipleChoiceBlock = z.object({
  type: z.literal("multipleChoiceBlock"),
  attrs: z.object({ id: z.string().regex(/^q_/), required: z.boolean() }),
  content: z.array(z.object({
    type: z.enum(["multipleChoiceTitle", "multipleChoiceOption"]),
    content: z.array(TextNode)
  })).min(2)
})

const CheckboxBlock = z.object({
  type: z.literal("checkboxBlock"),
  attrs: z.object({ id: z.string().regex(/^q_/), required: z.boolean() }),
  content: z.array(z.object({
    type: z.enum(["checkboxTitle", "checkboxOption"]),
    content: z.array(TextNode)
  })).min(2)
})

const LogicBlock = z.object({
  type: z.literal("logicBlock"),
  attrs: z.object({
    rule: z.object({
      id: z.string(),
      conditionOperator: z.enum(["AND", "OR"]),
      conditions: z.array(z.object({
        id: z.string(),
        field: z.string(),
        operator: z.enum(["equals", "notEquals", "contains"]),
        value: z.string()
      })),
      action: z.object({
        type: z.enum(["show", "hide"]),
        targets: z.array(z.string())
      })
    })
  })
})

const HeadingNode = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  content: z.array(TextNode)
})

const ParagraphNode = z.object({
  type: z.literal("paragraph"),
  content: z.array(TextNode)
})

const HorizontalRuleNode = z.object({
  type: z.literal("horizontalRule")
})

const AnyNode = z.union([
  SimpleQuestionBlock,
  MultipleChoiceBlock,
  CheckboxBlock,
  LogicBlock,
  HeadingNode,
  ParagraphNode,
  HorizontalRuleNode
])

export const FormDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(AnyNode).min(1)
})

export const validateFormSchema = (raw: unknown): DocSchema => {
  return FormDocSchema.parse(raw) as DocSchema
}