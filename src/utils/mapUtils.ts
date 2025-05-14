/*  utils/carUtils.ts  */
/*  ———————————————————————————————————————————————————————————————— */
/*  Cambios aplicados:                                                   */
/*   • Escalado físico en metros con attachMeterScaling                  */
/*   • Uso de vehicleSizes { wPx, hPx, wM, lM }                          */
/*   • El marker se coloca siempre en el 1er punto real de la ruta       */
/*  ———————————————————————————————————————————————————————————————— */

import * as mapboxgl          from "mapbox-gl";
import { CarAgent }           from "../logic/agents/CarAgents";
import carIcon                from "../assets/car-top-view.png";
import { TrafficElement }     from "./types";
import { mergeTrafficRules }  from "./mergeTrafficRules";
import { attachMeterScaling } from "./attachMeterScaling";
import { vehicleSizes } from "./types";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
type CarOption = { id: string; name: string; image: string };

export const createCarIcon = (
  imageUrl?: string,
  typeId?: string,
  carId?: string,
  onClick?: () => void
) => {
  const el = document.createElement("div");

  /* tamaño inicial sólo como referencia visual */
  let width  = "36px";
  let height = "60px";
  if (typeId === "truck")      { width = "80px"; height = "60px"; }
  else if (typeId === "motorcycle") { width = "20px"; height = "40px"; }

  el.style.width  = width;
  el.style.height = height;
  el.style.backgroundImage  = `url(${imageUrl ?? carIcon})`;
  el.style.backgroundSize   = "contain";
  el.style.backgroundRepeat = "no-repeat";
  el.style.transformOrigin  = "center center";
  el.style.position         = "absolute";
  el.style.top = el.style.left = "0";
  el.style.cursor = "pointer";

  if (onClick) el.onclick = onClick;
  return el;
};


export function drawMainCarRoute(
  map: mapboxgl.Map,
  route: [number, number][]
) {
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
      properties: {},
    },
  });

  map.addLayer({
    id: "main-car-route",
    type: "line",
    source: "main-car-route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.8 },
  });
}


/* ------------------------------------------------------------------ */
/* addCarMarker                                                        */
/* ------------------------------------------------------------------ */
export const addCarMarker = async (
  coord: [number, number],
  map: mapboxgl.Map,
  selectedCarType: { id: string; name: string; image: string },
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
  /* 1) calcular ruta */
  const dest   = destinationCoords ?? [coord[0] + 0.01, coord[1] + 0.01];
  const out    = await handleRouteCalculation(coord, dest, { skipFitBounds: true });
  if (!out) return;
  const { routeData, trafficRules: newRules } = out;

  /* 2) fusionar reglas de tráfico */
  setTrafficRules(prev => mergeTrafficRules(prev, newRules));

  /* 3) datos de tamaño */
  const sizeCfg = vehicleSizes[selectedCarType.id as keyof typeof vehicleSizes] ?? { w: 36, h: 60 };
  const wPx = sizeCfg.w;
  const hPx = sizeCfg.h;

  /* estimación metros reales si no se proporcionan */
  const wM = (sizeCfg as any).wM ?? (wPx / 20);   // ≈ 1 px = 5 cm
  const lM = (sizeCfg as any).lM ?? (hPx / 20);

  /* 4) crear marker */
  const agentId = crypto.randomUUID();
  const start   = routeData.coordinates[0];

  const marker = new mapboxgl.Marker({
    element: createCarIcon(selectedCarType.image, selectedCarType.id, agentId,
      () => setSelectedCarId(agentId)),
    rotationAlignment: "map",
    pitchAlignment:    "map",
    anchor: "center",
  })
    .setLngLat(start)
    .addTo(map);

  /* 5) escalar físicamente */
  const detach = attachMeterScaling(map, marker, wM, lM);

  /* 6) crear agente */
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
/* startCarAnimation (main-car)                                        */
/* ------------------------------------------------------------------ */
export const startCarAnimation = (
  coords: [number, number][] | undefined,
  selectedCarType: CarOption,
  routeData: any,
  map: mapboxgl.Map,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  setSelectedCarId: (id: string) => void,
  setShowCarSelector: (b: boolean) => void,
  setShowSimulationControls: (b: boolean) => void,
  setSelectionSent: (b: boolean) => void
) => {
  const points = coords ?? routeData?.coordinates;
  if (!points) return;

  const start = points[0];

  /* --------- tamaño físico --------- */
const sizeCfg = vehicleSizes[selectedCarType.id as keyof typeof vehicleSizes] ?? { w: 36, h: 60 };
const wM = (sizeCfg as any).wM ?? sizeCfg.w / 20;   // ≈ 5 cm/px por defecto
const lM = (sizeCfg as any).lM ?? sizeCfg.h / 20;

/* --------- marker --------- */
const marker = new mapboxgl.Marker({
  element: createCarIcon(
    selectedCarType.image,
    selectedCarType.id,
    "main-car",
    () => setSelectedCarId("main-car")
  ),
  rotationAlignment: "map",
  pitchAlignment:    "map",
  anchor: "center",
})
  .setLngLat(start)
  .addTo(map);

/* --------- escalar en metros --------- */
const detacher = attachMeterScaling(map, marker, wM, lM);

  const mainCar = new CarAgent(
    "main-car",
    start,
    points,
    marker,
    selectedCarType,
    routeData?.stepSpeeds ?? []
  );
  (mainCar as any).detachZoom = detacher;

  agentsRef.current = agentsRef.current.filter(c => c.id !== "main-car");
  agentsRef.current.push(mainCar);

  setShowCarSelector(true);
  setShowSimulationControls(true);
  setSelectionSent(true);
};

/* ------------------------------------------------------------------ */
/* Bearing util                                                        */
/* ------------------------------------------------------------------ */
export const getBearing = (
  from: [number, number],
  to: [number, number]
) => Math.atan2(to[0] - from[0], to[1] - from[1]) * (180 / Math.PI);
