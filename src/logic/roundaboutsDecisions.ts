// src/utils/roundaboutsDecisions.ts

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
  // 1) Si node viene undefined -> STOP
  if (!node) {
    console.warn("⚠️ evalTree: nodo indefinido, fallback a STOP");
    return "STOP";
  }

  // 2) Si es ActionNode
  if ('action' in node) {
    return node.action;
  }

  // 3) Si es ConditionNode, ejecutamos la prueba
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

  // 4) Elegimos la rama
  const next = test ? node.true : node.false;
  if (!next) {
    console.warn(
      `⚠️ evalTree: rama ${test?"true":"false"} de condición ` +
      `${feature} ${operator} ${value} indefinida, STOP.`
    );
    return "STOP";
  }

  // 5) Recurse
  return evalTree(next, inputs);
}
