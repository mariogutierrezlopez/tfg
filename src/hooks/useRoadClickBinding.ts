import { useEffect } from "react";
import * as mapboxgl from "mapbox-gl";

export const useRoadClickBinding = (
  mapInstance: mapboxgl.Map | null,
  handleRoadClick: (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => void,
  deps: any[] = []
) => {
  useEffect(() => {
    if (!mapInstance) return;

    const layers = ["roads-clickable-layer", "route-clickable-layer"]; // ambas capas
    layers.forEach(layer => {
      if (mapInstance.getLayer(layer)) {
        mapInstance.off("click", layer, handleRoadClick);
        mapInstance.on("click", layer, handleRoadClick);
      }
    });

    return () => {
      layers.forEach(layer => {
        if (mapInstance.getLayer(layer)) {
          mapInstance.off("click", layer, handleRoadClick);
        }
      });
    };
  }, [mapInstance, handleRoadClick, ...deps]);
};
