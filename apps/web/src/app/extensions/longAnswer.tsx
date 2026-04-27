import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import React, { useRef, useState } from "react";
import { Tooltip } from "../../components/Tooltip";

const MIN_ROWS = 3;
const ROW_HEIGHT_PX = 24; // approx line height in px

const LongAnswerComponent = (props: any) => {
  const [rows, setRows] = useState<number>(props.node.attrs.rows ?? MIN_ROWS);
  const dragStartY = useRef<number | null>(null);
  const dragStartRows = useRef<number>(rows);

  const handleResizeDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStartY.current = e.clientY;
    dragStartRows.current = rows;

    const onMove = (me: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = me.clientY - dragStartY.current;
      const newRows = Math.max(MIN_ROWS, Math.round(dragStartRows.current + delta / ROW_HEIGHT_PX));
      setRows(newRows);
      props.updateAttributes({ rows: newRows });
    };

    const onUp = () => {
      dragStartY.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <NodeViewWrapper
      className="long-answer-block"
      data-required={props.node.attrs.required ? "true" : undefined}
    >
      <div className="question-title-row">
        <NodeViewContent as="div" className="long-answer-title outline-none" />
        {props.node.attrs.required && (
          <Tooltip content={<span className="text-zinc-300">Required<span className="text-white font-bold ml-1">*</span></span>}>
            <span
              className="required-badge"
              contentEditable={false}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.updateAttributes({ required: false });
              }}
            >
              *
            </span>
          </Tooltip>
        )}
      </div>

      {/* Resizable textarea */}
      <div className="long-answer-field-wrapper" contentEditable={false}>
        <textarea
          className="block-placeholder-input long-answer-textarea"
          placeholder="Type placeholder text"
          value={props.node.attrs.placeholder || ""}
          rows={rows}
          onChange={(e) => props.updateAttributes({ placeholder: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Custom resize handle */}
        <div
          className="long-answer-resize-handle"
          onMouseDown={handleResizeDragStart}
          title="Drag to resize"
        >
          <span />
          <span />
          <span />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const LongAnswerBlock = Node.create({
  name: "longAnswerBlock",
  group: "block",
  content: "inline*",
  draggable: true,

  addAttributes() {
    return {
      placeholder: {
        default: "",
        renderHTML: attributes => ({ "data-placeholder": attributes.placeholder || "" }),
        parseHTML: element => element.getAttribute("data-placeholder") || "",
      },
      rows: {
        default: MIN_ROWS,
        renderHTML: attributes => ({ "data-rows": attributes.rows }),
        parseHTML: element => parseInt(element.getAttribute("data-rows") || "3"),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="long-answer-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "long-answer-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LongAnswerComponent);
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;

        if (!empty || $from.parent.type.name !== "longAnswerBlock") return false;

        const start = $from.before();
        const end = $from.after();

        if ($from.parent.textContent.trim() === "") {
          const tr = state.tr.replaceWith(start, end, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, start + 1));
          this.editor.view.dispatch(tr);
          return true;
        } else {
          const tr = state.tr.insert(end, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, end + 1));
          this.editor.view.dispatch(tr);
          return true;
        }
      },
    };
  },
});
