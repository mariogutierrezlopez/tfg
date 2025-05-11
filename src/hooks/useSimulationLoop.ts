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

export function useSimulationLoop({ agentsRef, trafficRules, map, isPlayingRef, speedRef }: Props) {
  const lastFrameTimeRef = useRef<number>(performance.now());
  const accumulatorRef = useRef<number>(0);
  const FIXED_DT = 0.016; // 16 ms ≈ 60 fps

  useEffect(() => {
    if (!map) return;

    const step = (now: number) => {
      const frameTime = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      accumulatorRef.current += frameTime * speedRef.current;

      while (accumulatorRef.current >= FIXED_DT) {
        for (const agent of agentsRef.current) {
          const others = agentsRef.current.filter(a => a.id !== agent.id);
          agent.reactToTrafficRules(trafficRules, others);
          agent.reactToOtherCars(others, trafficRules);

          if (isPlayingRef.current) {
            agent.updatePosition(FIXED_DT);
          }
        }

        accumulatorRef.current -= FIXED_DT;
      }

      for (const agent of agentsRef.current) {
        agent.draw(map);
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [map, trafficRules, isPlayingRef, speedRef]);
}
