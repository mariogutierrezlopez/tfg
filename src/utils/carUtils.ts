// src/utils/carUtils.ts

import * as mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import carIcon from "../assets/car-top-view.png"
import { TrafficElement } from "./types";
// import { mergeTrafficRules } from "./mergeTrafficRules";
import { attachMeterScaling } from "./attachMeterScaling";
import { vehicleSizes } from "./types";
import { fetchRouteWithSpeeds } from "../utils/mapboxDirections";
import { resampleRoute } from "./resampleRoute";
import { TreeNode } from "../utils/decisionTree";
import { point as turfPoint } from "@turf/helpers"; // <--- Añade esta importación
import distance from "@turf/distance";             // <--- Añade esta importación


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
  el.style.backgroundPosition = "center 48%"; //

  if (onClick) el.onclick = onClick;

  // MODIFICACIÓN: La sombra se gestionará ahora en attachMeterScaling
  // Eliminar el estilo previo de la sombra
  el.style.border = "none";
  el.style.borderRadius = "0";
  el.style.boxShadow = "none";

  return el;
};

/* ------------------------------------------------------------------ */
/* spawnCar genérico                      */
/* ------------------------------------------------------------------ */
export async function spawnCar(
  map: mapboxgl.Map,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  origin: [number, number],
  destination: [number, number],
  carType: CarOption,
  carId: string,                       // "main-car", randomId…
  onClickMarker: () => void,
  decisionTree: TreeNode | null
) {
  /* 1. ruta + límites ------------------------------------------ */
  const { geometry, stepSpeeds } =
    await fetchRouteWithSpeeds([origin, destination]);

  const drawCoords = resampleRoute(geometry, 3);

  /* 2. dibuja la polyline propia ------------------------------- */
  const srcId = `${carId}-route`;
  if (map.getLayer(srcId)) map.removeLayer(srcId);
  if (map.getSource(srcId)) map.removeSource(srcId);

  map.addSource(srcId, {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "LineString", coordinates: drawCoords } }
  });

  map.addLayer({
    id: srcId,
    type: "line",
    source: srcId,
    paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.8 }
  });

  /* 3. marker escalado ----------------------------------------- */
  const cfg = vehicleSizes[carType.id as keyof typeof vehicleSizes] ?? { w: 36, h: 60 };
  const wM = (cfg as any).wM ?? cfg.w / 20;
  const lM = (cfg as any).lM ?? cfg.h / 20;

  const marker = new mapboxgl.Marker({
    element: createCarIcon(carType.image, carType.id, carId, onClickMarker),
    rotationAlignment: "map", pitchAlignment: "map", anchor: "center",
  }).setLngLat(geometry[0]).addTo(map);

  // MODIFICACIÓN: Pasar carId a attachMeterScaling
  const detach = attachMeterScaling(map, marker, wM, lM, 32, carId);

  /* 4. agente --------------------------------------------------- */
  const agent = new CarAgent(
    carId,
    geometry[0],
    geometry.slice(1),       // resto ruta
    marker,
    carType,
    stepSpeeds,
    decisionTree,
    false // <-- MODIFICACIÓN: Los coches principales NO tienen velocidad constante
  );
  (agent as any).detachZoom = detach;

  agentsRef.current = agentsRef.current.filter(a => a.id !== carId);
  agentsRef.current.push(agent);
}

export async function spawnMainCar(
  map: mapboxgl.Map,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  origin: [number, number],
  destination: [number, number],
  carType: CarOption,
  setSelectedCarId: (id: string) => void,
  setShowCarSelector: (b: boolean) => void,
  setShowSimControls: (b: boolean) => void,
  setSelectionSent: (b: boolean) => void,
  decisionTree: TreeNode | null
) {
  /* 1) delegamos todo el trabajo pesado en spawnCar */
  await spawnCar(
    map,
    agentsRef,
    origin,
    destination,
    carType,
    "main-car",               // ← id fijo
    () => setSelectedCarId("main-car"),
    decisionTree
  );

  /* 2) encendemos la UI */
  setShowCarSelector(true);
  setShowSimControls(true);
  setSelectionSent(true);     // oculta el SearchForm & RouteActionsPanel
}

export async function spawnSecondaryCar(
  map: mapboxgl.Map,
  agentsRef: React.MutableRefObject<CarAgent[]>,
  origin: [number, number],
  destination: [number, number],
  speedKmh: number,
  carId: string,
  trafficRules: TrafficElement[] // <--- ¡NUEVO PARÁMETRO!
) {
  // 1) obtenemos la geometría
  const { geometry } = await fetchRouteWithSpeeds([origin, destination]);
  const drawCoords = resampleRoute(geometry, 3);

  // 2) pintamos la ruta (línea discontinua gris)
  const srcId = `${carId}-route`;
  if (map.getLayer(srcId)) map.removeLayer(srcId);
  if (map.getSource(srcId)) map.removeSource(srcId);
  map.addSource(srcId, {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "LineString", coordinates: drawCoords } }
  });
  map.addLayer({
    id: srcId,
    type: "line",
    source: srcId,
    paint: {
      "line-color": "#666",
      "line-width": 3,
      "line-dasharray": [2, 2],
      "line-opacity": 0.7
    }
  });

  // 3) creamos un marcador con tu icono escalable
  const cfg = vehicleSizes["secondary"] ?? { w: 36, h: 60 };
  const wM = (cfg as any).wM ?? cfg.w / 20;
  const lM = (cfg as any).lM ?? cfg.h / 20;

  const el = createCarIcon(carIcon, "secondary", carId);

  const marker = new mapboxgl.Marker({
    element: el,
    rotationAlignment: "map",
    pitchAlignment: "map",
    anchor: "center"
  })
    .setLngLat(origin)
    .addTo(map);

  // MODIFICACIÓN: Pasar carId a attachMeterScaling
  const detach = attachMeterScaling(map, marker, wM, lM, 32, carId);

  // 4) agente que se moverá con velocidad constante
  const mps = speedKmh / 3.6;
  const stepSpeeds = drawCoords.slice(1).map(() => mps);

  const agent = new CarAgent(
    carId,
    geometry[0],
    geometry.slice(1),
    marker,
    { id: "secondary", name: "sec", image: carIcon },
    stepSpeeds,
    null,
    true // <-- MODIFICACIÓN: Los coches secundarios SÍ tienen velocidad constante
  );
  (agent as any).detachZoom = detach;

  const relevantRoundabout = trafficRules.find(rule =>
    rule.type === "roundabout" &&
    distance(turfPoint(origin), turfPoint(rule.location), { units: "meters" }) < rule.radius
  );

  if (relevantRoundabout) {
    agent.isInsideRoundabout = true;
    agent.insideRoundaboutIds.add(relevantRoundabout.id);
    console.log(`LOG_SPAWN (${agent.id}): Generado DENTRO de rotonda ${relevantRoundabout.id}.`);
  }
  agentsRef.current = agentsRef.current.filter(a => a.id !== carId);
  agentsRef.current.push(agent);
}