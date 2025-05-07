import { useEffect } from "react";
import * as mapboxgl from "mapbox-gl";

export const useRoadClickBinding = (
  mapInstance: mapboxgl.Map | null,
  handleRoadClick: (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => void,
  deps: any[] = []
) => {
  useEffect(() => {
    if (!mapInstance) return;

    const onLoad = () => {
      if (!mapInstance.getLayer("roads-clickable-layer")) {
        try {
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
          console.warn("⚠️ No se pudo añadir roads-clickable-layer:", e);
        }
      }

      mapInstance.off("click", "roads-clickable-layer", handleRoadClick);
      mapInstance.on("click", "roads-clickable-layer", handleRoadClick);
    };

    if (mapInstance.isStyleLoaded()) {
      onLoad();
    } else {
      mapInstance.once("load", onLoad);
    }

    return () => {
      mapInstance?.off("click", "roads-clickable-layer", handleRoadClick);
    };
  }, [mapInstance, handleRoadClick, ...deps]);
};
