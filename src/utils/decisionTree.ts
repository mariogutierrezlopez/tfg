// src/utils/decisionTree.ts
export type Operator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface Condition {
  feature: string;
  operator: Operator;
  value: number;
}

export interface ConditionNode {
  condition: Condition;
  true: TreeNode;
  false: TreeNode;
}

export interface ActionNode {
  action: string;
}

export type TreeNode = ConditionNode | ActionNode;

/**
 * Evalúa recursivamente el árbol dado un conjunto de inputs.
 */
export function evalTree(node: TreeNode, inputs: Record<string, number>): string {
  if ('action' in node) {
    return node.action;
  } else {
    const { feature, operator, value } = node.condition;
    const x = inputs[feature] ?? 0;
    let test = false;
    switch (operator) {
      case '>':  test = x >  value; break;
      case '<':  test = x <  value; break;
      case '>=': test = x >= value; break;
      case '<=': test = x <= value; break;
      case '==': test = x === value; break;
      case '!=': test = x !== value; break;
    }
    return evalTree(test ? node.true : node.false, inputs);
  }
}
