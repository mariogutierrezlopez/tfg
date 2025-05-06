export type TrafficElementType = "stop" | "yield" | "roundabout";

export type TrafficPriorityRule = "must-stop" | "give-way";

export type TrafficElement = {
  id: string;
  type: TrafficElementType;
  location: [number, number];
  radius: number; // radio de la rotonda
  priorityRule: TrafficPriorityRule;
};

export type CarOption = {
  id: string;        // "car" | "truck" | "motorcycle"
  name: string;      // "Coche", "Camión", "Moto"
  image: string;     // ruta de la imagen o icono
};
