import { useEffect } from "react";
import * as mapboxgl from "mapbox-gl";

export const useRoadClickBinding = (
  mapInstance: mapboxgl.Map | null,
  handleRoadClick: (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => void,
  deps: any[] = []
) => {
  useEffect(() => {
    if (!mapInstance?.getLayer("roads-clickable-layer")) return;

    mapInstance.off("click", "roads-clickable-layer", handleRoadClick);
    mapInstance.on("click", "roads-clickable-layer", handleRoadClick);

    return () => {
      mapInstance?.off("click", "roads-clickable-layer", handleRoadClick);
    };
  }, [mapInstance, handleRoadClick, ...deps]);
};
