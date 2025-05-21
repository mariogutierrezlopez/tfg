// src/logic/agents/spawnCar.ts   (o donde tengas la función)
import { fetchRouteWithSpeeds } from "../../utils/mapboxDirections";
import { CarAgent } from "./CarAgents";
import type { CarOption } from "../../utils/types";

// 🆕
import { drawCarRoute } from "../../utils/mapUtils";
import { resampleRoute } from "../../utils/resampleRoute";

export async function spawnCar(
  map: mapboxgl.Map,           // ① nuevo parámetro
  id: string,
  origin: [number, number],
  destination: [number, number],
  marker: mapboxgl.Marker,
  carType: CarOption
): Promise<CarAgent> {

  /** 1️⃣  Ruta + límites de velocidad */
  const { geometry, stepSpeeds } =
    await fetchRouteWithSpeeds([origin, destination]);

  /** 2️⃣  Dibuja la poly-linea y el destino  */
  const drawCoords = resampleRoute(geometry, 3);        // opcional: suaviza
  drawCarRoute(map, id, drawCoords, "#2563eb");         // color azul

  /** 3️⃣  Crea el agente */
  const startPos = geometry[0];
  const route = geometry.slice(1);                   // resto de puntos

  return new CarAgent(id, startPos, route, marker, carType, stepSpeeds);
}
