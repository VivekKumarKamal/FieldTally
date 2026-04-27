import { create } from "zustand";
import { EvaluateResult } from "../lib/logic";

interface LogicStore {
  // Form execution state
  answers: Record<string, any>;
  setAnswer: (blockId: string, answer: any) => void;
  setAllAnswers: (answers: Record<string, any>) => void;
  
  logicResult: EvaluateResult;
  setLogicResult: (result: EvaluateResult) => void;

  // Builder UI state
  activeBlockId: string | null;
  setActiveBlockId: (id: string | null) => void;
  isLogicTabOpen: boolean;
  setLogicTabOpen: (isOpen: boolean) => void;
}

export const useLogicStore = create<LogicStore>((set) => ({
  answers: {},
  setAnswer: (blockId, answer) => set((state) => ({ answers: { ...state.answers, [blockId]: answer } })),
  setAllAnswers: (answers) => set({ answers }),

  logicResult: { jumpTo: null, visibility: {}, end: false },
  setLogicResult: (logicResult) => set({ logicResult }),

  activeBlockId: null,
  setActiveBlockId: (activeBlockId) => set({ activeBlockId }),
  
  isLogicTabOpen: false,
  setLogicTabOpen: (isLogicTabOpen) => set({ isLogicTabOpen }),
}));
