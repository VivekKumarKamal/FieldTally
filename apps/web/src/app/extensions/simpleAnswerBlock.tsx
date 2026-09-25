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
  const isEmpty = $from.parent.textContent.trim() === "";
  // Caret at the start of non-empty text: same as the checkbox/MCQ blocks —
  // push the whole question down and leave an empty paragraph above it,
  // instead of always inserting below regardless of where Enter was pressed.
  const atStart = !isEmpty && $from.parentOffset === 0;

  let tr;
  let nextPos;
  if (isEmpty) {
    tr = state.tr.replaceWith(start, end, paragraph);
    nextPos = start + 1;
  } else if (atStart) {
    tr = state.tr.insert(start, paragraph);
    nextPos = start + 1;
  } else {
    tr = state.tr.insert(end, paragraph);
    nextPos = end + 1;
  }

  tr.setSelection(TextSelection.create(tr.doc, nextPos));
  editor.view.dispatch(tr);
  return true;
};

export const QuizAnswerBadge = () => (
  <Tooltip content={<span className="text-emerald-300">Answer <span className="text-white font-bold ml-0.5">set</span></span>}>
    <span
      className="quiz-answer-badge"
      contentEditable={false}
    >
      ✓
    </span>
  </Tooltip>
);

/** Point value for a graded question. checkboxBlock/multipleChoiceBlock get the
 *  same pill via a CSS decoration on their title (see quizAnswerPicker.ts) —
 *  this is the equivalent for numberAnswerBlock, which has no separate title
 *  node to decorate and is rendered by React already, so a real badge is less
 *  code than reaching for a decoration. */
export const QuizPointsBadge = ({ points }: { points: number }) => (
  <span
    className="quiz-points-badge"
    contentEditable={false}
  >
    {points} {points === 1 ? "point" : "points"}
  </span>
);

export function createSimpleAnswerBlock(config: SimpleAnswerBlockConfig) {
  const Component = (props: NodeViewProps) => (
    <NodeViewWrapper className={config.className} data-required={(props.node.attrs as RequiredAttrs).required ? "true" : undefined}>
      <div className="question-title-row">
        <NodeViewContent as="div" className={`${config.titleClassName} outline-none`} />
        {(props.node.attrs as RequiredAttrs).required && <RequiredBadge updateAttributes={props.updateAttributes} />}
        {props.node.attrs.correctAnswer != null && <QuizAnswerBadge />}
        {props.node.attrs.correctAnswer != null && <QuizPointsBadge points={props.node.attrs.quizPoints ?? 1} />}
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
      return {
        placeholder: placeholderAttribute,
        correctAnswer: {
          default: null,
          renderHTML: attributes => {
            if (attributes.correctAnswer == null) return {};
            return { "data-correct-answer": JSON.stringify(attributes.correctAnswer) };
          },
          parseHTML: element => {
            const raw = element.getAttribute("data-correct-answer");
            if (!raw) return null;
            try { return JSON.parse(raw); } catch { return null; }
          },
        },
        quizPoints: {
          default: 1,
          renderHTML: attributes => {
            if (attributes.quizPoints === 1) return {};
            return { "data-quiz-points": String(attributes.quizPoints) };
          },
          parseHTML: element => {
            const raw = element.getAttribute("data-quiz-points");
            return raw ? Number(raw) : 1;
          },
        },
      };
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
