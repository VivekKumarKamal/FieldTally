import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

// Walk up the ancestor chain to find a node of the given type name.
// Returns the depth, or -1 if not found.
const findAncestorDepth = (
  $from: ResolvedPos,
  nodeName: string,
  minDepth = 0,
) => {
  for (let depth = $from.depth; depth >= minDepth; depth--) {
    if ($from.node(depth).type.name === nodeName) {
      return depth;
    }
  }
  return -1;
};

// Count how many checkboxOption children are inside a checkboxBlock.
const countCheckboxOptions = (checkboxBlock: ProseMirrorNode) => {
  let count = 0;
  checkboxBlock.forEach((child) => {
    if (child.type.name === "checkboxOption") count++;
  });
  return count;
};

// ── CheckboxTitle: the question/label text at the top of a checkbox block ──
// Enter in the title → move cursor to first option
export const CheckboxTitle = Node.create({
  name: "checkboxTitle",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'div[data-type="checkbox-title"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "checkbox-title" }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name !== "checkboxTitle") return false;

        const cbDepth = findAncestorDepth($from, "checkboxBlock");
        if (cbDepth === -1) return false;

        if ($from.parent.textContent.trim() === "") {
          // Empty title: remove the whole block and insert a plain paragraph in its place
          const start = $from.before(cbDepth);
          const end = $from.after(cbDepth);
          this.editor.chain()
            .deleteRange({ from: start, to: end })
            .insertContentAt(start, { type: "paragraph" })
            .setTextSelection(start + 1)
            .run();
          return true;
        }

        // Has text: jump to the first option
        const cb = $from.node(cbDepth);
        const cbStart = $from.start(cbDepth);
        let offset = 0;
        for (let i = 0; i < cb.childCount; i++) {
          const child = cb.child(i);
          if (child.type.name === "checkboxOption") {
            this.editor.chain()
              .setTextSelection(cbStart + offset + 1)
              .run();
            return true;
          }
          offset += child.nodeSize;
        }
        return false;
      },
    };
  },
});

// ── CheckboxOption: a single selectable option inside a checkbox block ──
// Enter on non-empty option → add new option below
// Enter on empty option     → exit the block (add paragraph after)
// Backspace on empty option → delete it (or collapse whole block if only one)
export const CheckboxOption = Node.create({
  name: "checkboxOption",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="checkbox-option"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "checkbox-option" }),
      ["span", { class: "option-marker", contenteditable: "false" }],
      ["span", { class: "option-content" }, 0],
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        const optDepth = findAncestorDepth($from, "checkboxOption", 1);
        if (optDepth === -1) return false;

        const optNode = $from.node(optDepth);

        // Non-empty option → insert a new sibling option below
        if (optNode.textContent !== "") {
          const after = $from.after(optDepth);
          const tr = state.tr.insert(after, state.schema.nodes.checkboxOption.create());
          tr.setSelection(TextSelection.create(tr.doc, after + 1));
          this.editor.view.dispatch(tr);
          return true;
        }

        // Empty option → exit the checkboxBlock
        const checkboxBlock = $from.node(optDepth - 1);
        const optionCount = countCheckboxOptions(checkboxBlock);
        const tr = state.tr;

        if (optionCount > 1) {
          // Remove the blank trailing option, then insert paragraph after block
          const optFrom = $from.before(optDepth);
          const optTo = $from.after(optDepth);
          const qbAfter = $from.after(optDepth - 1);
          tr.delete(optFrom, optTo);
          const newQbAfter = qbAfter - (optTo - optFrom);
          tr.insert(newQbAfter, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, newQbAfter + 1));
        } else {
          // Only option left — add paragraph after block and exit
          const qbAfter = $from.after(optDepth - 1);
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

        const optDepth = findAncestorDepth($from, "checkboxOption", 1);
        if (optDepth === -1) return false;

        const optNode = $from.node(optDepth);
        const checkboxBlock = $from.node(optDepth - 1);
        const optionCount = countCheckboxOptions(checkboxBlock);

        // Delete empty option when there are siblings
        if (optNode.textContent === "" && optionCount > 1) {
          const from = $from.before(optDepth);
          const to = $from.after(optDepth);
          this.editor.view.dispatch(state.tr.delete(from, to));
          return true;
        }

        // Last empty option + empty title → collapse the whole block to a paragraph
        if (optNode.textContent === "" && optionCount === 1) {
          const title = checkboxBlock.firstChild;
          if (title && title.textContent === "") {
            const qbStart = $from.before(optDepth - 1);
            const qbEnd = $from.after(optDepth - 1);
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

export const CheckboxBlock = Node.create({
  name: "checkboxBlock",
  group: "block",
  content: "checkboxTitle checkboxOption+",
  defining: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="checkbox-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "checkbox-block" }),
      0,
    ];
  },
});
