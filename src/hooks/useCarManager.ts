import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import { createCarIcon, addCarMarker } from "../utils/carUtils";
import { fetchRouteFrom } from "../utils/routeUtils";
import { TrafficElement } from "../utils/types";
import { mergeTrafficRules } from "../utils/mergeTrafficRules";
import { attachMeterScaling } from "../utils/attachMeterScaling";
import { vehicleSizes } from "../utils/types";

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
)=> {
  const startCarAnimation = useCallback((coords?: [number, number][]) => {
    const points = coords ?? routeData?.coordinates;
    if (!points || !mapInstance) return;
  
    /* ─── dimensiones reales ─── */
    const sizeCfg = vehicleSizes[selectedCarType.id as keyof typeof vehicleSizes] ?? { w: 36, h: 60 };
    const wM = (sizeCfg as any).wM ?? sizeCfg.w / 20;   // 5 cm/px estimado
    const lM = (sizeCfg as any).lM ?? sizeCfg.h / 20;
  
    /* ─── marker ─── */
    const marker = new mapboxgl.Marker({
      element: createCarIcon(
        selectedCarType.image,
        selectedCarType.id,
        "main-car",
        () => setSelectedCarId("main-car")
      ),
      rotationAlignment: "map",
      pitchAlignment:    "map",
      anchor: "center",
    })
      .setLngLat(points[0])
      .addTo(mapInstance);
  
    /* escalado físico */
    const detach = attachMeterScaling(mapInstance, marker, wM, lM);
  
    /* ─── agente ─── */
    const mainCar = new CarAgent(
      "main-car",
      points[0],
      points,
      marker,
      selectedCarType,
      routeData?.stepSpeeds ?? []
    );
    (mainCar as any).detachZoom = detach;   // para cleanup
  
    agentsRef.current = agentsRef.current.filter(a => a.id !== "main-car");
    agentsRef.current.push(mainCar);
  
    setShowCarSelector(true);
    setShowSimulationControls(true);
    setSelectionSent(true);
  }, [
    mapInstance,
    selectedCarType,
    routeData,
    setSelectedCarId,
    setShowCarSelector,
    setShowSimulationControls,
    setSelectionSent,
    agentsRef,
  ]);

  const handleRoadClick = useCallback(async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
    const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    const clickedAgent = agentsRef.current.find(agent => {
      const el = agent.marker.getElement();
      const bbox = el.getBoundingClientRect();
      return e.originalEvent.clientX >= bbox.left && e.originalEvent.clientX <= bbox.right &&
        e.originalEvent.clientY >= bbox.top && e.originalEvent.clientY <= bbox.bottom;
    });

    if (clickedAgent) {
      setSelectedCarId(clickedAgent.id);
      return;
    }

    if (carPendingRouteChange) {
      const car = agentsRef.current.find(a => a.id === carPendingRouteChange);
      if (!car) return;

      const result = await fetchRouteFrom(car.position, coord, token);
      if (!result) return;

      const { routeData, trafficRules } = result;

      //Sustituir ruta y eliminar indices
      car.route = routeData.coordinates;
      car.position = routeData.coordinates[0];
      car.marker.setLngLat(car.position);
      car.prevPosition = [...car.position];
      car.stepSpeeds = routeData.stepSpeeds;
      car.currentStepSpeed = car.stepSpeeds[0] ?? car.maxSpeed;
      setTrafficRules(prev => mergeTrafficRules(prev, trafficRules));

      setCarPendingRouteChange(null);

      if (destinationPinRef.current) destinationPinRef.current.remove();

      const el = document.createElement("div");
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.backgroundColor = "red";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 6px rgba(0,0,0,0.5)";

      const pin = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(coord)
        .addTo(mapRef.current!);

      destinationPinRef.current = pin;
      return;
    }

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
    
  }, [
    agentsRef,
    carPendingRouteChange,
    destinationCoords,
    destinationPinRef,
    mapInstance,
    mapRef,
    selectedCarType,
    setCarPendingRouteChange,
    setSelectedCarId,
    token
  ]);

  return { startCarAnimation, handleRoadClick };
};
