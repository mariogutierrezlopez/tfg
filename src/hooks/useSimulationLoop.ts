import { useEffect, useRef } from "react";
import { CarAgent } from "../logic/agents/CarAgents";
import { TrafficElement } from "../utils/types";
import mapboxgl from "mapbox-gl";

type Props = {
  agentsRef: React.MutableRefObject<CarAgent[]>;
  trafficRules: TrafficElement[];
  map: mapboxgl.Map | null;
  isPlayingRef: React.MutableRefObject<boolean>;
};

export function useSimulationLoop({ agentsRef, trafficRules, map, isPlayingRef }: Props) {
  const lastFrameTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!map) return;

    const step = (now: number) => {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      for (const agent of agentsRef.current) {
        const others = agentsRef.current.filter(a => a.id !== agent.id);

        // Procesar lógica de tráfico siempre
        agent.reactToTrafficRules(trafficRules, others);
        agent.reactToOtherCars(others, trafficRules);

        if (isPlayingRef.current) {
          agent.updatePosition(dt);
        }

        agent.draw(map);
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [map, trafficRules]);
}
