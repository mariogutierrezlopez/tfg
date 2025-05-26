// src/hooks/useSimulationLoop.ts

import { useEffect, useRef } from "react";
import { CarAgent } from "../logic/agents/CarAgents";
import { TrafficElement } from "../utils/types";
import mapboxgl from "mapbox-gl";

// Importamos todo Turf desde '@turf/turf'
import * as turf from "@turf/turf";

// GeoJSON types
import type { Feature, LineString, Polygon, Position } from "geojson";

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
  const FIXED_DT = 0.016; // 60 fps → 16 ms

  const rulesRef = useRef<TrafficElement[]>(trafficRules);
  useEffect(() => {
    rulesRef.current = trafficRules;
  }, [trafficRules]);

  // Ancho de carril en metros
  const LANE_WIDTH_M = 3;

  // Refs para polígonos y centroide
  const innerPolyRef = useRef<Feature<Polygon> | null>(null);
  const outerRingRef = useRef<Feature<Polygon> | null>(null);
  const centerRef = useRef<Position | null>(null);

  // 1️⃣ Inicialización de geometría de la rotonda principal
  useEffect(() => {
    if (!map) return;

    const initRoundabout = () => {
      const allFeats = map.queryRenderedFeatures() as mapboxgl.MapboxGeoJSONFeature[];
      const feats = allFeats.filter(
        f => f.layer.id === "road" && f.properties?.junction === "roundabout"
      );
      if (!feats.length) {
        console.warn("No roundabout found on map!");
        return;
      }

      const roundGeom = feats[0].geometry as LineString;
      const turfLine = turf.lineString(roundGeom.coordinates) as Feature<LineString>;

      const innerKm = LANE_WIDTH_M / 1000;
      const outerKm = (LANE_WIDTH_M * 2) / 1000;
      const bufInner = turf.buffer(turfLine, innerKm, { units: "kilometers" }) as Feature<Polygon>;
      const bufOuter = turf.buffer(turfLine, outerKm, { units: "kilometers" }) as Feature<Polygon>;
      const outerRing = turf.difference(bufOuter, bufInner) as Feature<Polygon>;

      const centFeat = turf.centroid(turfLine);
      const cent = centFeat.geometry.coordinates as Position;

      innerPolyRef.current = bufInner;
      outerRingRef.current = outerRing;
      centerRef.current = cent;
    };

    if (map.isStyleLoaded()) {
      initRoundabout();
    } else {
      map.once("load", initRoundabout);
    }

  }, [map]);
  // 2️⃣ Bucle principal de simulación
  useEffect(() => {
    if (!map) return;

    const step = (now: number) => {
      const frameDt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      accumulator.current += frameDt * speedRef.current;

      // computar flags de tráfico EN LA ROTONDA una vez por frame
      const innerPoly = innerPolyRef.current;
      const outerRing = outerRingRef.current;
      const center = centerRef.current;
      const roundFlags = { Lz: 0, Cz: 0, Rz: 0, LL: 0, RL: 0 };

      if (innerPoly && outerRing && center) {
        for (const car of agentsRef.current) {
          const pt = turf.point(car.position);

          if (!roundFlags.LL && turf.booleanPointInPolygon(pt, innerPoly)) {
            roundFlags.LL = 1;
          }
          if (!roundFlags.RL && turf.booleanPointInPolygon(pt, outerRing)) {
            roundFlags.RL = 1;
          }

          const ang = (turf.bearing(center, car.position) + 360) % 360;
          if (!roundFlags.Lz && (ang > 330 || ang <= 30)) {
            roundFlags.Lz = 1;
          }
          if (!roundFlags.Cz && ang > 30 && ang <= 150) {
            roundFlags.Cz = 1;
          }
          if (!roundFlags.Rz && ang > 150 && ang <= 330) {
            roundFlags.Rz = 1;
          }

          if (
            roundFlags.Lz &&
            roundFlags.Cz &&
            roundFlags.Rz &&
            roundFlags.LL &&
            roundFlags.RL
          ) {
            break;
          }
        }
      }

      // simulación con paso fijo
      while (accumulator.current >= FIXED_DT) {
        for (const agent of agentsRef.current) {
          const others = agentsRef.current.filter(a => a.id !== agent.id);

          // stopTimer
          if (agent.stopped) {
            agent.stopTimer -= FIXED_DT;
            if (agent.stopTimer <= 0) {
              agent.stopped = false;
              agent.targetSpeed = agent.currentStepSpeed;
            }
          }

          // inyectar flags
          agent.features = {
            ...agent.features,
            Lz: roundFlags.Lz,
            Cz: roundFlags.Cz,
            Rz: roundFlags.Rz,
            LL: roundFlags.LL,
            RL: roundFlags.RL,
          };

          // reacción a reglas y a otros coches
          agent.reactToTrafficRules(rulesRef.current, others);
          agent.reactToOtherCars(others, trafficRules);

          if (isPlayingRef.current) {
            agent.updatePosition(FIXED_DT);
            agent.maybeLog(agent, simTimeRef.current);
          }
        }

        if (isPlayingRef.current) simTimeRef.current += FIXED_DT;
        accumulator.current -= FIXED_DT;
      }

      // dibujar
      agentsRef.current.forEach((a) => a.draw(map));
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [map, trafficRules, isPlayingRef, speedRef]);
}
