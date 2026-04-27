import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import React from "react";
import { Tooltip } from "../../components/Tooltip";

const NumberAnswerComponent = (props: any) => {
  return (
    <NodeViewWrapper className="number-answer-block" data-required={props.node.attrs.required ? "true" : undefined}>
      <div className="question-title-row">
        <NodeViewContent 
          as="div"
          className="number-answer-title outline-none" 
        />
        {props.node.attrs.required && (
          <Tooltip content={<span className="text-zinc-300">Required <span className="text-white font-bold ml-1">*</span></span>}>
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
      <input className="block-placeholder-input" contentEditable={false} type="text" placeholder="Type placeholder text" value={props.node.attrs.placeholder || ""} onChange={(e) => props.updateAttributes({ placeholder: e.target.value })} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
    </NodeViewWrapper>
  );
};

export const NumberAnswerBlock = Node.create({
  name: "numberAnswerBlock",
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
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="number-answer-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "number-answer-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NumberAnswerComponent);
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        
        if (!empty || $from.parent.type.name !== "numberAnswerBlock") return false;

        const start = $from.before();
        const end = $from.after();

        if ($from.parent.textContent.trim() === "") {
          const tr = state.tr.replaceWith(
            start, end, state.schema.nodes.paragraph.create()
          );
          tr.setSelection(TextSelection.create(tr.doc, start + 1));
          this.editor.view.dispatch(tr);
          return true;
        } else {
          // Has text: insert a paragraph below the block and jump to it
          const tr = state.tr.insert(end, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, end + 1));
          this.editor.view.dispatch(tr);
          return true;
        }
      },
    };
  },
});
