import { TONES } from "../constants/tones"
import { ToneKey } from "../types"
import { SCHEMA_REFERENCE } from "../constants/schemaReference"

export const buildGenerationPrompt = (tone: ToneKey, currentSchema?: any): string => {
  let existingContext = ""
  if (currentSchema && currentSchema.content && currentSchema.content.length > 0) {
    existingContext = `
EXISTING FORM STATE (CRITICAL):
Below is the current JSON schema of the form in the editor.
You are tasked with MODIFYING, ADDING to, or DELETING from this exact schema according to the user's instructions.
- Keep all unmodified elements (questions, paragraphs, headings, rules) exactly as they are in the JSON schema.
- DO NOT CHANGE their globally unique "id" in attrs under any circumstances. Preserving these IDs is critical so that logic rule target mappings do not break.
- Add new question nodes, delete requested nodes, or update labels and attributes inside this schema, keeping the rest intact.

\`\`\`json
${JSON.stringify(currentSchema, null, 2)}
\`\`\`
`
  }

  return `
You are a FieldTally form schema generator.

${SCHEMA_REFERENCE}

TONE: ${TONES[tone].label}
${TONES[tone].instruction}

${existingContext}

RULES:
- Output ONLY the raw JSON object. No explanation, no markdown fences, no preamble, no postamble.
- The output must be directly parseable by JSON.parse().
- Always start content with a heading node (level 1) as the form title.
- Use a paragraph node after the title for a short form description if appropriate.
- Only include gpsAnswerBlock, imageAnswerBlock, signatureAnswerBlock if the conversation clearly warrants them.
- Apply the tone instruction to every question label and every MCQ/checkbox option text.
- The form should feel complete — include a logical ordering of questions with section headings (level 2) where appropriate.

ID UNIQUENESS (CRITICAL):
- Every question block MUST have a unique "id" in its attrs. Use the format "q_" + short_snake_case descriptor.
- NEVER reuse the same id for multiple blocks. Each id must be globally unique within the form.
- If two questions are similar (e.g. two name fields), differentiate them: "q_first_name", "q_last_name".
- If modifying an existing schema, make sure all new questions have completely new unique IDs, and unmodified questions keep their original IDs.

LOGIC RULES:
- Only include logicBlock nodes if conditional logic was explicitly discussed during the conversation.
- Generate ALL logicBlock nodes at the very END of the content array, AFTER all question and layout nodes. Do NOT interleave logicBlocks between questions.
- Each logicBlock's rule.id must be unique (format: "rule_" + descriptor).
- Each condition.id inside a rule must be unique.
- The "field" in conditions must reference an existing question block id from the form.
- The "targets" in actions must reference existing question block ids from the form.
`
}