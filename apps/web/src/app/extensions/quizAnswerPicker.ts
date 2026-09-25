import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Marks the correct option inline, and lets the author set it by clicking the
 * option's marker instead of opening the block menu.
 *
 * Done with decorations rather than node views or a schema change: which option
 * is correct is derived state — it lives in the parent block's `correctAnswer`
 * attribute, not on the option — so there is nothing to store per option, and
 * leaving the option nodes as plain ProseMirror nodes keeps typing, selection
 * and Enter/Backspace behaviour exactly as they were.
 */

/** Parent block type → the child node type that holds its options. */
const OPTION_CHILD: Record<string, string> = {
  multipleChoiceBlock: "multipleChoiceOption",
  checkboxBlock: "checkboxOption",
};

const OPTION_TYPES = new Set(Object.values(OPTION_CHILD));

/** Block types that can carry an answer key, and so a point value. */
const GRADABLE = new Set(["multipleChoiceBlock", "checkboxBlock", "numberAnswerBlock"]);

/** The answer key as a list, whichever shape the block stores it in. */
function answerList(correctAnswer: unknown): string[] {
  if (Array.isArray(correctAnswer)) return correctAnswer.filter((v): v is string => typeof v === "string");
  return typeof correctAnswer === "string" ? [correctAnswer] : [];
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  // Outside quiz mode there is no answer key to show.
  if (doc.attrs.quizMode !== true) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    const childType = OPTION_CHILD[node.type.name];

    // Points badge on multipleChoice/checkbox questions, attached to the TITLE
    // node (not the block) via an attribute-only decoration — no DOM insertion,
    // so it can't trip the trailing-<br> issue a widget causes. The CSS renders
    // it as a real ::before in the title's own inline flow, the same way the
    // required asterisk already renders as an ::after — it wraps with long text
    // instead of floating over it. An earlier absolutely-positioned version
    // pinned to the block's top-right corner overlapped wrapped question text.
    if (childType && node.attrs.correctAnswer != null) {
      const points = node.attrs.quizPoints ?? 1;
      const title = node.firstChild;
      if (title) {
        decorations.push(
          Decoration.node(pos + 1, pos + 1 + title.nodeSize, {
            "data-quiz-points": `${points} ${points === 1 ? "point" : "points"}`,
          })
        );
      }
    }

    // Points badge on any graded question, whether or not it has options.
    // Attached to the BLOCK, not the title: a widget inside the title makes
    // ProseMirror append a trailing <br> (the widget becomes the last inline
    // child), which pushed the required asterisk onto its own line. An absolutely
    // positioned pseudo-element on the block stays out of the inline flow.
    if (GRADABLE.has(node.type.name) && node.attrs.correctAnswer != null) {
      const points = node.attrs.quizPoints ?? 1;
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: "has-quiz-points",
          "data-quiz-points": `${points} ${points === 1 ? "point" : "points"}`,
        })
      );
    }

    if (!childType) return true;

    const correct = answerList(node.attrs.correctAnswer);
    let offset = pos + 1;

    node.forEach((child) => {
      if (child.type.name === childType) {
        const text = child.textContent.trim();
        const isCorrect = text !== "" && correct.includes(text);
        decorations.push(
          Decoration.node(offset, offset + child.nodeSize, {
            class: isCorrect ? "quiz-pick quiz-pick-correct" : "quiz-pick",
          })
        );
      }
      offset += child.nodeSize;
    });

    // Options never nest, so there is nothing below this block to visit.
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

export const QuizAnswerPicker = Extension.create({
  name: "quizAnswerPicker",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("quizAnswerPicker"),

        props: {
          // Recomputed per state change. A form is tens of nodes, so walking it
          // is cheaper than maintaining a mapped DecorationSet.
          // ponytail: full rebuild, switch to DecorationSet.map if forms ever
          // grow into the thousands of blocks.
          decorations: (state) => buildDecorations(state.doc),

          handleDOMEvents: {
            mousedown: (view, event) => {
              if (view.state.doc.attrs.quizMode !== true) return false;

              const target = event.target as HTMLElement | null;
              const marker = target?.closest?.(".option-marker");
              if (!marker) return false;

              const pos = view.posAtDOM(marker, 0);
              if (pos < 0) return false;

              const $pos = view.state.doc.resolve(pos);

              let optionDepth = -1;
              for (let depth = $pos.depth; depth > 0; depth--) {
                if (OPTION_TYPES.has($pos.node(depth).type.name)) {
                  optionDepth = depth;
                  break;
                }
              }
              if (optionDepth < 1) return false;

              const option = $pos.node(optionDepth);
              const block = $pos.node(optionDepth - 1);
              if (!OPTION_CHILD[block.type.name]) return false;

              // An unlabelled option cannot be an answer key — the key is the text.
              const text = option.textContent.trim();
              if (!text) return false;

              const current = answerList(block.attrs.correctAnswer);
              const already = current.includes(text);

              let next: string | string[] | null;
              if (block.type.name === "checkboxBlock") {
                const updated = already ? current.filter((t) => t !== text) : [...current, text];
                next = updated.length > 0 ? updated : null;
              } else {
                // Single-select: picking a new option replaces the previous one,
                // and clicking the current answer clears it.
                next = already ? null : text;
              }

              const blockPos = $pos.before(optionDepth - 1);
              view.dispatch(
                view.state.tr.setNodeMarkup(blockPos, undefined, {
                  ...block.attrs,
                  correctAnswer: next,
                })
              );

              // Swallow the click so the caret doesn't jump into the option.
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});
