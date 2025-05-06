import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import { createCarIcon, addCarMarker } from "../utils/carUtils";
import { fetchRouteFrom } from "../utils/routeUtils";

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
) => {
  const startCarAnimation = useCallback((coords?: [number, number][]) => {
    const points = coords ?? routeData?.coordinates;
    if (!points || !mapInstance) return;

    const marker = new mapboxgl.Marker({
      element: createCarIcon(selectedCarType.image, selectedCarType.id, "main-car", () => {
        setSelectedCarId("main-car");
      }),
      rotationAlignment: "map",
      pitchAlignment: "map",
      anchor: "center",
    }).setLngLat(points[0]).addTo(mapInstance);

    const mainCar = new CarAgent("main-car", points[0], points, marker, selectedCarType);

    agentsRef.current = agentsRef.current.filter(a => a.id !== "main-car");
    agentsRef.current.push(mainCar);

    setShowCarSelector(true);
    setShowSimulationControls(true);
    setSelectionSent(true);

    // Volver a añadir la capa gris
    try {
      if (mapInstance.getLayer("roads-clickable-layer")) {
        mapInstance.removeLayer("roads-clickable-layer");
      }

      mapInstance.addLayer({
        id: "roads-clickable-layer",
        type: "line",
        source: "composite",
        "source-layer": "road",
        layout: {},
        paint: {
          "line-color": "#888",
          "line-width": 4,
          "line-opacity": 0.2,
        },
      }, "road-label");
    } catch (e) {
      console.error("No se pudo añadir capa de carreteras:", e);
    }
  }, [mapInstance, selectedCarType]);

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

      const newRoute = await fetchRouteFrom(car.position, coord, token);
      if (!newRoute) return;

      car.route = newRoute;
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

    await addCarMarker(coord, mapInstance!, selectedCarType, destinationCoords, agentsRef, setSelectedCarId, token);
  }, [mapInstance, selectedCarType, destinationCoords, carPendingRouteChange]);

  return { startCarAnimation, handleRoadClick };
};
