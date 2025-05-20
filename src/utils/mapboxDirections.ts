import type { LngLatLike } from "mapbox-gl";

export interface RouteWithSpeeds {
  geometry: [number, number][],
  stepSpeeds: number[],
}

const TOKEN = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN!;

async function requestRoute(profile: string, coordStr: string) {
  const url =
    `https://api.mapbox.com/directions/v5/${profile}/${coordStr}` +
    `?overview=full&geometries=geojson` +
    `&annotations=maxspeed,speed` +                // ← más simple
    `&steps=false&access_token=${TOKEN}`;

  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchRouteWithSpeeds(
  coords: LngLatLike[],
): Promise<RouteWithSpeeds> {

  const coordStr = coords
    .map(c => Array.isArray(c) ? c.join(",") : `${c.lng},${c.lat}`)
    .join(";");

  /* 1️⃣  Intento con tráfico --------------------------------- */
  let data, route;
  try {
    data = await requestRoute("mapbox/driving-traffic", coordStr);
    route = data.routes?.[0];
  } catch { /* ignoramos – pasamos al plan B */ }

  /* 2️⃣  Fallback a profile "driving" si hace falta ----------- */
  if (!route) {
    data  = await requestRoute("mapbox/driving", coordStr);
    route = data.routes?.[0];
    if (!route) throw new Error("No se encontró ruta");
  }

  const geometry = route.geometry.coordinates as [number, number][];

  const anns   = route.legs.flatMap((l:any)=> l.annotation );
  const max    = anns.flatMap((a:any)=> a.maxspeed ?? []);
  const speed  = anns.flatMap((a:any)=> a.speed    ?? []);

  const stepSpeeds = max.map((m:any,i:number) => {
    if (m && !m.unknown && m.speed != null) {
      const v = Number(m.speed);
      return m.unit === "mph" ? v*0.44704 : v/3.6;
    }
    if (typeof speed[i] === "number") return Math.min(speed[i]*1.1, 35);
    return 30/3.6;                 // último recurso
  });

  return { geometry, stepSpeeds };
}
