import { useEffect } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

export const useDrawModeHandler = (
  mapInstance: mapboxgl.Map | null,
  drawRef: React.RefObject<MapboxDraw>,
  mode: "full" | "area" | null
) => {
  useEffect(() => {
    if (!mapInstance || !drawRef.current) return;

    drawRef.current.deleteAll();
    mapInstance.getCanvas().style.cursor = "";

    if (mode === "area") {
      drawRef.current.changeMode("draw_polygon");
      mapInstance.getCanvas().style.cursor = "crosshair";
    }
  }, [mapInstance, drawRef, mode]);
};

