import { useEffect, useRef } from "react";
import { CarAgent } from "../logic/agents/CarAgents";
import { TrafficElement } from "../utils/types";
import mapboxgl from "mapbox-gl";

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
  const simTimeRef = useRef(0); // ⬅️  nuevo
  const FIXED_DT = 0.016; // 60 fps → 16 ms

  useEffect(() => {
    if (!map) return;

    const step = (now: number) => {
      const frameDt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      accumulator.current += frameDt * speedRef.current;

      while (accumulator.current >= FIXED_DT) {
        for (const agent of agentsRef.current) {
          const others = agentsRef.current.filter((a) => a.id !== agent.id);

          agent.reactToTrafficRules(trafficRules, others);
          agent.reactToOtherCars(others, trafficRules);

          if (isPlayingRef.current) {
            agent.updatePosition(FIXED_DT); // ⬅️ mueve
            agent.maybeLog(agent, simTimeRef.current); // ⬅️ log
          }
        }

        /* avanza reloj de la simulación */
        if (isPlayingRef.current) simTimeRef.current += FIXED_DT;

        accumulator.current -= FIXED_DT;
      }

      /* dibuja interpolado */
      agentsRef.current.forEach((a) => a.draw(map));

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [map, trafficRules, isPlayingRef, speedRef]);
}
