/* src/utils/mapboxDirections.ts ---------------------------------------- */
import type { LngLatLike } from "mapbox-gl";

/** Resultado que entrega la función */
export interface RouteWithSpeeds {
  geometry: [number, number][]; // polyline completa
  stepSpeeds: number[];         // m/s, un valor por segmento
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const PROFILE      = "mapbox/driving-traffic";              // ✨ usa tráfico real

export async function fetchRouteWithSpeeds(
  coords: LngLatLike[]
): Promise<RouteWithSpeeds> {
  if (coords.length < 2) throw new Error("Mínimo origen y destino");

  const coordStr = coords
    .map((c) =>
      Array.isArray(c) ? c.join(",") : `${c.lng},${c.lat}`
    )
    .join(";");

  const url =
    `https://api.mapbox.com/directions/v5/${PROFILE}/${coordStr}` +
    `?overview=full&geometries=geojson` +
    `&annotations=maxspeed,speed` +
    `&speed_type=freeflow` +
    `&steps=false&access_token=${MAPBOX_TOKEN}`;

  const data  = await fetch(url).then((r) => r.json());
  const route = data.routes?.[0];
  if (!route) throw new Error("No se recibió ninguna ruta");

  // ────────── DEBUG opcional ──────────
  console.dir(route.legs[0]?.annotation, { depth: 2 });
  // ────────────────────────────────────

  const geometry = route.geometry.coordinates as [number, number][];

  /* Aplanamos anotaciones de todas las legs */
  const max  = route.legs.flatMap((l: any) => l.annotation?.maxspeed ?? []);
  const hist = route.legs.flatMap((l: any) => l.annotation?.speed     ?? []);

  const stepSpeeds = max.map((m: any, i: number) => {
    /* 1️⃣ límite legal conocido -------------------- */
    if (m && !m.unknown && m.speed != null) {
      const v = Number(m.speed);
      return m.unit === "mph" ? v * 0.44704 : v / 3.6; // km/h → m/s
    }

    /* 2️⃣ sin límite: usa velocidad real (+10 %) ----- */
    const s = Number(hist[i]);                          // ya está en m/s
    if (!isNaN(s) && s > 0) return Math.min(s * 1.1, 35); // ✨ 35 m/s ≈126 km/h

    /* 3️⃣ último recurso: 30 km/h -------------------- */
    return 30 / 3.6;
  });

  /* padding si faltan valores (poco frecuente) */
  while (stepSpeeds.length < geometry.length - 1) {
    stepSpeeds.push(stepSpeeds.at(-1) ?? 30 / 3.6);
  }

  return { geometry, stepSpeeds };
}
