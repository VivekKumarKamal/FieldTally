/**
 * Quiz grading and answer-key handling.
 *
 * This is the single implementation of grading, shared by the browser (to show
 * the taker their score immediately) and the server (which recomputes the score
 * before storing it). The browser's result is a preview; the stored score is
 * always the one this module produces on the server from the authoritative
 * schema, so a forged `__quiz_result` in a request body cannot inflate a grade.
 */

export interface QuizResult {
  score: number;
  totalPoints: number;
  percentage: number;
  correctCount: number;
  totalCount: number;
  details: Record<string, { correct: boolean; pointsEarned: number; maxPoints: number }>;
}

/** Node attributes that make up the answer key and must not reach a taker. */
const ANSWER_KEY_ATTRS = ["correctAnswer", "quizPoints"] as const;

/**
 * Grade a set of answers against a schema.
 *
 * Returns `null` when the schema has no content. Questions without a configured
 * `correctAnswer` are skipped entirely and contribute no points.
 */
export function gradeQuiz(schema: any, answers: Record<string, any>): QuizResult | null {
  if (!schema?.content) return null;

  let totalPoints = 0;
  let score = 0;
  let totalCount = 0;
  let correctCount = 0;

  const details: QuizResult["details"] = {};

  for (const node of schema.content) {
    const id = node.attrs?.id;
    if (!id || node.type === "logicBlock") continue;

    const correctAnswer = node.attrs?.correctAnswer;
    if (correctAnswer === undefined || correctAnswer === null) continue;

    const maxPoints = node.attrs?.quizPoints ?? 1;
    totalPoints += maxPoints;
    totalCount++;

    const val = answers[id];
    let isCorrect = false;
    let pointsEarned = 0;

    if (node.type === "multipleChoiceBlock") {
      isCorrect = val === correctAnswer;
      pointsEarned = isCorrect ? maxPoints : 0;
      if (isCorrect) correctCount++;
    } else if (node.type === "checkboxBlock") {
      const correctList: string[] = Array.isArray(correctAnswer) ? correctAnswer : [];
      const selectedList: string[] = Array.isArray(val) ? val : [];

      if (selectedList.length === 0) {
        isCorrect = correctList.length === 0;
        pointsEarned = isCorrect ? maxPoints : 0;
        if (isCorrect) correctCount++;
      } else {
        const hasWrongSelection = selectedList.some((opt) => !correctList.includes(opt));
        if (hasWrongSelection) {
          isCorrect = false;
          pointsEarned = 0;
        } else {
          const selectedCorrectCount = selectedList.filter((opt) => correctList.includes(opt)).length;
          pointsEarned = correctList.length > 0 ? (selectedCorrectCount / correctList.length) * maxPoints : maxPoints;
          isCorrect = selectedCorrectCount === correctList.length;
          if (isCorrect) correctCount++;
        }
      }
    } else if (node.type === "numberAnswerBlock") {
      const numVal = val !== "" && val !== null && val !== undefined ? Number(val) : null;
      if (numVal !== null && !isNaN(numVal)) {
        if (correctAnswer.type === "exact") {
          isCorrect = numVal === correctAnswer.value;
        } else if (correctAnswer.type === "range") {
          const min = correctAnswer.min !== undefined ? correctAnswer.min : -Infinity;
          const max = correctAnswer.max !== undefined ? correctAnswer.max : Infinity;
          isCorrect = numVal >= min && numVal <= max;
        }
      }
      pointsEarned = isCorrect ? maxPoints : 0;
      if (isCorrect) correctCount++;
    }

    details[id] = {
      correct: isCorrect,
      pointsEarned,
      maxPoints,
    };
    score += pointsEarned;
  }

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

  return { score, totalPoints, percentage, correctCount, totalCount, details };
}

export interface QuizSummary {
  /** Every question on the form, graded or not. */
  totalQuestions: number;
  /** Questions that carry an answer key, i.e. the ones that score. */
  gradedQuestions: number;
  totalPoints: number;
}

/**
 * What a quiz is worth in total. Questions without a `correctAnswer` (short
 * answer, date, GPS…) are ungraded and contribute nothing, which is why the
 * count can be lower than the number of questions on the form.
 */
export function summarizeQuiz(schema: any): QuizSummary {
  let totalQuestions = 0;
  let gradedQuestions = 0;
  let totalPoints = 0;

  for (const node of schema?.content ?? []) {
    if (!node || node.type === "logicBlock") continue;
    // A question is any block the renderer gives an answer slot — i.e. one with
    // an id. Headings, paragraphs and rules have none.
    if (!node.attrs?.id) continue;
    totalQuestions++;

    if (node.attrs.correctAnswer == null) continue;
    gradedQuestions++;
    totalPoints += node.attrs.quizPoints ?? 1;
  }

  return { totalQuestions, gradedQuestions, totalPoints };
}

export function isQuizSchema(schema: any): boolean {
  return schema?.attrs?.quizMode === true;
}

/**
 * Return a copy of the schema with the answer key removed from every node.
 *
 * Served to anyone who is only allowed to *take* the quiz. Without this the
 * correct answers ship to the browser inside the form payload and are readable
 * from the network tab before the taker answers a single question.
 */
export function stripAnswerKey(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;

    const next: any = { ...node };

    if (next.attrs && typeof next.attrs === "object") {
      const attrs = { ...next.attrs };
      let touched = false;
      for (const key of ANSWER_KEY_ATTRS) {
        if (key in attrs) {
          delete attrs[key];
          touched = true;
        }
      }
      if (touched) next.attrs = attrs;
    }

    if (next.content) next.content = walk(next.content);
    return next;
  };

  return walk(schema);
}

/**
 * Strip client-supplied grading metadata from a submission payload.
 *
 * `__quiz_result` is recomputed server-side; whatever the client sent is
 * discarded rather than trusted.
 */
export function stripClientQuizResult(data: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== "object") return data;
  const { __quiz_result: _discarded, ...rest } = data;
  return rest;
}
