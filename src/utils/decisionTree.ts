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
 * Si 'node' es undefined o malformed, devuelve "STOP" como fallback.
 */
export function evalTree(
  node: TreeNode | undefined,
  inputs: Record<string, number>
): string {
  if (!node) {
    console.warn("evalTree: nodo de reglas indefinido, fallback a STOP");
    return "STOP";
  }

  // Si es ActionNode
  if ('action' in node) {
    return node.action;
  }

  // Si es ConditionNode
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

  const nextNode = test ? node.true : node.false;
  // aquí protegemos otra vez por si alguien dejó un branch mal definido
  if (!nextNode) {
    console.warn(
      `evalTree: rama ${test ? 'true' : 'false'} de condición ${
        feature} ${operator} ${value} indefinida. STOP.`
    );
    return "STOP";
  }

  return evalTree(nextNode, inputs);
}
