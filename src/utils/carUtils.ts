/* src/utils/carUtils.ts -------------------------------------------------- */
import * as mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import carIcon from "../assets/car-top-view.png"
import { TrafficElement } from "./types";
import { mergeTrafficRules } from "./mergeTrafficRules";
import { attachMeterScaling } from "./attachMeterScaling";
import { vehicleSizes } from "./types";
import { fetchRouteWithSpeeds } from "../utils/mapboxDirections";
import { resampleRoute } from "./resampleRoute";

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
/* spawnCar genérico                      */
/* ------------------------------------------------------------------ */
export async function spawnCar(
  map           : mapboxgl.Map,
  agentsRef     : React.MutableRefObject<CarAgent[]>,
  origin        : [number,number],
  destination   : [number,number],
  carType       : CarOption,
  carId         : string,                       // "main-car", randomId…
  onClickMarker : () => void,
){
  /* 1. ruta + límites ------------------------------------------ */
  const { geometry, stepSpeeds } =
        await fetchRouteWithSpeeds([origin, destination]);

  const drawCoords = resampleRoute(geometry, 3);

  /* 2. dibuja la polyline propia ------------------------------- */
  const srcId = `${carId}-route`;
  if (map.getLayer(srcId))   map.removeLayer(srcId);
  if (map.getSource(srcId))  map.removeSource(srcId);

  map.addSource(srcId, {
    type: "geojson",
    data: { type:"Feature", geometry:{type:"LineString",coordinates:drawCoords}}
  });

  map.addLayer({
    id   : srcId,
    type : "line",
    source: srcId,
    paint: { "line-color":"#2563eb", "line-width":4, "line-opacity":0.8 }
  });

  /* 3. marker escalado ----------------------------------------- */
  const cfg = vehicleSizes[carType.id as keyof typeof vehicleSizes] ?? {w:36,h:60};
  const wM  = (cfg as any).wM ?? cfg.w/20;
  const lM  = (cfg as any).lM ?? cfg.h/20;

  const marker = new mapboxgl.Marker({
      element : createCarIcon(carType.image, carType.id, carId, onClickMarker),
      rotationAlignment:"map", pitchAlignment:"map", anchor:"center",
  }).setLngLat(geometry[0]).addTo(map);

  const detach = attachMeterScaling(map, marker, wM, lM);

  /* 4. agente --------------------------------------------------- */
  const agent = new CarAgent(
    carId,
    geometry[0],
    geometry.slice(1),       // resto ruta
    marker,
    carType,
    stepSpeeds
  );
  (agent as any).detachZoom = detach;

  agentsRef.current = agentsRef.current.filter(a => a.id !== carId);
  agentsRef.current.push(agent);
}

export const spawnMainCar = (
  map           : mapboxgl.Map,
  agentsRef     : React.MutableRefObject<CarAgent[]>,
  origin        : [number,number],
  destination   : [number,number],
  carType       : CarOption,
  setSelected   : (id:string)=>void,
  setShowCarSel : (b:boolean)=>void,
  setShowSimCtl : (b:boolean)=>void,
  setSelection  : (b:boolean)=>void,
) =>
  spawnCar(
    map,
    agentsRef,
    origin,
    destination,
    carType,
    "main-car",
    () => setSelected("main-car")
  ).then(()=>{
    setShowCarSel(true);
    setShowSimCtl(true);
    setSelection(true);
  });



/* ------------------------------------------------------------------ */
/* Bearing util                                                        */
/* ------------------------------------------------------------------ */
export const getBearing = (
  from: [number, number],
  to: [number, number]
) => Math.atan2(to[0] - from[0], to[1] - from[1]) * (180 / Math.PI);
