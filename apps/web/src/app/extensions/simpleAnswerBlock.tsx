import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import React from "react";
import { Tooltip } from "../../components/Tooltip";

type SimpleAnswerBlockConfig = {
  name: string;
  dataType: string;
  className: string;
  titleClassName: string;
  renderField?: (props: NodeViewProps) => React.ReactNode;
};

type PlaceholderAttrs = { placeholder?: string };
type RequiredAttrs = { required?: boolean };

const PlaceholderInput = (props: NodeViewProps) => (
  <input
    className="block-placeholder-input"
    contentEditable={false}
    type="text"
    placeholder="Type placeholder text"
    value={(props.node.attrs as PlaceholderAttrs).placeholder || ""}
    onChange={(e) => props.updateAttributes({ placeholder: e.target.value })}
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
  />
);

export const LinkPlaceholderField = (props: NodeViewProps) => (
  <div className="link-answer-field" contentEditable={false}>
    <span className="text-zinc-500 font-medium">https://</span>
    <input
      className="block-placeholder-input flex-1"
      type="text"
      placeholder="Type placeholder text"
      value={(props.node.attrs as PlaceholderAttrs).placeholder || ""}
      onChange={(e) => props.updateAttributes({ placeholder: e.target.value })}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

export const RequiredBadge = ({ updateAttributes }: { updateAttributes: NodeViewProps["updateAttributes"] }) => (
  <Tooltip content={<span className="text-zinc-300">Required<span className="text-white font-bold ml-1">*</span></span>}>
    <span
      className="required-badge"
      contentEditable={false}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttributes({ required: false });
      }}
    >
      *
    </span>
  </Tooltip>
);

export const placeholderAttribute = {
  default: "",
  renderHTML: (attributes: PlaceholderAttrs) => ({ "data-placeholder": attributes.placeholder || "" }),
  parseHTML: (element: HTMLElement) => element.getAttribute("data-placeholder") || "",
};

export const inlineQuestionEnterShortcut = (editor: TiptapEditor, nodeName: string) => {
  const { state } = editor;
  const { $from, empty } = state.selection;

  if (!empty || $from.parent.type.name !== nodeName) return false;

  const start = $from.before();
  const end = $from.after();
  const paragraph = state.schema.nodes.paragraph.create();
  const tr = $from.parent.textContent.trim() === ""
    ? state.tr.replaceWith(start, end, paragraph)
    : state.tr.insert(end, paragraph);
  const nextPos = $from.parent.textContent.trim() === "" ? start + 1 : end + 1;

  tr.setSelection(TextSelection.create(tr.doc, nextPos));
  editor.view.dispatch(tr);
  return true;
};

export function createSimpleAnswerBlock(config: SimpleAnswerBlockConfig) {
  const Component = (props: NodeViewProps) => (
    <NodeViewWrapper className={config.className} data-required={(props.node.attrs as RequiredAttrs).required ? "true" : undefined}>
      <div className="question-title-row">
        <NodeViewContent as="div" className={`${config.titleClassName} outline-none`} />
        {(props.node.attrs as RequiredAttrs).required && <RequiredBadge updateAttributes={props.updateAttributes} />}
      </div>
      {(config.renderField || PlaceholderInput)(props)}
    </NodeViewWrapper>
  );

  return Node.create({
    name: config.name,
    group: "block",
    content: "inline*",
    draggable: true,

    addAttributes() {
      return { placeholder: placeholderAttribute };
    },

    parseHTML() {
      return [{ tag: `div[data-type="${config.dataType}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-type": config.dataType }), 0];
    },

    addNodeView() {
      return ReactNodeViewRenderer(Component);
    },

    addKeyboardShortcuts() {
      return {
        Enter: () => inlineQuestionEnterShortcut(this.editor, config.name),
      };
    },
  });
}
