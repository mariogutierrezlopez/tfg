// src/utils/types.ts
export type TrafficElementType = "stop" | "yield" | "roundabout";
export type TrafficPriorityRule = "must-stop" | "give-way";

export type TrafficElement = {
  id: string;
  type: TrafficElementType;
  location: [number, number];      // Para rotondas, este será el centroide calculado
  maneuverPoint?: [number, number]; // El punto original de la maniobra (ej. entrada)
  geometry?: [number, number][];   // Geometría real del camino de la rotonda
  radius: number;                   // Radio (puede ser estimado para rotondas)
  priorityRule: TrafficPriorityRule;
};

export const vehicleSizes: Record<string, { w: number; h: number }> = {
  car:        { w: 36, h: 60 },
  truck:      { w: 80, h: 60 },
  motorcycle: { w: 20, h: 40 },
};