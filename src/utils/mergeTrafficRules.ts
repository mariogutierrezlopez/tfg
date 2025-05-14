// utils/mergeTrafficRules.ts
import { TrafficElement } from "../utils/types";

/**
 * Devuelve un array sin duplicados.
 * Si el mismo id aparece varias veces, conserva la versión más reciente.
 */
export const mergeTrafficRules = (
  prev: TrafficElement[],
  next: TrafficElement[]
): TrafficElement[] => {
  const map = new Map<string, TrafficElement>();

  prev.forEach(rule => map.set(rule.id, rule));
  next.forEach(rule => map.set(rule.id, rule));   // sobreescribe si duplica

  return Array.from(map.values());
};
