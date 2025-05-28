// src/utils/trafficRules.ts
import { TrafficElement } from "../utils/types";
import {
    point as turfPointFeature,
    lineString as turfLineString,
    centroid as turfCentroid,
    distance as turfDistance,
    bbox as turfBbox,
    center as turfBboxCenter,
    bboxPolygon
} from "@turf/turf";

// Función auxiliar para calcular el circuncentro (si decides mantenerla para otras rotondas)
function getCircumcenter(
    p1: [number, number], p2: [number, number], p3: [number, number]
): [number, number] | null {
    const x1 = p1[0], y1 = p1[1];
    const x2 = p2[0], y2 = p2[1];
    const x3 = p3[0], y3 = p3[1];
    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(D) < 1e-9) { // Aumentar ligeramente la tolerancia para colinealidad
        // console.warn("TRAFFIC_RULES: Puntos para circuncentro son colineales o casi.");
        return null;
    }
    const p1Sq = x1 * x1 + y1 * y1;
    const p2Sq = x2 * x2 + y2 * y2;
    const p3Sq = x3 * x3 + y3 * y3;
    const Ux = (1 / D) * (p1Sq * (y2 - y3) + p2Sq * (y3 - y1) + p3Sq * (y1 - y2));
    const Uy = (1 / D) * (p1Sq * (x3 - x2) + p2Sq * (x1 - x3) + p3Sq * (x2 - x1));
    return [Ux, Uy];
}

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
  //INFO_ROTONDA_DETECTADA: ID Propuesto: rb-<span class="math-inline">{i}, Punto de Maniobra: [</span>-3.831046, 40.405991]
  const TARGET_ROUNDABOUT_MANEUVER_LON = -3.831046; // EJEMPLO: Lon del punto de maniobra
  const TARGET_ROUNDABOUT_MANEUVER_LAT = 40.405991; // EJEMPLO: Lat del punto de maniobra

  const MANUAL_CENTER_LON = -3.830656186425358; // EJEMPLO: Lon del centro manual
  const MANUAL_CENTER_LAT = 40.406007761172845; // EJEMPLO: Lat del centro manual

  // 3. Introduce el RADIO estimado para los CARRILES de tu rotonda (desde el centro manual)
  const MANUAL_RADIUS_METERS = 32; // EJEMPLO: Radio en metros
  // ----- FIN CONFIGURACIÓN MANUAL -----

  steps.forEach((step: any, i: any) => {
    const maneuverLocation = step.maneuver?.location as [number, number] | undefined;
    if (!maneuverLocation) return;

    // Descomenta este log si necesitas reconfirmar los puntos de maniobra de otras rotondas
    // console.log(`INFO_ROTONDA_PROCESANDO: ID Propuesto: rb-${i}, Punto de Maniobra: [${maneuverLocation[0]}, ${maneuverLocation[1]}]`);

    const type = step.maneuver.type;

    if (type === "roundabout" || type === "rotary" || type === "roundabout turn") {
      const roundaboutPathCoords = step.geometry?.coordinates as [number, number][] | undefined;
     console.log(`INFO_ROTONDA_DETECTADA: ID Propuesto: rb-<span class="math-inline">\{i\}, Punto de Maniobra\: \[</span>${maneuverLocation[0]}, ${maneuverLocation[1]}]`);
 
      let actualCenter: [number, number] = maneuverLocation; // Default
      let estimatedRadius = 30; // Default

      // Comprobar si es LA rotonda específica para el override manual
      // Aumenta la tolerancia (0.0005 es aprox 50m, usa algo más pequeño como 0.0001 para ~10m)
      const lonMatch = Math.abs(maneuverLocation[0] - TARGET_ROUNDABOUT_MANEUVER_LON) < 0.0001;
      const latMatch = Math.abs(maneuverLocation[1] - TARGET_ROUNDABOUT_MANEUVER_LAT) < 0.0001;
      const IS_TARGET_ROUNDABOUT = lonMatch && latMatch;

      if (IS_TARGET_ROUNDABOUT) {
        console.log(`TRAFFIC_RULES: Aplicando OVERRIDE MANUAL para centro y radio de rotonda rb-${i} (maneuverPoint: [${maneuverLocation[0].toFixed(5)},${maneuverLocation[1].toFixed(5)}])`);
        actualCenter = [MANUAL_CENTER_LON, MANUAL_CENTER_LAT];
        estimatedRadius = MANUAL_RADIUS_METERS;
      } else {
        // Lógica automática para OTRAS rotondas (si quieres mantenerla)
        if (roundaboutPathCoords && roundaboutPathCoords.length >= 3) {
          const p1 = roundaboutPathCoords[0];
          const pMid = roundaboutPathCoords[Math.floor((roundaboutPathCoords.length - 1) / 2)];
          const pLast = roundaboutPathCoords[roundaboutPathCoords.length - 1];
          
          let calculatedCenterFromArc: [number, number] | null = null;
          if (turfDistance(turfPointFeature(p1), turfPointFeature(pMid)) < 0.1 || 
              turfDistance(turfPointFeature(pMid), turfPointFeature(pLast)) < 0.1 ||
              turfDistance(turfPointFeature(p1), turfPointFeature(pLast)) < 0.1) {
                // Puntos muy juntos o colineales, usar bbox center
          } else {
            calculatedCenterFromArc = getCircumcenter(p1, pMid, pLast);
          }

          if (calculatedCenterFromArc) {
            actualCenter = calculatedCenterFromArc;
          } else { // Fallback a Bbox center si circuncentro falla o puntos muy juntos
            console.warn(`TRAFFIC_RULES: Rotonda rb-${i} (NO TARGET) - Usando fallback a Bbox center.`);
            const pathFeatureForBbox = turfLineString(roundaboutPathCoords);
            const pathBbox = turfBbox(pathFeatureForBbox);
            const centerOfBboxFeature = turfBboxCenter(bboxPolygon(pathBbox));
            actualCenter = centerOfBboxFeature.geometry.coordinates as [number, number];
          }
          
          let totalDistanceToCenter = 0;
          roundaboutPathCoords.forEach(coord => {
            totalDistanceToCenter += turfDistance(turfPointFeature(actualCenter), turfPointFeature(coord), { units: "meters" });
          });
          estimatedRadius = roundaboutPathCoords.length > 0 ? totalDistanceToCenter / roundaboutPathCoords.length : 30;
          console.log(`TRAFFIC_RULES: Rotonda rb-${i} (NO TARGET) - Centro Automático: [${actualCenter.map(c=>c.toFixed(5)).join(',')}] Radio Auto: ${estimatedRadius.toFixed(1)}m`);
        } else {
          console.warn(`TRAFFIC_RULES: Rotonda rb-${i} (NO TARGET) en [${maneuverLocation.join(',')}] no tiene geometría detallada. Usando punto de maniobra como centro.`);
          actualCenter = maneuverLocation; // Fallback si no hay suficientes puntos
        }
      }

      rules.push({
        id: `rb-${i}`,
        type: "roundabout",
        location: actualCenter, // Será el manual o el automático
        maneuverPoint: maneuverLocation,
        geometry: roundaboutPathCoords,
        radius: estimatedRadius, // Será el manual o el automático
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