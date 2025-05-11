import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import stopSign from "../assets/stop-sign.png";
import yieldSign from "../assets/yield-sign.png";
import roundaboutSign from "../assets/roundabout-sign.png";
import { addRoadClickableLayer } from "../utils/mapLayers"; // <-- importa esta función

const loadImageBitmap = (src: string): Promise<ImageBitmap> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      createImageBitmap(img).then(resolve).catch(reject);
    };
    img.onerror = reject;
  });
};

export const useMapInitialization = (
  setMapInstance: (map: mapboxgl.Map) => void,
  mapRef: React.RefObject<mapboxgl.Map>
) => {
  const onMapReady = useCallback(async (map: mapboxgl.Map) => {
    mapRef.current = map;
    setMapInstance(map);

    const loadAndAddImage = async (name: string, src: string) => {
      const img = await loadImageBitmap(src);
      if (!map.hasImage(name)) {
        map.addImage(name, img);
      }
    };

    await loadAndAddImage("stop-sign", stopSign);
    await loadAndAddImage("yield-sign", yieldSign);
    await loadAndAddImage("roundabout-sign", roundaboutSign);

    // ✅ Asegúrate de añadir la capa justo aquí:
    if (map.isStyleLoaded()) {
      addRoadClickableLayer(map);
    } else {
      map.on("load", () => addRoadClickableLayer(map));
    }

  }, [setMapInstance, mapRef]);

  return { onMapReady };
};
