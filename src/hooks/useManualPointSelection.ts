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
    const markers: mapboxgl.Marker[] = [];

    const handleClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (!e.originalEvent.shiftKey || clicks.length >= 2) return;

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      clicks.push(lngLat);

      const marker = new mapboxgl.Marker({
        color: clicks.length === 1 ? "blue" : "green"
      }).setLngLat(lngLat).addTo(mapInstance);

      markers.push(marker);

      if (clicks.length === 1) {
        setOriginCoords(lngLat);
        console.log("🟢 Origen asignado:", lngLat);
      }

      if (clicks.length === 2) {
        setDestinationCoords(lngLat);
        console.log("🟢 Destino asignado:", lngLat);

        setTimeout(() => {
          onComplete();
        }, 0);

        mapInstance.off("click", handleClick);
      }
    };

    mapInstance.on("click", handleClick);

    return () => {
      mapInstance.off("click", handleClick);
      markers.forEach((m) => m.remove());
      console.log("🔴 Marcadores eliminados al salir del modo manual");
    };
  }, [mapInstance, inputMode]);
};
