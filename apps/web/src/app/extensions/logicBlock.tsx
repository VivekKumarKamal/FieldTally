import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useMemo } from "react";
import { LogicRule, LogicCondition, Operator, LogicAction } from "../../lib/logic";
import { GitBranch, Zap, Trash2, Plus, X } from "lucide-react";

const OPERATORS_BY_TYPE: Record<string, Operator[]> = {
  shortAnswerBlock: ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"],
  longAnswerBlock: ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"],
  numberAnswerBlock: ["equals", "not_equals", "greater_than", "less_than", "between", "is_empty", "is_not_empty"],
  checkboxBlock: ["contains", "not_contains", "is_empty", "is_not_empty"],
  multipleChoiceBlock: ["equals", "not_equals", "is_empty", "is_not_empty"],
  dateAnswerBlock: ["equals", "not_equals", "before", "after", "is_empty", "is_not_empty"],
  timeAnswerBlock: ["equals", "not_equals", "before", "after", "is_empty", "is_not_empty"],
  emailAnswerBlock: ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"],
  phoneAnswerBlock: ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"],
  linkAnswerBlock: ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"],
};

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: "Is",
  not_equals: "Is not",
  contains: "Contains",
  not_contains: "Does not contain",
  is_empty: "Is empty",
  is_not_empty: "Is not empty",
  greater_than: "Is greater than",
  less_than: "Is less than",
  between: "Is between",
  before: "Is before",
  after: "Is after",
};

const LogicBlockComponent = (props: any) => {
  const rule: LogicRule = props.node.attrs.rule || {
    id: props.node.attrs.id || crypto.randomUUID(),
    conditions: [{ id: crypto.randomUUID(), field: "", operator: "equals", value: "" }],
    conditionOperator: "AND",
    action: { type: "show", targets: [] },
  };

  const updateRule = (changes: Partial<LogicRule>) => {
    props.updateAttributes({ rule: { ...rule, ...changes } });
  };

  const updateCondition = (condId: string, changes: Partial<LogicCondition>) => {
    updateRule({
      conditions: rule.conditions.map(c => c.id === condId ? { ...c, ...changes } : c)
    });
  };

  const deleteCondition = (condId: string) => {
    updateRule({
      conditions: rule.conditions.filter(c => c.id !== condId)
    });
  };

  const addCondition = () => {
    updateRule({
      conditions: [...rule.conditions, { id: crypto.randomUUID(), field: "", operator: "equals", value: "" }]
    });
  };

  const blocks = useMemo(() => {
    const list: any[] = [];
    props.editor.state.doc.descendants((node: any) => {
      if (node.type.name.endsWith("Block") && node.type.name !== "logicBlock") {
        list.push({ node, id: node.attrs.id });
      }
    });
    return list;
  }, [props.editor.state.doc, props.node]);

  const getBlockLabel = (b: any) => {
    let text = "";
    if (b.node.firstChild && b.node.firstChild.isBlock) {
      text = b.node.firstChild.textContent;
    } else {
      text = b.node.textContent;
    }
    return text || "Untitled Question";
  };

  const toggleTarget = (targetId: string) => {
    const targets = rule.action.targets || [];
    if (targets.includes(targetId)) {
      updateRule({ action: { ...rule.action, targets: targets.filter(t => t !== targetId) } });
    } else {
      updateRule({ action: { ...rule.action, targets: [...targets, targetId] } });
    }
  };

  return (
    <NodeViewWrapper className="logic-block-wrapper my-6 p-4 border-l-4 border-l-zinc-300 bg-zinc-50/50 rounded-r-lg relative group">
      
      {/* WHEN SECTION */}
      <div className="flex flex-col gap-3">
        {rule.conditions.map((cond, index) => {
          const selectedFieldBlock = blocks.find(b => b.id === cond.field);
          const allowedOperators: Operator[] = selectedFieldBlock ? OPERATORS_BY_TYPE[selectedFieldBlock.node.type.name] || ["equals"] : ["equals"];

          return (
            <div key={cond.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20 text-zinc-600 shrink-0">
                {index === 0 ? (
                  <>
                    <GitBranch size={16} className="text-zinc-400" />
                    <span className="font-medium text-sm">When</span>
                  </>
                ) : (
                  <button 
                    onClick={() => updateRule({ conditionOperator: rule.conditionOperator === "AND" ? "OR" : "AND" })}
                    className="ml-6 px-1.5 py-0.5 text-xs font-bold bg-zinc-200 text-zinc-600 rounded hover:bg-zinc-300"
                  >
                    {rule.conditionOperator}
                  </button>
                )}
              </div>

              <select
                className="flex-1 max-w-[240px] text-sm border border-zinc-200 rounded-md px-3 py-2 bg-white outline-none focus:border-blue-500 shadow-sm text-ellipsis overflow-hidden whitespace-nowrap"
                value={cond.field}
                onChange={(e) => {
                  const newField = e.target.value;
                  const newFieldBlock = blocks.find(b => b.id === newField);
                  const ops: Operator[] = newFieldBlock ? OPERATORS_BY_TYPE[newFieldBlock.node.type.name] || ["equals"] : ["equals"];
                  updateCondition(cond.id, { field: newField, operator: ops[0] });
                }}
              >
                <option value="" disabled>Select question...</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{getBlockLabel(b)}</option>)}
              </select>

              <select
                className="w-32 text-sm border border-zinc-200 rounded-md px-3 py-2 bg-white outline-none focus:border-blue-500 shadow-sm shrink-0"
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, { operator: e.target.value as Operator })}
              >
                {allowedOperators.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
              </select>

              {!["is_empty", "is_not_empty"].includes(cond.operator) && (
                <input
                  type="text"
                  placeholder="Value"
                  className="flex-1 max-w-[200px] text-sm border border-zinc-200 rounded-md px-3 py-2 bg-white outline-none focus:border-blue-500 shadow-sm shrink-0"
                  value={cond.value || ""}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                />
              )}

              {rule.conditions.length > 1 && (
                <button onClick={() => deleteCondition(cond.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0 transition-colors" title="Delete condition">
                  <Trash2 size={16} />
                </button>
              )}
              {index === rule.conditions.length - 1 && (
                <button onClick={addCondition} className="p-1 text-zinc-400 hover:text-blue-500 rounded shrink-0" title="Add condition">
                  <Plus size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* THEN SECTION */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-200/50">
        <div className="flex items-center gap-2 w-20 text-zinc-600">
          <Zap size={16} className="text-zinc-400" />
          <span className="font-medium text-sm">Then</span>
        </div>

        <select
          className="w-40 text-sm border border-zinc-200 rounded-md px-3 py-2 bg-white outline-none focus:border-blue-500 shadow-sm"
          value={rule.action.type}
          onChange={(e) => updateRule({ action: { ...rule.action, type: e.target.value as LogicAction["type"] } })}
        >
          <option value="show">Show blocks</option>
          <option value="hide">Hide blocks</option>
          <option value="jump">Jump to</option>
          <option value="end">End form</option>
        </select>

        {rule.action.type !== "end" && (
          <div className="flex-1 min-w-0">
            <div className="w-full min-h-[38px] text-sm border border-zinc-200 rounded-md p-1 bg-white shadow-sm flex flex-wrap gap-1 items-center">
              {(rule.action.targets || []).map(tId => {
                const b = blocks.find(b => b.id === tId);
                return (
                  <span key={tId} className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-xs flex items-center gap-1.5 border border-zinc-200">
                    <span className="truncate max-w-[160px]">{b ? getBlockLabel(b) : "Unknown"}</span>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTarget(tId); }} className="hover:text-red-500 text-zinc-400"><X size={12} /></button>
                  </span>
                );
              })}
              
              <select
                className="flex-1 min-w-[140px] outline-none bg-transparent cursor-pointer px-2 py-1 text-zinc-600 text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleTarget(e.target.value);
                }}
              >
                <option value="" disabled>Select blocks...</option>
                {blocks.filter(b => !(rule.action.targets || []).includes(b.id)).map(b => (
                  <option key={b.id} value={b.id}>{getBlockLabel(b)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

    </NodeViewWrapper>
  );
};

export const LogicBlock = Node.create({
  name: "logicBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      rule: {
        default: null,
        parseHTML: element => JSON.parse(element.getAttribute("data-rule") || "null"),
        renderHTML: attributes => ({ "data-rule": JSON.stringify(attributes.rule) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="logic-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "logic-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LogicBlockComponent);
  },
});
