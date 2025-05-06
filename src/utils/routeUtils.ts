import { resampleRoute } from "./resampleRoute";

export const fetchRouteFrom = async (
  from: [number, number],
  to: [number, number],
  token: string
): Promise<[number, number][] | null> => {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${token}`;
  const response = await fetch(url);
  const data = await response.json();
  const rawCoords = data.routes?.[0]?.geometry?.coordinates;
  if (!rawCoords) return null;
  return resampleRoute(rawCoords, 10);
};
