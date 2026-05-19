import { createSimpleAnswerBlock } from "./simpleAnswerBlock";

export const NumberAnswerBlock = createSimpleAnswerBlock({
  name: "numberAnswerBlock",
  dataType: "number-answer-block",
  className: "number-answer-block",
  titleClassName: "number-answer-title",
});
