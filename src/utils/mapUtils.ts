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
