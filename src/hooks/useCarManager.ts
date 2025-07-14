/* src/hooks/useCarManager.tsx */

import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import {
  spawnCar,
  spawnMainCar,
} from "../utils/carUtils";
import { fetchRouteFrom } from "../utils/routeUtils";
import { TrafficElement } from "../utils/types";
import { mergeTrafficRules } from "../utils/mergeTrafficRules";
import { drawCarRoute } from "../utils/mapUtils";
import { useRules } from "../context/rulesContext";

export const useCarManager = (
  mapInstance: mapboxgl.Map | null,
  mapRef: React.RefObject<mapboxgl.Map>,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  selectedCarType: any,
  destinationCoords: [number, number] | null,
  setSelectedCarId: (id: string) => void,
  setShowCarSelector: (b: boolean) => void,
  setShowSimulationControls: (b: boolean) => void,
  setSelectionSent: (b: boolean) => void,
  setCarPendingRouteChange: (id: string | null) => void,
  carPendingRouteChange: string | null,
  destinationPinRef: React.RefObject<mapboxgl.Marker | null>,
  token: string,
  routeData: any,
  handleRouteCalculation: (
    origin: [number, number],
    destination: [number, number]
  ) => Promise<{ routeData: any; trafficRules: TrafficElement[] } | null>,
  setTrafficRules: React.Dispatch<React.SetStateAction<TrafficElement[]>>
) => {
  const { tree } = useRules();

  const handleRoadClick = useCallback(
    async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (carPendingRouteChange) {
        const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const car = agentsRef.current.find(a => a.id === carPendingRouteChange);
        if (!car) return;

        const res = await fetchRouteFrom(car.position, coord, token);
        if (!res) return;
        const { routeData, trafficRules } = res;

        // Actualizar agente
        car.route = routeData.coordinates.slice(1);
        car.position = routeData.coordinates[0];
        car.marker.setLngLat(car.position);
        car.prevPosition = [...car.position];
        car.stepSpeeds = routeData.stepSpeeds;
        car.currentStepSpeed = car.stepSpeeds[0] ?? car.maxSpeed;
        drawCarRoute(mapRef.current!, car.id, routeData.coordinates);

        setTrafficRules(prev => mergeTrafficRules(prev, trafficRules));
        setCarPendingRouteChange(null);
        destinationPinRef.current?.remove();
        return;
      }

      // Clic sobre un coche existente: seleccionarlo
      const clicked = agentsRef.current.find(a => {
        const r = a.marker.getElement().getBoundingClientRect();
        return e.originalEvent.clientX >= r.left &&
               e.originalEvent.clientX <= r.right &&
               e.originalEvent.clientY >= r.top &&
               e.originalEvent.clientY <= r.bottom;
      });
      if (clicked) {
        setSelectedCarId(clicked.id);
      }

    },
    [
      carPendingRouteChange,
      token,
      setSelectedCarId,
      setCarPendingRouteChange,
      setTrafficRules,
      tree
    ]
  );

  return {
    handleRoadClick,

    spawnMainCar: async () => {
      if (!routeData || !mapInstance) return;
      const origin = routeData.coordinates[0];
      const destination = routeData.coordinates.at(-1)!;
      await spawnMainCar(
        mapInstance,
        agentsRef,
        origin,
        destination,
        selectedCarType,
        setSelectedCarId,
        setShowCarSelector,
        setShowSimulationControls,
        setSelectionSent,
        tree
      );
    },
  };
};
