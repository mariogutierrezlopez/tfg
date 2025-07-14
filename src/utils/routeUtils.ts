/* src/utils/routeUtils.ts ---------------------------------------------- */
import { resampleRoute }          from "./resampleRoute";
import { fetchRouteWithSpeeds }   from "./mapboxDirections";
import { getTrafficRules }        from "./trafficRules";     // ↖ tu helper
import type { TrafficElement }    from "../utils/types";

/** Devuelve la geometría “cruda” + velocidades y las traffic-rules */
export async function fetchRouteFrom(
  origin:      [number, number],
  destination: [number, number],
  token:       string
): Promise<{
  routeData: {
    coordinates : [number, number][],   // para el coche  (raw)
    drawCoords  : [number, number][],   // para el mapa   (resample)
    stepSpeeds  : number[],             // m/s, 1 por segmento (raw)
  },
  trafficRules: TrafficElement[],
} | null> {

  const { geometry, stepSpeeds } =
    await fetchRouteWithSpeeds([origin, destination]);

  if (!geometry || geometry.length < 2) return null;

  const rawCoords  = geometry;                 // ← SIN resamplear
  const drawCoords = resampleRoute(geometry, 3);

  const trafficRules = await getTrafficRules(
    origin, destination, geometry, token
  );

  return {
    routeData : { coordinates: rawCoords, drawCoords, stepSpeeds },
    trafficRules,
  };
}
