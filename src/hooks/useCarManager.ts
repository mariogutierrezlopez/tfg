/* src/hooks/useCarManager.tsx ----------------------------------------- */
import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import {
  addCarMarker,
  startCarAnimation,                   // ① importamos la versión única
} from "../utils/carUtils";
import { fetchRouteFrom } from "../utils/routeUtils";
import { TrafficElement } from "../utils/types";
import { mergeTrafficRules } from "../utils/mergeTrafficRules";

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
  setTrafficRules: React.Dispatch<
    React.SetStateAction<TrafficElement[]>
  >
) => {
  /* ------------------------------------------------------------------ */
  /* road-click handler (igual que antes)                               */
  /* ------------------------------------------------------------------ */
  const handleRoadClick = useCallback(
    async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      /* —— clic sobre un coche existente ———————————————— */
      const clickedAgent = agentsRef.current.find((agent) => {
        const el = agent.marker.getElement();
        const box = el.getBoundingClientRect();
        return (
          e.originalEvent.clientX >= box.left &&
          e.originalEvent.clientX <= box.right &&
          e.originalEvent.clientY >= box.top &&
          e.originalEvent.clientY <= box.bottom
        );
      });
      if (clickedAgent) {
        setSelectedCarId(clickedAgent.id);
        return;
      }

      /* —— cambio de destino de un coche pendiente ————————— */
      if (carPendingRouteChange) {
        const car = agentsRef.current.find(
          (a) => a.id === carPendingRouteChange
        );
        if (!car) return;

        const res = await fetchRouteFrom(car.position, coord, token);
        if (!res) return;

        const { routeData, trafficRules } = res;

        /* sustituir ruta y velocidades */
        car.route = routeData.coordinates;
        car.position = routeData.coordinates[0];
        car.marker.setLngLat(car.position);
        car.prevPosition = [...car.position];
        car.stepSpeeds = routeData.stepSpeeds;
        car.currentStepSpeed = car.stepSpeeds[0] ?? car.maxSpeed;

        setTrafficRules((prev) => mergeTrafficRules(prev, trafficRules));
        setCarPendingRouteChange(null);

        if (destinationPinRef.current) destinationPinRef.current.remove();

        /* nuevo pin rojo */
        const el = document.createElement("div");
        el.style.width = el.style.height = "24px";
        el.style.backgroundColor = "red";
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 6px rgba(0,0,0,0.5)";

        destinationPinRef.current = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(coord)
          .addTo(mapRef.current!);
        return;
      }

      /* —— añadir un nuevo coche ———————————————— */
      await addCarMarker(
        coord,
        mapInstance!,
        selectedCarType,
        destinationCoords,
        agentsRef,
        setSelectedCarId,
        token,
        handleRouteCalculation,
        setTrafficRules
      );
    },
    [
      agentsRef,
      carPendingRouteChange,
      destinationCoords,
      destinationPinRef,
      mapInstance,
      mapRef,
      selectedCarType,
      setCarPendingRouteChange,
      setSelectedCarId,
      token,
      handleRouteCalculation,
      setTrafficRules,
    ]
  );

  /* ------------------------------------------------------------------ */
  /* devolvemos las utilidades                                          */
  /* ------------------------------------------------------------------ */
  return {
    startCarAnimation: (coords?: [number, number][]) =>
      startCarAnimation(
        coords ?? routeData?.coordinates,
        selectedCarType,
        routeData,
        mapInstance!,
        agentsRef,
        setSelectedCarId,
        setShowCarSelector,
        setShowSimulationControls,
        setSelectionSent
      ),
    handleRoadClick,
  };
};
