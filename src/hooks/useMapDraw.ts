import { useEffect, useRef } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

const useMapDraw = (map: mapboxgl.Map | null) => {
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    if (map && !drawRef.current) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          trash: true,
        },
      });

      drawRef.current = draw;
      map.addControl(draw, "top-left");
    }
  }, [map]);

  return drawRef;
};

export default useMapDraw;
