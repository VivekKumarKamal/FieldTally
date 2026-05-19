import { createSimpleAnswerBlock } from "./simpleAnswerBlock";

export const ShortAnswerBlock = createSimpleAnswerBlock({
  name: "shortAnswerBlock",
  dataType: "short-answer-block",
  className: "short-answer-block",
  titleClassName: "short-answer-title",
});
