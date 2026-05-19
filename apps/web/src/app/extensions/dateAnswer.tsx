import { createSimpleAnswerBlock } from "./simpleAnswerBlock";

export const DateAnswerBlock = createSimpleAnswerBlock({
  name: "dateAnswerBlock",
  dataType: "date-answer-block",
  className: "date-answer-block",
  titleClassName: "date-answer-title",
});
