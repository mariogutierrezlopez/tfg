/* src/utils/carUtils.ts -------------------------------------------------- */
import * as mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import carIcon from "../assets/car-top-view.png"
import { TrafficElement } from "./types";
import { mergeTrafficRules } from "./mergeTrafficRules";
import { attachMeterScaling } from "./attachMeterScaling";
import { vehicleSizes } from "./types";
import { fetchRouteWithSpeeds } from "../utils/mapboxDirections";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
export type CarOption = { id: string; name: string; image: string };

export const createCarIcon = (
  imageUrl?: string,
  typeId?: string,
  carId?: string,
  onClick?: () => void
) => {
  const el = document.createElement("div");

  /* tamaño inicial (px) solo como referencia visual */
  let width = "36px";
  let height = "60px";
  if (typeId === "truck") { width = "80px"; height = "60px"; }
  else if (typeId === "motorcycle") { width = "20px"; height = "40px"; }

  el.style.width = width;
  el.style.height = height;
  el.style.backgroundImage = `url(${imageUrl ?? carIcon})`;
  el.style.backgroundSize = "contain";
  el.style.backgroundRepeat = "no-repeat";
  el.style.transformOrigin = "center center";
  el.style.position = "absolute";
  el.style.top = el.style.left = "0";
  el.style.cursor = "pointer";

  if (onClick) el.onclick = onClick;
  return el;
};

/* ------------------------------------------------------------------ */
/* addCarMarker                                                        */
/* ------------------------------------------------------------------ */
export const addCarMarker = async (
  coord: [number, number],
  map: mapboxgl.Map,
  selectedCarType: CarOption,
  destinationCoords: [number, number] | null,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  setSelectedCarId: (id: string) => void,
  token: string,
  handleRouteCalculation: (
    origin: [number, number],
    destination: [number, number],
    opt?: { skipFitBounds?: boolean }
  ) => Promise<{ routeData: any; trafficRules: TrafficElement[] } | null>,
  setTrafficRules: React.Dispatch<React.SetStateAction<TrafficElement[]>>
) => {
  /* 1) calcula ruta ---------------------------------------------------- */
  const dest = destinationCoords ?? [coord[0] + 0.01, coord[1] + 0.01];
  const out = await handleRouteCalculation(coord, dest, { skipFitBounds: true });
  if (!out) return;
  const { routeData, trafficRules: newRules } = out;

  /* 2) fusiona reglas -------------------------------------------------- */
  setTrafficRules(prev => mergeTrafficRules(prev, newRules));

  /* 3) tamaños físicos ------------------------------------------------- */
  const sizeCfg = vehicleSizes[selectedCarType.id as keyof typeof vehicleSizes] ?? { w: 36, h: 60 };
  const wM = (sizeCfg as any).wM ?? sizeCfg.w / 20; // ≈ 5 cm/px
  const lM = (sizeCfg as any).lM ?? sizeCfg.h / 20;

  /* 4) marker ---------------------------------------------------------- */
  const agentId = crypto.randomUUID();
  const start = routeData.coordinates[0];

  const marker = new mapboxgl.Marker({
    element: createCarIcon(selectedCarType.image, selectedCarType.id, agentId,
      () => setSelectedCarId(agentId)),
    rotationAlignment: "map",
    pitchAlignment: "map",
    anchor: "center",
  })
    .setLngLat(start)
    .addTo(map);

  /* 5) escalado real en metros ---------------------------------------- */
  const detach = attachMeterScaling(map, marker, wM, lM);

  /* 6) agente ---------------------------------------------------------- */
  const agent = new CarAgent(
    agentId,
    start,
    routeData.coordinates,
    marker,
    selectedCarType,
    routeData.stepSpeeds
  );
  (agent as any).detachZoom = detach;
  agent.targetSpeed = agent.maxSpeed;

  agentsRef.current.push(agent);
};

/* ------------------------------------------------------------------ */
/* spawnMainCar (main-car)  ── ahora asíncrono                         */
/* ------------------------------------------------------------------ */
export async function spawnMainCar(
  map: mapboxgl.Map,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  origin: [number, number],
  destination: [number, number],
  selectedCarType: CarOption,
  setSelectedCarId: (id: string) => void,
  setShowCarSelector: (b: boolean) => void,
  setShowSimulationControls: (b: boolean) => void,
  setSelectionSent: (b: boolean) => void,
  /* si ya calculaste la ruta fuera, pásala aquí ↓ y no se volverá a pedir */
  routeData?: { coordinates: [number, number][], stepSpeeds: number[] }
) {
  /* 1️⃣  ruta + límites ------------------------------------------------ */
  let coords: [number, number][], speeds: number[];

  if (routeData) {                     // ya viene todo
    coords = routeData.coordinates;
    speeds = routeData.stepSpeeds;
  } else {                             // la pedimos a Mapbox Directions
    const res = await fetchRouteWithSpeeds([origin, destination]);
    coords = res.geometry;
    speeds = res.stepSpeeds;
  }

  /* 2️⃣  icono + escalado --------------------------------------------- */
  const cfg = vehicleSizes[selectedCarType.id as keyof typeof vehicleSizes] ?? { w: 36, h: 60 };
  const wM  = (cfg as any).wM ?? cfg.w / 20;
  const lM  = (cfg as any).lM ?? cfg.h / 20;

  const marker = new mapboxgl.Marker({
    element: createCarIcon(selectedCarType.image, selectedCarType.id, "main-car",
      () => setSelectedCarId("main-car")),
    rotationAlignment: "map",
    pitchAlignment:    "map",
    anchor: "center",
  })
    .setLngLat(coords[0])
    .addTo(map);

  const detach = attachMeterScaling(map, marker, wM, lM);

  /* 3️⃣  agente principal ---------------------------------------------- */
  const mainCar = new CarAgent(
    "main-car",
    coords[0],            // posición inicial
    coords.slice(1),      // resto de la ruta
    marker,
    selectedCarType,
    speeds
  );
  (mainCar as any).detachZoom = detach;

  agentsRef.current = agentsRef.current.filter(c => c.id !== "main-car");
  agentsRef.current.push(mainCar);

  /* 4️⃣  UI ------------------------------------------------------------ */
  setShowCarSelector(true);
  setShowSimulationControls(true);
  setSelectionSent(true);
}


/* ------------------------------------------------------------------ */
/* Bearing util                                                        */
/* ------------------------------------------------------------------ */
export const getBearing = (
  from: [number, number],
  to: [number, number]
) => Math.atan2(to[0] - from[0], to[1] - from[1]) * (180 / Math.PI);
