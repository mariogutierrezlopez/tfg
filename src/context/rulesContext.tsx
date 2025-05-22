// src/context/RulesContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode
} from "react";
import type { TreeNode } from "../utils/decisionTree";

interface RulesContextType {
  tree: TreeNode | null;
  setTree: (t: TreeNode) => void;
}

const RulesContext = createContext<RulesContextType | undefined>(undefined);

interface RulesProviderProps {
  children: ReactNode;
}

export function RulesProvider({ children }: RulesProviderProps) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  return (
    <RulesContext.Provider value={{ tree, setTree }}>
      {children}
    </RulesContext.Provider>
  );
}

export function useRules() {
  const ctx = useContext(RulesContext);
  if (!ctx) {
    throw new Error("useRules debe usarse dentro de RulesProvider");
  }
  return ctx;
}
