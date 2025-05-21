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
  const simTimeRef = useRef(0);
  const FIXED_DT = 0.016; // 60 fps → 16 ms

  const rulesRef = useRef<TrafficElement[]>(trafficRules);
  useEffect(() => { rulesRef.current = trafficRules; }, [trafficRules]);

  useEffect(() => {
    if (!map) return;

    const step = (now: number) => {
      const frameDt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      accumulator.current += frameDt * speedRef.current;

      while (accumulator.current >= FIXED_DT) {
        for (const agent of agentsRef.current) {
          const others = agentsRef.current.filter((a) => a.id !== agent.id);

          // ── ➊ Gestionar stopTimer antes de procesar reglas ─────────
          if (agent.stopped) {
            agent.stopTimer -= FIXED_DT;
            console.log(
              `[${agent.id}] stopTimer=${agent.stopTimer.toFixed(2)}`
            );
            if (agent.stopTimer <= 0) {
              console.log(`[${agent.id}] 🔔 stopTimer expirado, desbloqueo`);
              agent.stopped = false;
              // restablezco velocidad objetivo al paso actual
              agent.targetSpeed = agent.currentStepSpeed;
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
      }

      agentsRef.current.forEach((a) => a.draw(map));
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [map, trafficRules, isPlayingRef, speedRef]);
}
