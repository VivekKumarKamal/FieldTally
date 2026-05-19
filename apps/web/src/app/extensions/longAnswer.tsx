import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import React, { useRef, useState } from "react";
import { inlineQuestionEnterShortcut, placeholderAttribute, RequiredBadge } from "./simpleAnswerBlock";

const MIN_ROWS = 3;
const ROW_HEIGHT_PX = 24; // approx line height in px
type LongAnswerAttrs = { placeholder?: string; required?: boolean; rows?: number };

const LongAnswerComponent = (props: NodeViewProps) => {
  const attrs = props.node.attrs as LongAnswerAttrs;
  const [rows, setRows] = useState<number>(attrs.rows ?? MIN_ROWS);
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
        {attrs.required && <RequiredBadge updateAttributes={props.updateAttributes} />}
      </div>

      <div className="long-answer-field-wrapper" contentEditable={false}>
        <textarea
          className="block-placeholder-input long-answer-textarea"
          placeholder="Type placeholder text"
          value={attrs.placeholder || ""}
          rows={rows}
          onChange={(e) => props.updateAttributes({ placeholder: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
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
      placeholder: placeholderAttribute,
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
        return inlineQuestionEnterShortcut(this.editor, "longAnswerBlock");
      },
    };
  },
});
