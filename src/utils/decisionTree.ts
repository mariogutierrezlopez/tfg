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

/**
 * Valida recursivamente que un objeto se ajuste a la estructura de un TreeNode.
 * @param node El nodo del árbol a validar.
 * @returns `true` si el nodo y todos sus hijos son válidos, `false` en caso contrario.
 */
export function isValidDecisionTree(node: any): node is TreeNode {
  // Comprobación básica: el nodo debe ser un objeto y no ser nulo.
  if (typeof node !== 'object' || node === null) {
    return false;
  }

  // Comprobación de NODO DE ACCIÓN
  if ('action' in node) {
    // Si tiene una acción, debe ser un string y no debe tener otras propiedades como 'condition'.
    return typeof node.action === 'string' && Object.keys(node).length === 1;
  }

  // Comprobación de NODO DE CONDICIÓN
  if ('condition' in node && 'true' in node && 'false' in node) {
    const { condition, true: trueBranch, false: falseBranch } = node;

    // Validar la estructura del objeto 'condition'
    const isConditionValid =
      typeof condition === 'object' &&
      condition !== null &&
      typeof condition.feature === 'string' &&
      typeof condition.operator === 'string' &&
      typeof condition.value === 'number' &&
      ['>', '<', '>=', '<=', '==', '!='].includes(condition.operator);

    if (!isConditionValid) {
      return false;
    }

    // Validar recursivamente las ramas 'true' y 'false'
    return isValidDecisionTree(trueBranch) && isValidDecisionTree(falseBranch);
  }

  // Si no es ni un nodo de acción ni uno de condición válido, es incorrecto.
  return false;
}