/* src/hooks/useCarManager.tsx ----------------------------------------- */
import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import {
  spawnCar,          // ← genérico
  spawnMainCar,      // ← alias que creaste en carUtils
} from "../utils/carUtils";
// import { fetchRouteFrom } from "../utils/routeUtils";
import { TrafficElement } from "../utils/types";
// import { mergeTrafficRules } from "../utils/mergeTrafficRules";

export const useCarManager = (
  mapInstance: mapboxgl.Map | null,
  // mapRef: React.RefObject<mapboxgl.Map>,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  selectedCarType: any,
  destinationCoords: [number, number] | null,
  setSelectedCarId: (id: string) => void,
  setShowCarSelector: (b: boolean) => void,
  setShowSimulationControls: (b: boolean) => void,
  setSelectionSent: (b: boolean) => void,
  // setCarPendingRouteChange: (id: string | null) => void,
  carPendingRouteChange: string | null,
  // destinationPinRef: React.RefObject<mapboxgl.Marker | null>,
  token: string,
  routeData: any,
  handleRouteCalculation: (
    origin: [number, number],
    destination: [number, number]
  ) => Promise<{ routeData: any; trafficRules: TrafficElement[] } | null>,
  setTrafficRules: React.Dispatch<React.SetStateAction<TrafficElement[]>>
) => {
  /* ───────────────────────────────────────────────────────────── */
  /* Road-click handler                                           */
  /* ───────────────────────────────────────────────────────────── */
  const handleRoadClick = useCallback(
    async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (!mapInstance) return;

      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      /* —— clic sobre un coche existente ——— */
      const clicked = agentsRef.current.find(a => {
        const box = a.marker.getElement().getBoundingClientRect();
        return (
          e.originalEvent.clientX >= box.left &&
          e.originalEvent.clientX <= box.right &&
          e.originalEvent.clientY >= box.top &&
          e.originalEvent.clientY <= box.bottom
        );
      });
      if (clicked) { setSelectedCarId(clicked.id); return; }

      /* —— cambio de destino de un coche pendiente ——— */
      if (carPendingRouteChange) { /* …igual que antes… */ }

      /* —— añadir un NUEVO coche ——— */
      const newId        = crypto.randomUUID();
      const fallbackDest : [number,number] = [coord[0]+0.01, coord[1]+0.01];

      await spawnCar(
        mapInstance,
        agentsRef,
        coord,
        destinationCoords ?? fallbackDest,
        selectedCarType,
        newId,
        () => setSelectedCarId(newId)
      );
    },
    [
      agentsRef,
      carPendingRouteChange,
      destinationCoords,
      mapInstance,
      selectedCarType,
      setSelectedCarId,
      token,
      handleRouteCalculation,
      setTrafficRules,
    ]
  );

  /* ───────────────────────────────────────────────────────────── */
  /* API pública del hook                                         */
  /* ───────────────────────────────────────────────────────────── */
  return {
    handleRoadClick,

    spawnMainCar: async () => {
      if (!routeData || !mapInstance) return;

      const origin      = routeData.coordinates[0];
      const destination = routeData.coordinates[routeData.coordinates.length-1];

      await spawnMainCar(
        mapInstance,
        agentsRef,
        origin,
        destination,
        selectedCarType,
        setSelectedCarId,
        setShowCarSelector,
        setShowSimulationControls,
        setSelectionSent
      );
    },
  };
};
