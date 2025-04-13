import { useEffect } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

export const useDrawModeHandler = (
  mapInstance: mapboxgl.Map | null,
  drawRef: React.RefObject<MapboxDraw>,
  mode: "full" | "area" | null,
  areaType: "square" | "polygon" | null
) => {
  useEffect(() => {
    if (!mapInstance || !drawRef.current) return;

    drawRef.current.deleteAll();
    mapInstance.getCanvas().style.cursor = "";

    if (mode === "area" && areaType === "polygon") {
      drawRef.current.changeMode("draw_polygon");
      mapInstance.getCanvas().style.cursor = "crosshair";
    }

    if (mode === "area" && areaType === "square") {
      let start: mapboxgl.LngLat | null = null;

      const onMouseDown = (e: mapboxgl.MapMouseEvent) => {
        start = e.lngLat;
        mapInstance.getCanvas().style.cursor = "crosshair";

        mapInstance.once("mouseup", (ev) => {
          const end = ev.lngLat;
          if (!start) return;

          const rectangle = [
            [start.lng, start.lat],
            [end.lng, start.lat],
            [end.lng, end.lat],
            [start.lng, end.lat],
            [start.lng, start.lat],
          ];

          drawRef.current?.add({
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [rectangle],
            },
          });

          mapInstance.getCanvas().style.cursor = "";
          start = null;
        });
      };

      mapInstance.once("mousedown", onMouseDown);
    }
  }, [mapInstance, drawRef, mode, areaType]);
};
