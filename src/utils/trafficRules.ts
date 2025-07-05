// src/utils/trafficRules.ts
import { TrafficElement } from "../utils/types";

export async function getTrafficRules(
  origin: [number, number],
  destination: [number, number],
  _snappedRoute: [number, number][],
  token: string
): Promise<TrafficElement[]> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.join(",")};${destination.join(",")}` +
    `?geometries=geojson&overview=full&steps=true&access_token=${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error("TRAFFIC_RULES: Fallo al obtener reglas de Mapbox API", response.status, await response.text());
    return [];
  }
  const data = await response.json();
  const steps = data.routes?.[0]?.legs?.[0]?.steps ?? [];
  const rules: TrafficElement[] = [];

  // ----- BEGIN CONFIGURACIÓN MANUAL PARA TU ROTONDA ESPECÍFICA -----
  const TARGET_ROUNDABOUT_MANEUVER_LON = -3.836740745191605; // NUEVA Longitud de la entrada a la rotonda (ajustada)
  const TARGET_ROUNDABOUT_MANEUVER_LAT = 40.423808446010696; // NUEVA Latitud de la entrada a la rotonda (ajustada)
  const MANUAL_CENTER_LON = -3.836891092149699; // NUEVA Longitud central de la rotonda
  const MANUAL_CENTER_LAT = 40.42362622046832; // NUEVA Latitud central de la rotonda
  const MANUAL_RADIUS_METERS = 25;
  // ----- FIN CONFIGURACIÓN MANUAL -----

  steps.forEach((step: any, i: any) => {
    const maneuverLocation = step.maneuver?.location as [number, number] | undefined;
    if (!maneuverLocation) return;

    const type = step.maneuver.type;

    if (type === "roundabout" || type === "rotary" || type === "roundabout turn") {
      const roundaboutPathCoords = step.geometry?.coordinates as [number, number][] | undefined;

      let actualCenter: [number, number];
      let estimatedRadius: number;

      // Comprobar si es LA rotonda específica para el override manual
      const lonMatch = Math.abs(maneuverLocation[0] - TARGET_ROUNDABOUT_MANEUVER_LON) < 0.0001;
      const latMatch = Math.abs(maneuverLocation[1] - TARGET_ROUNDABOUT_MANEUVER_LAT) < 0.0001;
      const IS_TARGET_ROUNDABOUT = lonMatch && latMatch;

      if (IS_TARGET_ROUNDABOUT) {
        // Se mantiene el override manual para la rotonda de Boadilla
        console.log(`TRAFFIC_RULES: Aplicando OVERRIDE MANUAL para centro y radio de rotonda rb-${i}`);
        actualCenter = [MANUAL_CENTER_LON, MANUAL_CENTER_LAT];
        estimatedRadius = MANUAL_RADIUS_METERS;
      } else {
        // Nuevo comportamiento por defecto para el resto de rotondas:
        // El centro es el propio punto de la maniobra.
        console.log(`TRAFFIC_RULES: Usando maneuverPoint como centro para rotonda rb-${i}`);
        actualCenter = maneuverLocation;
        estimatedRadius = 30; // Asignamos un radio por defecto razonable.
      }

      rules.push({
        id: `rb-${i}`,
        type: "roundabout",
        location: actualCenter,
        maneuverPoint: maneuverLocation,
        geometry: roundaboutPathCoords,
        radius: estimatedRadius,
        priorityRule: "must-stop",
      });
    } else if (["merge", "fork", "turn"].includes(type) && (step.maneuver.modifier?.includes('yield') || step.maneuver.modifier?.includes('stop'))) {
       rules.push({
        id: `yield-${i}`,
        type: "yield",
        location: maneuverLocation,
        radius: 10,
        priorityRule: "give-way",
      });
    }
  });
  return rules;
}