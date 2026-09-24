/**
 * Checks the capability rules in apps/web/src/lib/authz.ts, focused on the
 * escalation paths that were open before.
 *
 * Run: npx tsx scripts/dev/verify-authz.ts
 */
import {
  canSubmit,
  canReadAllSubmissions,
  canReadDraftSchema,
  canReadPublishedSchema,
  canManageForm,
  canEditForm,
  canSeeAnswerKey,
  type EffectiveRole,
} from "../../apps/web/src/lib/authz";
import { gradeQuiz, stripAnswerKey } from "../../apps/web/src/lib/quiz";

const openPublished = { status: "published", access_open: true, created_by: "owner-1" };
const closedPublished = { status: "published", access_open: false, created_by: "owner-1" };
const draftForm = { status: "draft", access_open: true, created_by: "owner-1" };

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "  ok  " : "FAIL  "} ${label} → ${actual} (expected ${expected})`);
}

console.log("\n── Regression: open form must not leak other people's responses ──");
check("anonymous cannot read all submissions of an OPEN form", canReadAllSubmissions(openPublished, "anonymous"), false);
check("submitter cannot read all submissions", canReadAllSubmissions(openPublished, "submitter"), false);
check("viewer can read all submissions", canReadAllSubmissions(openPublished, "viewer"), true);
check("editor can read all submissions", canReadAllSubmissions(openPublished, "editor"), true);
check("owner can read all submissions", canReadAllSubmissions(openPublished, "owner"), true);

console.log("\n── Regression: draft must not be exposed by access_open ──");
check("anonymous cannot read draft of an OPEN form", canReadDraftSchema(openPublished, "anonymous"), false);
check("submitter cannot read draft", canReadDraftSchema(openPublished, "submitter"), false);
check("viewer cannot read draft", canReadDraftSchema(openPublished, "viewer"), false);
check("editor can read draft", canReadDraftSchema(openPublished, "editor"), true);

console.log("\n── Submission rules ──");
check("anonymous may submit to an open published form", canSubmit(openPublished, "anonymous"), true);
check("anonymous may NOT submit to a closed form", canSubmit(closedPublished, "anonymous"), false);
check("anonymous may NOT submit to an unpublished form", canSubmit(draftForm, "anonymous"), false);
check("explicit viewer may NOT submit even when open", canSubmit(openPublished, "viewer"), false);
check("submitter may submit to a closed form", canSubmit(closedPublished, "submitter"), true);

console.log("\n── Sharing is owner-only ──");
check("editor cannot manage sharing", canManageForm(openPublished, "editor"), false);
check("owner can manage sharing", canManageForm(openPublished, "owner"), true);
check("viewer cannot edit the form", canEditForm(openPublished, "viewer"), false);

console.log("\n── Published schema visibility ──");
check("anonymous can read an open published schema", canReadPublishedSchema(openPublished, "anonymous"), true);
check("anonymous cannot read a closed form's schema", canReadPublishedSchema(closedPublished, "anonymous"), false);
check("submitter can read a closed form's schema", canReadPublishedSchema(closedPublished, "submitter"), true);

console.log("\n── Quiz answer key ──");
check("anonymous taker may not see the answer key", canSeeAnswerKey(openPublished, "anonymous"), false);
check("submitter may not see the answer key", canSeeAnswerKey(openPublished, "submitter"), false);
check("owner may see the answer key", canSeeAnswerKey(openPublished, "owner"), true);

const quizSchema = {
  type: "doc",
  attrs: { quizMode: true },
  content: [
    { type: "multipleChoiceBlock", attrs: { id: "q1", correctAnswer: "Paris", quizPoints: 5 } },
    { type: "numberAnswerBlock", attrs: { id: "q2", correctAnswer: { type: "exact", value: 42 }, quizPoints: 3 } },
  ],
};

const graded = gradeQuiz(quizSchema, { q1: "Paris", q2: 42 });
check("full marks are awarded", graded?.score, 8);
check("total points are correct", graded?.totalPoints, 8);
check("percentage is correct", graded?.percentage, 100);

const partial = gradeQuiz(quizSchema, { q1: "London", q2: 42 });
check("wrong answer scores 0 for that question", partial?.score, 3);

const stripped = stripAnswerKey(quizSchema);
const strippedJson = JSON.stringify(stripped);
check("stripped schema has no correctAnswer", strippedJson.includes("correctAnswer"), false);
check("stripped schema has no quizPoints", strippedJson.includes("quizPoints"), false);
check("stripped schema keeps question ids", strippedJson.includes("q1"), true);
check("original schema is not mutated", JSON.stringify(quizSchema).includes("correctAnswer"), true);
check("a stripped schema cannot be graded for points", gradeQuiz(stripped, { q1: "Paris" })?.totalPoints, 0);



// ── Searchable choice blocks ────────────────────────────────────────────────
import { filterOptions } from "../../apps/web/src/components/FormRenderer";

const opt = (text: string) => ({ type: "checkboxOption", content: [{ type: "text", text }] });
const options = [opt("Kenya"), opt("Kyrgyzstan"), opt("Denmark"), opt("Sweden")];
const none = () => false;
const texts = (nodes: any[]) => nodes.map((n) => n.content[0].text).join(",");

console.log("\n── Searchable choice filtering ──");
check("empty query keeps every option", texts(filterOptions(options, "", none)), "Kenya,Kyrgyzstan,Denmark,Sweden");
check("whitespace-only query keeps every option", texts(filterOptions(options, "   ", none)), "Kenya,Kyrgyzstan,Denmark,Sweden");
check("substring match, case-insensitive", texts(filterOptions(options, "ken", none)), "Kenya");
check("matches mid-word", texts(filterOptions(options, "mark", none)), "Denmark");
check("prefix shared by two options", texts(filterOptions(options, "k", none)), "Kenya,Kyrgyzstan,Denmark");
check("no match yields empty list", texts(filterOptions(options, "zzz", none)), "");
check(
  "a selected option stays visible even when it does not match",
  texts(filterOptions(options, "zzz", (t) => t === "Sweden")),
  "Sweden"
);
check(
  "selected option is not duplicated when it also matches",
  texts(filterOptions(options, "swe", (t) => t === "Sweden")),
  "Sweden"
);


// ── Quiz + searchable choice blocks ─────────────────────────────────────────
const searchableQuiz = {
  type: "doc",
  attrs: { quizMode: true },
  content: [
    {
      type: "multipleChoiceBlock",
      attrs: { id: "q1", searchable: true, correctAnswer: "Nepal", quizPoints: 5 },
      content: [
        { type: "multipleChoiceTitle", content: [{ type: "text", text: "Primary country?" }] },
        ...["Kenya", "Nepal", "Brazil"].map((t) => ({ type: "multipleChoiceOption", content: [{ type: "text", text: t }] })),
      ],
    },
    {
      type: "checkboxBlock",
      attrs: { id: "q2", searchable: true, correctAnswer: ["Kenya", "Brazil"], quizPoints: 4 },
      content: [
        { type: "checkboxTitle", content: [{ type: "text", text: "Which did you survey?" }] },
        ...["Kenya", "Nepal", "Brazil"].map((t) => ({ type: "checkboxOption", content: [{ type: "text", text: t }] })),
      ],
    },
  ],
};

console.log("\n── Quiz grading on searchable choice blocks ──");
const perfect = gradeQuiz(searchableQuiz, { q1: "Nepal", q2: ["Kenya", "Brazil"] });
check("searchable single-select graded", perfect?.score, 9);
check("total points include searchable blocks", perfect?.totalPoints, 9);

const partialSearchable = gradeQuiz(searchableQuiz, { q1: "Kenya", q2: ["Kenya"] });
check("wrong single-select scores 0", partialSearchable?.details["q1"].pointsEarned, 0);
check("partial multi-select gets partial credit", partialSearchable?.details["q2"].pointsEarned, 2);

const wrongPick = gradeQuiz(searchableQuiz, { q1: "Nepal", q2: ["Kenya", "Nepal"] });
check("a wrong selection voids that question", wrongPick?.details["q2"].pointsEarned, 0);

console.log("\n── Answer-key stripping keeps the block searchable ──");
const strippedQuiz: any = stripAnswerKey(searchableQuiz);
check("correctAnswer removed from searchable mcq", "correctAnswer" in strippedQuiz.content[0].attrs, false);
check("quizPoints removed from searchable mcq", "quizPoints" in strippedQuiz.content[0].attrs, false);
check("searchable flag SURVIVES stripping (mcq)", strippedQuiz.content[0].attrs.searchable, true);
check("searchable flag SURVIVES stripping (checkbox)", strippedQuiz.content[1].attrs.searchable, true);
check("question id survives stripping", strippedQuiz.content[1].attrs.id, "q2");
check("options survive stripping", strippedQuiz.content[1].content.length, 4);


// ── AI-generated quizzes survive validation and grade ───────────────────────
import { validateFormSchema } from "../../apps/web/src/app/create-form/ai-chat/utils/validateFormSchema";

const txt = (t: string) => [{ type: "text", text: t }];
const node = (type: string, t: string) => ({ type, content: txt(t) });

/** The shape the model is told to emit for "make me a quiz". */
const aiQuiz = {
  type: "doc",
  attrs: { quizMode: true, showResultsImmediately: true },
  content: [
    { type: "heading", attrs: { level: 1 as const }, content: txt("Safety Quiz") },
    {
      type: "multipleChoiceBlock",
      attrs: { id: "q_ppe", required: true, correctAnswer: "Hard hat", quizPoints: 3 },
      content: [node("multipleChoiceTitle", "Required on site?"), node("multipleChoiceOption", "Hard hat"), node("multipleChoiceOption", "Sandals")],
    },
    {
      type: "checkboxBlock",
      attrs: { id: "q_kit", required: true, searchable: true, correctAnswer: ["Gloves", "Goggles"], quizPoints: 4 },
      content: [node("checkboxTitle", "Pick the PPE"), node("checkboxOption", "Gloves"), node("checkboxOption", "Goggles"), node("checkboxOption", "Radio")],
    },
    {
      type: "numberAnswerBlock",
      attrs: { id: "q_height", required: true, correctAnswer: { type: "range" as const, min: 2, max: 4 }, quizPoints: 2 },
      content: txt("Safe ladder angle ratio?"),
    },
  ],
};

console.log("\n── AI quiz survives Zod validation ──");
const parsed: any = validateFormSchema(aiQuiz);
check("quizMode reaches the editor", parsed.attrs?.quizMode, true);
check("showResultsImmediately preserved", parsed.attrs?.showResultsImmediately, true);
check("mcq answer key preserved", parsed.content[1].attrs.correctAnswer, "Hard hat");
check("mcq points preserved", parsed.content[1].attrs.quizPoints, 3);
check("checkbox answer key preserved", JSON.stringify(parsed.content[2].attrs.correctAnswer), '["Gloves","Goggles"]');
check("searchable preserved alongside quiz", parsed.content[2].attrs.searchable, true);
check("number range key preserved", JSON.stringify(parsed.content[3].attrs.correctAnswer), '{"type":"range","min":2,"max":4}');

console.log("\n── and the validated schema actually grades ──");
const full = gradeQuiz(parsed, { q_ppe: "Hard hat", q_kit: ["Gloves", "Goggles"], q_height: 3 });
check("all correct scores full marks", full?.score, 9);
check("total points add up", full?.totalPoints, 9);
const partial2 = gradeQuiz(parsed, { q_ppe: "Sandals", q_kit: ["Gloves"], q_height: 9 });
check("wrong mcq scores 0", partial2?.details["q_ppe"].pointsEarned, 0);
check("half the checkboxes earns half", partial2?.details["q_kit"].pointsEarned, 2);
check("number outside range scores 0", partial2?.details["q_height"].pointsEarned, 0);

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
