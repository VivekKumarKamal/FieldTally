import { createSimpleAnswerBlock } from "./simpleAnswerBlock";
import { PenTool } from "lucide-react";
import type { NodeViewProps } from "@tiptap/react";
import React from "react";

export const SignaturePlaceholderField = (props: NodeViewProps) => (
  <div
    className="signature-placeholder-field flex flex-col justify-end border border-zinc-200 border-dashed bg-zinc-50 rounded-lg p-4 h-24 text-zinc-400 select-none"
    contentEditable={false}
  >
    <div className="flex items-center gap-2 mb-1 justify-center">
      <PenTool className="w-4 h-4 text-zinc-400 shrink-0" />
      <span className="text-sm font-medium">Signature Input (Draw inside box)</span>
    </div>
    <div className="w-full border-t border-zinc-200 border-dotted" />
  </div>
);

export const SignatureAnswerBlock = createSimpleAnswerBlock({
  name: "signatureAnswerBlock",
  dataType: "signature-answer-block",
  className: "signature-answer-block",
  titleClassName: "signature-answer-title",
  renderField: SignaturePlaceholderField,
});
