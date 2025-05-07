import { resampleRoute } from "./resampleRoute";

// utils/routeUtils.ts
export const fetchRouteFrom = async (
  origin: [number, number],
  destination: [number, number],
  token: string
): Promise<{ coordinates: [number, number][], stepSpeeds: number[] } | null> => {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&overview=full&steps=true&annotations=maxspeed&access_token=${token}`;
  const response = await fetch(url);
  const data = await response.json();

  const route = data.routes?.[0];
  if (!route || route.geometry.coordinates.length < 2) return null;

  const coordinates = route.geometry.coordinates;
  const steps = route.legs?.[0]?.steps ?? [];

  const stepSpeeds = steps.map((step) => {
    const raw = step.maxspeed?.speed ?? null;
    const roadClass = step.class ?? "unknown";

    let fallback = 30;
    switch (roadClass) {
      case "motorway": fallback = 120; break;
      case "primary": fallback = 100; break;
      case "secondary": fallback = 80; break;
      case "tertiary": fallback = 60; break;
      case "residential": fallback = 50; break;
    }

    const kmh = raw ?? fallback;
    return kmh / 3.6; // Convertir a m/s
  });

  return { coordinates, stepSpeeds };
};

