// src/utils/mapSetup.ts
import * as mapboxgl from "mapbox-gl";
import { TrafficElement } from "../utils/types";
import stopSign from "../assets/stop-sign.png";
import yieldSign from "../assets/yield-sign.png";
import roundaboutSign from "../assets/roundabout-sign.png";

export const loadImageBitmap = (src: string): Promise<ImageBitmap> => {
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

export const drawRoundaboutEntryZone = (
  map: mapboxgl.Map,
  roundabout: TrafficElement,
  id: string
) => {
  const circleFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: roundabout.location,
    },
    properties: {},
  };

  const radiusMeters = roundabout.radius + 15;

  if (!map.getSource(id)) {
    map.addSource(id, {
      type: "geojson",
      data: circleFeature,
    });

    map.addLayer({
      id: id,
      type: "circle",
      source: id,
      paint: {
        "circle-radius": {
          stops: [
            [0, 0],
            [20, radiusMeters],
          ],
          base: 2,
        },
        "circle-color": "#FF0000",
        "circle-opacity": 0.25,
      },
    });
  } else {
    const source = map.getSource(id) as mapboxgl.GeoJSONSource;
    source.setData(circleFeature);
  }
};

export const handleMapReady = async (
  map: mapboxgl.Map,
  setMapInstance: (map: mapboxgl.Map) => void,
  mapRef: React.MutableRefObject<mapboxgl.Map | null>
) => {
  mapRef.current = map;
  setMapInstance(map);

  const loadAndAddImage = async (name: string, src: string) => {
    const img = await loadImageBitmap(src);
    if (!map.hasImage(name)) {
      map.addImage(name, img);
    }
  };

  // Cargar las imágenes de las señales
  await loadAndAddImage("stop-sign", stopSign);
  await loadAndAddImage("yield-sign", yieldSign);
  await loadAndAddImage("roundabout-sign", roundaboutSign);

  // Fuente y capa de la ruta de coches
};