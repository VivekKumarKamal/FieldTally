import { createSimpleAnswerBlock } from "./simpleAnswerBlock";
import { Image } from "lucide-react";
import type { NodeViewProps } from "@tiptap/react";
import React from "react";

export const ImagePlaceholderField = (props: NodeViewProps) => (
  <div
    className="image-placeholder-field flex items-center gap-2 border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-zinc-400 select-none"
    contentEditable={false}
  >
    <Image className="w-4 h-4 text-zinc-400 shrink-0" />
    <span className="text-sm font-medium">Image Input (Upload file)</span>
  </div>
);

export const ImageAnswerBlock = createSimpleAnswerBlock({
  name: "imageAnswerBlock",
  dataType: "image-answer-block",
  className: "image-answer-block",
  titleClassName: "image-answer-title",
  renderField: ImagePlaceholderField,
});
