// Reads the small subset of a Tiptap form doc that Data Exercises care about:
// the flat list of answer fields, and the exercise-only settings
// (chartConfig / liveDuringExercise) stored on the doc's root attrs — the same
// place quizMode/showResultsImmediately already live.

export type ExerciseFieldType =
  | "shortAnswerBlock"
  | "longAnswerBlock"
  | "numberAnswerBlock"
  | "emailAnswerBlock"
  | "phoneAnswerBlock"
  | "linkAnswerBlock"
  | "dateAnswerBlock"
  | "timeAnswerBlock"
  | "checkboxBlock"
  | "multipleChoiceBlock"
  | "gpsAnswerBlock"
  | "imageAnswerBlock"
  | "signatureAnswerBlock";

export interface ExerciseField {
  id: string;
  type: ExerciseFieldType;
  label: string;
  required: boolean;
  options?: string[];
}

/** fieldId → default chart id (see exerciseCharts.ts), or "none" to leave it uncharted. */
export type ChartConfig = Record<string, string>;

const ANSWER_BLOCK_TYPES = new Set<ExerciseFieldType>([
  "shortAnswerBlock",
  "longAnswerBlock",
  "numberAnswerBlock",
  "emailAnswerBlock",
  "phoneAnswerBlock",
  "linkAnswerBlock",
  "dateAnswerBlock",
  "timeAnswerBlock",
  "checkboxBlock",
  "multipleChoiceBlock",
  "gpsAnswerBlock",
  "imageAnswerBlock",
  "signatureAnswerBlock",
]);

const OPTION_CHILD_TYPE: Partial<Record<ExerciseFieldType, string>> = {
  checkboxBlock: "checkboxOption",
  multipleChoiceBlock: "multipleChoiceOption",
};

const TITLE_CHILD_TYPE: Partial<Record<ExerciseFieldType, string>> = {
  checkboxBlock: "checkboxTitle",
  multipleChoiceBlock: "multipleChoiceTitle",
};

function extractText(content?: any[]): string {
  if (!content) return "";
  return content
    .map((n) => {
      if (n.type === "text") return n.text || "";
      if (n.content) return extractText(n.content);
      return "";
    })
    .join("");
}

/** Walks a published/draft Tiptap doc's top-level content for answer blocks. */
export function extractExerciseFields(docContent: any): ExerciseField[] {
  const nodes: any[] = docContent?.content ?? [];
  const fields: ExerciseField[] = [];

  for (const node of nodes) {
    if (!node?.type || !ANSWER_BLOCK_TYPES.has(node.type)) continue;
    const id = node.attrs?.id;
    if (!id) continue;

    const titleChildType = TITLE_CHILD_TYPE[node.type as ExerciseFieldType];
    const optionChildType = OPTION_CHILD_TYPE[node.type as ExerciseFieldType];

    if (titleChildType && optionChildType) {
      const children: any[] = node.content ?? [];
      const titleNode = children.find((c) => c.type === titleChildType);
      const options = children.filter((c) => c.type === optionChildType).map((c) => extractText(c.content));
      fields.push({
        id,
        type: node.type,
        label: extractText(titleNode?.content) || "Untitled question",
        required: !!node.attrs?.required,
        options,
      });
    } else {
      fields.push({
        id,
        type: node.type,
        label: extractText(node.content) || "Untitled question",
        required: !!node.attrs?.required,
      });
    }
  }

  return fields;
}

export function getExerciseSettings(docContent: any): { chartConfig: ChartConfig; liveDuringExercise: boolean } {
  return {
    chartConfig: docContent?.attrs?.chartConfig ?? {},
    liveDuringExercise: docContent?.attrs?.liveDuringExercise !== false,
  };
}

/** Sets the exercise-only root attrs on a doc, preserving everything else. */
export function withExerciseSettings(docContent: any, settings: { chartConfig: ChartConfig; liveDuringExercise: boolean }): any {
  return {
    ...docContent,
    attrs: { ...(docContent?.attrs || {}), chartConfig: settings.chartConfig, liveDuringExercise: settings.liveDuringExercise },
  };
}
