import { createSimpleAnswerBlock, LinkPlaceholderField } from "./simpleAnswerBlock";

export const LinkAnswerBlock = createSimpleAnswerBlock({
  name: "linkAnswerBlock",
  dataType: "link-answer-block",
  className: "link-answer-block",
  titleClassName: "link-answer-title",
  renderField: LinkPlaceholderField,
});
