import { useEffect } from "react";
import mapboxgl from "mapbox-gl";

export const useManualPointSelection = (
  mapInstance: mapboxgl.Map | null,
  inputMode: "search" | "manual" | "csv",
  setOriginCoords: (coords: [number, number]) => void,
  setDestinationCoords: (coords: [number, number]) => void,
  onComplete: () => void
) => {
  useEffect(() => {
    if (!mapInstance || inputMode !== "manual") return;

    const clicks: [number, number][] = [];
    const tempMarkers: mapboxgl.Marker[] = [];

    const handleClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (!e.originalEvent.shiftKey) return;

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      clicks.push(lngLat);

      const marker = new mapboxgl.Marker({ color: clicks.length === 1 ? "blue" : "green" })
        .setLngLat(lngLat)
        .addTo(mapInstance);
      tempMarkers.push(marker);

      if (clicks.length === 1) setOriginCoords(lngLat);
      if (clicks.length === 2) {
        setDestinationCoords(lngLat);
        mapInstance.off("click", handleClick);
        onComplete();
      }
    };

    mapInstance.on("click", handleClick);

    return () => {
      mapInstance.off("click", handleClick);
      tempMarkers.forEach((m) => m.remove());
    };
  }, [mapInstance, inputMode, setOriginCoords, setDestinationCoords, onComplete]);
};
