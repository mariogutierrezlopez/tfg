import { fetchRouteWithSpeeds } from "../../utils/mapboxDirections";
import { CarAgent } from "./CarAgents";
import type { CarOption } from "../../utils/types";

export async function spawnCar(
  id: string,
  origin: [number, number],
  destination: [number, number],
  marker: mapboxgl.Marker,
  carType: CarOption
): Promise<CarAgent> {
  const { geometry, stepSpeeds } = await fetchRouteWithSpeeds([
    origin,
    destination,
  ]);

  const startPos = geometry[0];
  const route    = geometry.slice(1);

  return new CarAgent(id, startPos, route, marker, carType, stepSpeeds);
}
