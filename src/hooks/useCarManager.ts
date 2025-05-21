/* src/hooks/useCarManager.tsx ----------------------------------------- */
import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import {
  spawnCar,          // ← genérico
  spawnMainCar,      // ← alias que creaste en carUtils
} from "../utils/carUtils";
import { fetchRouteFrom } from "../utils/routeUtils";
import { TrafficElement } from "../utils/types";
import { mergeTrafficRules } from "../utils/mergeTrafficRules";
import { drawCarRoute } from "../utils/mapUtils";

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
  /* ───────────────────────────────────────────── */
  /* Handler de clic en el mapa                   */
  /* ───────────────────────────────────────────── */
  const handleRoadClick = useCallback(
    async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {

      /* ① ¿un coche en modo “cambiar destino”? */
      if (carPendingRouteChange) {
        const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        const car = agentsRef.current.find(a => a.id === carPendingRouteChange);
        if (!car) return;

        const res = await fetchRouteFrom(car.position, coord, token);
        if (!res) return;                                  //  ↩️  si falla no añadimos coche

        const { routeData, trafficRules } = res;

        /* — sustituir ruta y velocidades — */
        car.route = routeData.coordinates.slice(1);   // 👈  sin el primer punto
        car.position = routeData.coordinates[0];
        car.marker.setLngLat(car.position);
        car.prevPosition = [...car.position];
        car.stepSpeeds = routeData.stepSpeeds;
        car.currentStepSpeed = car.stepSpeeds[0] ?? car.maxSpeed;
        // … después de actualizar car.route, car.position, etc.
        drawCarRoute(mapRef.current!, car.id, routeData.coordinates);


        setTrafficRules(prev => mergeTrafficRules(prev, trafficRules));
        setCarPendingRouteChange(null);                   // ✅  ya no está pendiente

        /* elimina pin rojo (si lo tenías) */
        destinationPinRef.current?.remove();

        return;                                           // ⛔  ¡IMPORTANTE!
      }

      /* ② clic sobre un coche existente */
      const tgt = agentsRef.current.find(a => {
        const r = a.marker.getElement().getBoundingClientRect();
        return e.originalEvent.clientX >= r.left && e.originalEvent.clientX <= r.right &&
               e.originalEvent.clientY >= r.top  && e.originalEvent.clientY <= r.bottom;
      });
      if (tgt) { setSelectedCarId(tgt.id); return; }

      /* ③ crear un coche nuevo -------------------------------- */
      if (!mapInstance) return;

      const origin: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      /* si el usuario no marcó un destino previo, usamos un fallback pequeño */
      const dest: [number, number] =
        destinationCoords ?? [origin[0] + 0.01, origin[1] + 0.01];

      const newId = crypto.randomUUID();

      await spawnCar(
        mapInstance,
        agentsRef,
        origin,
        dest,
        selectedCarType,
        newId,
        () => setSelectedCarId(newId)          // callback al hacer click en su icono
      );
    },
    [
      mapInstance,
      agentsRef,
      carPendingRouteChange,
      destinationCoords,
      selectedCarType,
      token,                     // sólo lo usa tu “cambiar ruta”
      setSelectedCarId,
      setCarPendingRouteChange,
      setTrafficRules,
    ]
  );

  /* ───────────────────────────────────────────── */
  /* Exponemos API del hook                       */
  /* ───────────────────────────────────────────── */
  return {
    handleRoadClick,

    spawnMainCar: async () => {
      if (!routeData || !mapInstance) return;

      const origin      = routeData.coordinates[0];
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
        setSelectionSent
      );
    },
  };
};