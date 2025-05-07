import mapboxgl from "mapbox-gl";

/**
 * Calcula los límites (bounding box) de un conjunto de coordenadas.
 */
export const getBoundingBox = (
  coords: [number, number][]
): mapboxgl.LngLatBounds => {
  const [first, ...rest] = coords;
  return rest.reduce(
    (bounds, coord) => bounds.extend(coord),
    new mapboxgl.LngLatBounds(first, first)
  );
};

/**
 * Devuelve el bearing (ángulo) entre dos coordenadas.
 */
export const getBearing = (
  from: [number, number],
  to: [number, number]
): number => {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  return Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
};

export function drawMainCarRoute(map: mapboxgl.Map, route: [number, number][]) {
  if (map.getLayer("main-car-route")) map.removeLayer("main-car-route");
  if (map.getSource("main-car-route")) map.removeSource("main-car-route");

  map.addSource("main-car-route", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: route,
      },
      properties: {}, // ✅ requerido por TypeScript
    },
  });

  map.addLayer({
    id: "main-car-route",
    type: "line",
    source: "main-car-route",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#2563eb",
      "line-width": 4,
      "line-opacity": 0.8,
    },
  });
}
