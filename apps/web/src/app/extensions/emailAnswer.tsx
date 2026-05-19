import { createSimpleAnswerBlock } from "./simpleAnswerBlock";

export const EmailAnswerBlock = createSimpleAnswerBlock({
  name: "emailAnswerBlock",
  dataType: "email-answer-block",
  className: "email-answer-block",
  titleClassName: "email-answer-title",
});
