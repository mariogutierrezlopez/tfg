// src/utils/routeUtils.ts
import { resampleRoute }  from "./resampleRoute";
import { fetchRouteWithSpeeds } from "./mapboxDirections";
import { getTrafficRules } from "./trafficRules";
import { TrafficElement }  from "../utils/types";

export async function fetchRouteFrom(
  origin:[number,number], destination:[number,number], token:string
): Promise<{routeData:{coordinates:[number,number][],stepSpeeds:number[]},trafficRules:TrafficElement[]} | null>{

  const { geometry, stepSpeeds } =
    await fetchRouteWithSpeeds([origin,destination]);

  const coordinates = resampleRoute(geometry,3);      // o quita si no quieres

  const trafficRules = await getTrafficRules(
    origin, destination, coordinates, token
  );

  return { routeData:{ coordinates, stepSpeeds }, trafficRules };
}
