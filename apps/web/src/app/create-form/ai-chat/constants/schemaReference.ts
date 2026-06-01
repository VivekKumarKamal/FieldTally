export const SCHEMA_REFERENCE = `
You generate FieldTally form schemas. Output must be valid JSON matching this structure:
{ "type": "doc", "content": [...nodes] }

QUESTION NODES:
- shortAnswerBlock: { type, attrs: { id, required, placeholder }, content: [{type:"text",text:"Question label"}] }
- longAnswerBlock: { type, attrs: { id, required, placeholder, rows }, content: [{type:"text",text:"..."}] }
- numberAnswerBlock: { type, attrs: { id, required, placeholder }, content: [{type:"text",text:"..."}] }
- multipleChoiceBlock: { type, attrs: { id, required }, content: [ {type:"multipleChoiceTitle", content:[{type:"text",text:"Question"}]}, {type:"multipleChoiceOption", content:[{type:"text",text:"Option text"}]}, ... ] }
- checkboxBlock: same structure as multipleChoiceBlock but type:"checkboxBlock", "checkboxTitle", "checkboxOption"
- dateAnswerBlock / timeAnswerBlock / emailAnswerBlock / phoneAnswerBlock / linkAnswerBlock: { type, attrs: { id, required }, content: [{type:"text",text:"..."}] }

SPECIAL FIELDS (only include when context demands):
- gpsAnswerBlock: { type, attrs: { id, required }, content: [{type:"text",text:"..."}] }
- imageAnswerBlock: same
- signatureAnswerBlock: same

LAYOUT NODES:
- heading: { type, attrs: { level: 1|2|3 }, content: [{type:"text",text:"..."}] }
- paragraph: { type, content: [{type:"text",text:"..."}] }
- horizontalRule: { type: "horizontalRule" }

LOGIC:
- logicBlock: { type:"logicBlock", attrs: { rule: { id, conditionOperator:"AND"|"OR", conditions:[{id,field,operator:"equals"|"notEquals"|"contains",value}], action:{type:"show"|"hide",targets:[fieldId,...]} } } }

IDs: generate as "q_" + short_snake_case descriptor. Each ID must be globally unique — never duplicate an id across blocks.
Logic rule IDs: "rule_" + descriptor. Each rule id and condition id must also be unique.

LOGIC PLACEMENT: All logicBlock nodes MUST appear at the END of the content array, after every question and layout node. Never place a logicBlock between questions.
`;
