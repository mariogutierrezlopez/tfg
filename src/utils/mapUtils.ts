// src/utils/mapUtils.ts
import * as mapboxgl from "mapbox-gl";

export function drawCarRoute(
  map: mapboxgl.Map,
  carId: string,
  coords: [number, number][],
  colorHEX = "#2563eb"
) {
  const src  = `${carId}-route-src`;
  const line = `${carId}-route`;
  const pin  = `${carId}-dest`;


  if (map.getLayer(line)) map.removeLayer(line);
  if (map.getLayer(pin))  map.removeLayer(pin);
  if (map.getSource(src)) map.removeSource(src);

  map.addSource(src, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords }
        },
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: coords.at(-1)! }
        }
      ]
    }
  });

  /* línea */
  map.addLayer({
    id: line,
    type: "line",
    source: src,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint : { "line-color": colorHEX, "line-width": 4, "line-opacity": 0.8 }
  });

  /* destino */
  map.addLayer({
    id: pin,
    type: "circle",
    source: src,
    filter: ["==", ["geometry-type"], "Point"],
    paint : {
      "circle-radius": 5,
      "circle-color": colorHEX,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff"
    }
  });
}
