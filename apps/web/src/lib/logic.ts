export type Operator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "between"
  | "before"
  | "after";

export type LogicCondition = {
  id: string;
  field: string;
  operator: Operator;
  value?: any;
};

export type LogicAction = {
  type: "jump" | "hide" | "show" | "end";
  targets: string[]; // now an array
};

export type LogicRule = {
  id: string;
  conditions: LogicCondition[];
  conditionOperator: "AND" | "OR";
  action: LogicAction;
};

export type LogicBlockNode = {
  id: string;
  type: string;
  rule?: LogicRule; // if it's a logicBlock
  logic?: LogicRule[]; // legacy/fallback
};

export type EvaluateResult = {
  jumpTo: string | null;
  visibility: Record<string, boolean>;
  end: boolean;
};

function parseComparableDate(value: any): number | null {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function evaluateCondition(cond: LogicCondition, answer: any): boolean {
  if (cond.operator === "is_empty") return answer == null || answer === "" || (Array.isArray(answer) && answer.length === 0);
  if (cond.operator === "is_not_empty") return answer != null && answer !== "" && !(Array.isArray(answer) && answer.length === 0);

  if (answer == null) return false;

  switch (cond.operator) {
    case "equals": return answer === cond.value;
    case "not_equals": return answer !== cond.value;
    case "contains":
      if (Array.isArray(answer)) return answer.includes(cond.value);
      if (typeof answer === "string") return answer.includes(cond.value);
      return false;
    case "not_contains":
      if (Array.isArray(answer)) return !answer.includes(cond.value);
      if (typeof answer === "string") return !answer.includes(cond.value);
      return false;
    case "greater_than": return Number(answer) > Number(cond.value);
    case "less_than": return Number(answer) < Number(cond.value);
    case "between": {
      const [min, max] = Array.isArray(cond.value) ? cond.value : [0, 0];
      const num = Number(answer);
      return num >= Number(min) && num <= Number(max);
    }
    case "before": {
      const answerValue = parseComparableDate(answer);
      const conditionValue = parseComparableDate(cond.value);
      return answerValue != null && conditionValue != null && answerValue < conditionValue;
    }
    case "after": {
      const answerValue = parseComparableDate(answer);
      const conditionValue = parseComparableDate(cond.value);
      return answerValue != null && conditionValue != null && answerValue > conditionValue;
    }
    default: return false;
  }
}

export function evaluateLogic(blocks: LogicBlockNode[], answers: Record<string, any>): EvaluateResult {
  const visibility: Record<string, boolean> = {};
  
  // By default, all non-logic blocks are visible
  blocks.forEach(b => {
    if (b.type !== "logicBlock") visibility[b.id] = true; 
  });
  
  // If a block is the target of a "show" rule, its default state should be hidden
  blocks.forEach(b => {
    const rulesToRun: LogicRule[] = [];
    if (b.type === "logicBlock" && b.rule) {
      rulesToRun.push(b.rule);
    } else if (b.logic && b.logic.length > 0) {
      rulesToRun.push(...b.logic);
    }

    rulesToRun.forEach(rule => {
      if (rule.action.type === "show" && rule.action.targets) {
        rule.action.targets.forEach(t => {
          visibility[t] = false;
        });
      }
    });
  });

  let jumpTo: string | null = null;
  let end = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    if (jumpTo || end) continue;

    // Collect rules to run. For new logicBlock it's `block.rule`. For legacy it's `block.logic`.
    const rulesToRun: LogicRule[] = [];
    if (block.type === "logicBlock" && block.rule) {
      rulesToRun.push(block.rule);
    } else if (block.logic && block.logic.length > 0) {
      rulesToRun.push(...block.logic);
    }

    if (rulesToRun.length === 0) continue;

    for (const rule of rulesToRun) {
      if (!rule.conditions || rule.conditions.length === 0) continue;

      let matched = false;
      if (rule.conditionOperator === "OR") {
        matched = rule.conditions.some(cond => evaluateCondition(cond, answers[cond.field]));
      } else { // AND
        matched = rule.conditions.every(cond => evaluateCondition(cond, answers[cond.field]));
      }

      if (matched) {
        if (rule.action.type === "hide" && rule.action.targets) {
          rule.action.targets.forEach(t => visibility[t] = false);
        } else if (rule.action.type === "show" && rule.action.targets) {
          rule.action.targets.forEach(t => visibility[t] = true);
        } else if (rule.action.type === "jump" && rule.action.targets && rule.action.targets.length > 0) {
          const target = rule.action.targets[0];
          jumpTo = target;
          
          let hideMode = false;
          for (const targetBlock of blocks) {
            if (targetBlock.id === block.id) hideMode = true;
            else if (targetBlock.id === target) hideMode = false;
            else if (hideMode && targetBlock.type !== "logicBlock") visibility[targetBlock.id] = false;
          }
        } else if (rule.action.type === "end") {
          end = true;
          for (let j = i + 1; j < blocks.length; j++) {
            if (blocks[j].type !== "logicBlock") visibility[blocks[j].id] = false;
          }
        }
        // First matching rule wins for this block, then move to next block
        break;
      }
    }
  }

  return { jumpTo, visibility, end };
}
