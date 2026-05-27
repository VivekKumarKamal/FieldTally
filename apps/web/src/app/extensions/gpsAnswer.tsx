import { createSimpleAnswerBlock } from "./simpleAnswerBlock";
import { MapPin } from "lucide-react";
import type { NodeViewProps } from "@tiptap/react";
import React from "react";

export const GpsPlaceholderField = (props: NodeViewProps) => (
  <div
    className="gps-placeholder-field flex items-center gap-2 border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-zinc-400 select-none"
    contentEditable={false}
  >
    <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
    <span className="text-sm font-medium">GPS location will be captured automatically</span>
  </div>
);

export const GpsAnswerBlock = createSimpleAnswerBlock({
  name: "gpsAnswerBlock",
  dataType: "gps-answer-block",
  className: "gps-answer-block",
  titleClassName: "gps-answer-title",
  renderField: GpsPlaceholderField,
});
