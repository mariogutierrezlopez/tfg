import { resampleRoute } from "./resampleRoute";
import { point as turfPoint, lineString } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import { TrafficElement } from "../utils/types";

export const fetchRouteFrom = async (
  origin: [number, number],
  destination: [number, number],
  token: string
): Promise<{
  routeData: { coordinates: [number, number][], stepSpeeds: number[] },
  trafficRules: TrafficElement[]
} | null> => {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&overview=full&steps=true&annotations=maxspeed&access_token=${token}`;
  const response = await fetch(url);
  const data = await response.json();

  const route = data.routes?.[0];
  if (!route || route.geometry.coordinates.length < 2) return null;

  const coordinates = resampleRoute(route.geometry.coordinates, 3);
  const steps = route.legs?.[0]?.steps ?? [];

  const stepSpeeds = steps.map((step) => {
    const raw = step.maxspeed?.speed ?? null;
    const roadClass = step.class ?? "unknown";

    let fallback = 30;
    switch (roadClass) {
      case "motorway": fallback = 120; break;
      case "primary": fallback = 100; break;
      case "secondary": fallback = 80; break;
      case "tertiary": fallback = 60; break;
      case "residential": fallback = 50; break;
    }

    const kmh = raw ?? fallback;
    return kmh / 3.6;
  });

  // EXTRAER Y AJUSTAR TRAFFIC RULES
  const resampledLine = lineString(coordinates);
  const extractedRules: TrafficElement[] = [];

  steps.forEach((step, i) => {
    const loc = step.maneuver?.location;
    const type = step.maneuver?.type;
    if (!loc || !type) return;

    if (type === "roundabout" || type === "rotary") {
      extractedRules.push({
        id: `roundabout-${i}`,
        type: "roundabout",
        location: loc as [number, number],
        radius: 30,
        priorityRule: "must-stop",
      });
    } else if (type === "merge" || type === "fork" || type === "turn") {
      extractedRules.push({
        id: `yield-${i}`,
        type: "yield",
        location: loc as [number, number],
        radius: 15,
        priorityRule: "give-way",
      });
    }
  });

  // Eliminar duplicados por distancia
  const uniqueRules: TrafficElement[] = [];
  for (const rule of extractedRules) {
    const isTooClose = uniqueRules.some((r) =>
      distance(turfPoint(rule.location), turfPoint(r.location), { units: "meters" }) < 10 &&
      r.type === rule.type
    );
    if (!isTooClose) uniqueRules.push(rule);
  }

  // Snap de reglas al recorrido
  const adjustedRules = uniqueRules.map((rule) => {
    const snapped = nearestPointOnLine(resampledLine, turfPoint(rule.location));
    return {
      ...rule,
      location: [snapped.geometry.coordinates[0], snapped.geometry.coordinates[1]],
    };
  });

  return {
    routeData: { coordinates, stepSpeeds },
    trafficRules: adjustedRules,
  };
};
