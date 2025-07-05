// src/hooks/useSimulationLoop.ts
import { useEffect, useRef } from "react";
import { CarAgent } from "../logic/agents/CarAgents";
import { TrafficElement } from "../utils/types";
// import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { lineString } from "@turf/turf";
import type { Feature, LineString, Position } from "geojson";

type Props = {
  agentsRef: React.MutableRefObject<CarAgent[]>;
  trafficRules: TrafficElement[];
  map: mapboxgl.Map | null;
  isPlayingRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
};

export function useSimulationLoop({
  agentsRef,
  trafficRules,
  map,
  isPlayingRef,
  speedRef,
}: Props) {
  const lastFrameRef = useRef(performance.now());
  const accumulator = useRef(0);
  const simTimeRef = useRef(0);
  const FIXED_DT = 0.016;

  const rulesRef = useRef<TrafficElement[]>(trafficRules);
  useEffect(() => {
    rulesRef.current = trafficRules;
  }, [trafficRules]);

  const LANE_WIDTH_M = 3.5;
  const innerLaneLineRef = useRef<Feature<LineString> | null>(null);
  const outerLaneLineRef = useRef<Feature<LineString> | null>(null);
  const roundaboutCenterRef = useRef<Position | null>(null);
  const mapHasLoadedOnce = useRef(false);

  // NUEVA REFERENCIA PARA EL LOG DE ESTADO DE ROTONDA
  const lastRoundaboutLogTime = useRef(0);
  const LOG_INTERVAL_SECONDS = 1; // Log cada segundo simulado

  useEffect(() => {
    if (!map) {
      return;
    }

    const initRoundaboutLanesInternal = () => {
      console.log("DEBUG INIT: Entrando en initRoundaboutLanesInternal. rulesRef.current:", JSON.parse(JSON.stringify(rulesRef.current.slice(0, 5))));
      const roundaboutRule = rulesRef.current.find(r => r.type === "roundabout");

      if (!roundaboutRule) {
        console.warn("DEBUG INIT: No se encontró roundaboutRule para crear carriles.");
        innerLaneLineRef.current = null;
        outerLaneLineRef.current = null;
        roundaboutCenterRef.current = null; // También limpiar el centro si no hay regla
        if (map && map.isStyleLoaded()) {
          if (map.getLayer('inner-lane-layer')) map.removeLayer('inner-lane-layer');
          if (map.getSource('inner-lane')) map.removeSource('inner-lane');
          if (map.getLayer('outer-lane-layer')) map.removeLayer('outer-lane-layer');
          if (map.getSource('outer-lane')) map.removeSource('outer-lane');
        }
        return;
      }

      console.log("DEBUG INIT: roundaboutRule ENCONTRADA:", JSON.parse(JSON.stringify(roundaboutRule)));

      const centerForLaneGeneration = roundaboutRule.location; // Este es ahora el centroide/circuncentro calculado
      const radiusForLaneGeneration = roundaboutRule.radius;   // Este es el radio estimado

      roundaboutCenterRef.current = centerForLaneGeneration; // El centro para la lógica de zonas (Lz,Cz,Rz) y distY

      console.log(`DEBUG INIT: Usando para turf.circle: center=[${centerForLaneGeneration.map(c => c.toFixed(5)).join(',')}, radius=${radiusForLaneGeneration.toFixed(1)}`);

      if (!centerForLaneGeneration || typeof radiusForLaneGeneration !== 'number' || radiusForLaneGeneration <= 0) {
        console.error("DEBUG INIT: Centro o radio para turf.circle no válidos.", centerForLaneGeneration, radiusForLaneGeneration);
        innerLaneLineRef.current = null;
        outerLaneLineRef.current = null;
        return;
      }

      // Siempre generamos carriles circulares basados en el centro y radio calculados.
      // Esto proporciona una base consistente para que los coches circulen.
      const circlePolygon = turf.circle(centerForLaneGeneration, radiusForLaneGeneration, { units: 'meters', steps: 80 });
      const baseLineFeature = turf.polygonToLine(circlePolygon) as Feature<LineString>;

      if (!baseLineFeature) {
        console.error("DEBUG INIT: No se pudo crear baseLineFeature (círculo) para los carriles de la rotonda:", roundaboutRule.id);
        innerLaneLineRef.current = null;
        outerLaneLineRef.current = null;
        return;
      }

      const innerOffset = -LANE_WIDTH_M / 2 / 1000; // km
      const outerOffset = LANE_WIDTH_M / 2 / 1000; // km

      let innerLane, outerLane;
      try {
        innerLane = turf.lineOffset(baseLineFeature, innerOffset, { units: 'kilometers' });
        outerLane = turf.lineOffset(baseLineFeature, outerOffset, { units: 'kilometers' });
      } catch (error) {
        console.error("DEBUG INIT: Error durante turf.lineOffset:", error);
        innerLaneLineRef.current = null;
        outerLaneLineRef.current = null;
        return;
      }

      innerLaneLineRef.current = innerLane;
      outerLaneLineRef.current = outerLane;

      console.log("DEBUG INIT: Geometrías de carril asignadas. innerLane:", !!innerLaneLineRef.current, "outerLane:", !!outerLaneLineRef.current);
      // ... (resto de la lógica de dibujar los carriles de depuración, sin cambios) ...
      if (map.isStyleLoaded()) {
        console.log("DEBUG INIT DRAW: map.isStyleLoaded() es TRUE. Intentando dibujar/actualizar carriles de depuración.");
        try {
          if (map.getLayer('inner-lane-layer')) map.removeLayer('inner-lane-layer');
          if (map.getSource('inner-lane')) map.removeSource('inner-lane');
          if (map.getLayer('outer-lane-layer')) map.removeLayer('outer-lane-layer');
          if (map.getSource('outer-lane')) map.removeSource('outer-lane');

          map.addSource('inner-lane', { type: 'geojson', data: innerLane });
          map.addLayer({ id: 'inner-lane-layer', type: 'line', source: 'inner-lane', paint: { 'line-color': '#ff00ff', 'line-width': 2 } });
          map.addSource('outer-lane', { type: 'geojson', data: outerLane });
          map.addLayer({ id: 'outer-lane-layer', type: 'line', source: 'outer-lane', paint: { 'line-color': '#00ffff', 'line-width': 2 } });
          console.log("DEBUG INIT DRAW: Carriles de depuración dibujados/actualizados.");
        } catch (e) {
          console.error("DEBUG INIT DRAW: Error añadiendo fuentes/capas para carriles de depuración:", e);
        }
      } else {
        console.log("DEBUG INIT DRAW: map.isStyleLoaded() es FALSE. No se dibujan carriles de depuración todavía.");
      }
    };

    if (mapHasLoadedOnce.current) {
      console.log("DEBUG EFFECT 1: mapHasLoadedOnce es true. Llamando a initRoundaboutLanesInternal directamente.");
      initRoundaboutLanesInternal();
    } else {
      console.log("DEBUG EFFECT 1: mapHasLoadedOnce es false. Verificando map.isStyleLoaded().");
      if (map.isStyleLoaded()) {
        console.log("DEBUG EFFECT 1: map.isStyleLoaded() es TRUE. Llamando a initRoundaboutLanesInternal y marcando mapHasLoadedOnce.");
        initRoundaboutLanesInternal();
        mapHasLoadedOnce.current = true;
      } else {
        console.log("DEBUG EFFECT 1: map.isStyleLoaded() es FALSE. Añadiendo listener a map.once('load').");
        map.once("load", () => {
          console.log("DEBUG EFFECT 1: map.once('load') disparado. Llamando a initRoundaboutLanesInternal y marcando mapHasLoadedOnce.");
          mapHasLoadedOnce.current = true;
          initRoundaboutLanesInternal();
        });
      }
    }
  }, [map, trafficRules]);

  useEffect(() => {
    if (!map) return;

    const step = (now: number) => {
      const frameDt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      accumulator.current += frameDt * speedRef.current;

      const center = roundaboutCenterRef.current;
      const roundFlags = { Lz: 0, Cz: 0, Rz: 0, LL: 0, RL: 0 };

      if (center) {
        for (const car of agentsRef.current) {
          if (car.isInsideRoundabout) {
            if (car.assignedLane === 'inner') roundFlags.LL = 1;
            if (car.assignedLane === 'outer') roundFlags.RL = 1;
          }
        }

        for (const car of agentsRef.current) {
          if (!car.isInsideRoundabout) continue;
          const ang = (turf.bearing(center, car.position) + 360) % 360;
          if (!roundFlags.Lz && (ang > 240 && ang <= 330)) roundFlags.Lz = 1;
          if (!roundFlags.Cz && (ang > 330 || ang <= 30)) roundFlags.Cz = 1;
          if (!roundFlags.Rz && (ang > 30 && ang <= 120)) roundFlags.Rz = 1;
        }

        // LOG SELECTIVO PARA ROUNDFLAGS
        if (roundFlags.Lz === 1 || roundFlags.Cz === 1 || roundFlags.Rz === 1) {
          console.log(`LOG_SIM_LOOP: Flags de rotonda ACTIVOS: Lz=${roundFlags.Lz}, Cz=${roundFlags.Cz}, Rz=${roundFlags.Rz}, LL=${roundFlags.LL}, RL=${roundFlags.RL}`);
        }
      }

      while (accumulator.current >= FIXED_DT) {
        for (const agent of agentsRef.current) {
          const others = agentsRef.current.filter(a => a.id !== agent.id);

          if (agent.stopped) {
            agent.stopTimer -= FIXED_DT;
            if (agent.id === "main-car") { // Solo loguear para el coche principal
              console.log(`LOG_SIM_LOOP (${agent.id}): STOPPED - Timer: ${agent.stopTimer.toFixed(2)}s`);
            }
            if (agent.stopTimer <= 0) {
              agent.stopped = false;
              agent.targetSpeed = agent.currentStepSpeed;
            }
          }

          agent.features = {
            ...agent.features,
            ...roundFlags,
          };

          const roundaboutRule = rulesRef.current.find(r => r.type === "roundabout");


          if (roundaboutRule && roundaboutRule.maneuverPoint && innerLaneLineRef.current && outerLaneLineRef.current) {
            const distToManeuverPoint = turf.distance(agent.position, roundaboutRule.maneuverPoint, { units: 'meters' });

            // Activamos la lógica de la rotonda cuando el coche se acerca al PUNTO DE ENTRADA real.
            const MANEUVER_TRIGGER_RADIUS = 18; // Un radio de activación razonable en metros.

            if (!agent.hasConstantSpeed && distToManeuverPoint < MANEUVER_TRIGGER_RADIUS && !agent.assignedLane && !agent.hasLaneBeenAssigned) {
              console.log(`LOG_SIM_LOOP (${agent.id}): *** Intenta LLAMAR a assignRoundaboutLane (dist a punto de maniobra: ${distToManeuverPoint.toFixed(1)}m) ***`);
              agent.assignRoundaboutLane(
                innerLaneLineRef.current.geometry.coordinates as [number, number][],
                outerLaneLineRef.current.geometry.coordinates as [number, number][],
                roundaboutRule
              );
            }
          }

          agent.reactToTrafficRules(rulesRef.current, others);
          agent.reactToOtherCars(others, trafficRules);

          if (isPlayingRef.current) {
            agent.updatePosition(FIXED_DT);
            agent.maybeLog(agent, simTimeRef.current);
          }
        }

        if (isPlayingRef.current) simTimeRef.current += FIXED_DT;
        accumulator.current -= FIXED_DT;

        // MODIFICACIÓN: LOG DE ESTADO DE ROTONDA CADA SEGUNDO SIMULADO
        if (isPlayingRef.current && simTimeRef.current - lastRoundaboutLogTime.current >= LOG_INTERVAL_SECONDS) {
          const carsInRoundaboutStatus = agentsRef.current.map(agent =>
            `${agent.id}: ${agent.isInsideRoundabout ? 'DENTRO' : 'FUERA'} (speed: ${agent.speed.toFixed(1)} m/s, targetSpeed: ${agent.targetSpeed.toFixed(1)} m/s)`
          );
          console.log(`SIM_TIME: ${simTimeRef.current.toFixed(0)}s | Estado rotonda: [${carsInRoundaboutStatus.join('; ')}]`);
          lastRoundaboutLogTime.current = simTimeRef.current;
        }

      }

      agentsRef.current.forEach((a) => a.draw(map));
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [map, trafficRules, isPlayingRef, speedRef]);
}