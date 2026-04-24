import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// ── QuestionTitle: Enter moves to first option ──
export const QuestionTitle = Node.create({
  name: "questionTitle",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="question-title"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "question-title" }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name !== "questionTitle") return false;

        let qbDepth = -1;
        for (let d = $from.depth; d >= 0; d--) {
          if ($from.node(d).type.name === "questionBlock") {
            qbDepth = d;
            break;
          }
        }
        if (qbDepth === -1) return false;

        const qb = $from.node(qbDepth);
        const qbStart = $from.start(qbDepth);
        let offset = 0;
        for (let i = 0; i < qb.childCount; i++) {
          const child = qb.child(i);
          if (child.type.name === "optionItem") {
            this.editor.commands.setTextSelection(qbStart + offset + 1);
            return true;
          }
          offset += child.nodeSize;
        }
        return false;
      },
    };
  },
});

// ── OptionItem: Enter on text = new option, Enter on empty = exit block ──
export const OptionItem = Node.create({
  name: "optionItem",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="option-item"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "option-item" }),
      ["span", { class: "option-marker", contenteditable: "false" }],
      ["span", { class: "option-content" }, 0],
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        let optionDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "optionItem") {
            optionDepth = d;
            break;
          }
        }
        if (optionDepth === -1) return false;

        const optionNode = $from.node(optionDepth);

        // Option has text → add new option below
        if (optionNode.textContent !== "") {
          const after = $from.after(optionDepth);
          const tr = state.tr.insert(after, state.schema.nodes.optionItem.create());
          tr.setSelection(TextSelection.create(tr.doc, after + 1));
          this.editor.view.dispatch(tr);
          return true;
        }

        // Option is empty → exit the question block
        const questionBlock = $from.node(optionDepth - 1);
        let optionCount = 0;
        questionBlock.forEach((child) => {
          if (child.type.name === "optionItem") optionCount++;
        });

        const tr = state.tr;

        if (optionCount > 1) {
          // Delete empty option, then add paragraph after block
          const optFrom = $from.before(optionDepth);
          const optTo = $from.after(optionDepth);
          const qbAfter = $from.after(optionDepth - 1);
          tr.delete(optFrom, optTo);
          const newQbAfter = qbAfter - (optTo - optFrom);
          tr.insert(newQbAfter, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, newQbAfter + 1));
        } else {
          // Only option — just add paragraph after block and exit
          const qbAfter = $from.after(optionDepth - 1);
          tr.insert(qbAfter, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, qbAfter + 1));
        }

        this.editor.view.dispatch(tr);
        return true;
      },

      Backspace: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parentOffset !== 0) return false;

        let optionDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "optionItem") {
            optionDepth = d;
            break;
          }
        }
        if (optionDepth === -1) return false;

        const optionNode = $from.node(optionDepth);
        const questionBlock = $from.node(optionDepth - 1);

        let optionCount = 0;
        questionBlock.forEach((child) => {
          if (child.type.name === "optionItem") optionCount++;
        });

        if (optionNode.textContent === "" && optionCount > 1) {
          const from = $from.before(optionDepth);
          const to = $from.after(optionDepth);
          this.editor.view.dispatch(state.tr.delete(from, to));
          return true;
        }

        if (optionNode.textContent === "" && optionCount === 1) {
          const title = questionBlock.firstChild;
          if (title && title.textContent === "") {
            const qbStart = $from.before(optionDepth - 1);
            const qbEnd = $from.after(optionDepth - 1);
            const tr = state.tr.replaceWith(
              qbStart,
              qbEnd,
              state.schema.nodes.paragraph.create()
            );
            tr.setSelection(TextSelection.create(tr.doc, qbStart + 1));
            this.editor.view.dispatch(tr);
            return true;
          }
        }

        return false;
      },
    };
  },
});

// ── QuestionBlock: wrapper ──
export const QuestionBlock = Node.create({
  name: "questionBlock",
  group: "block",
  content: "questionTitle optionItem+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="question-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "question-block" }),
      0,
    ];
  },
});
