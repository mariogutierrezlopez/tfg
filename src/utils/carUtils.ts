
/* utils/carUtils.ts (bloque completo de la función) */
import * as mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import carIcon from "../assets/car-top-view.png";
// import { fetchRouteFrom } from "./routeUtils";
import { TrafficElement } from "./types";
import { attachMeterScaling } from "./attachMeterScaling";
import { vehicleSizes } from "./types";
import { mergeTrafficRules } from "./mergeTrafficRules";

type CarOption = {
  id: string;
  name: string;
  image: string;
};

export const createCarIcon = (
  imageUrl?: string,
  typeId?: string,
  carId?: string,
  onClick?: () => void
) => {
  const el = document.createElement("div");

  let width = "36px";
  let height = "60px";
  if (typeId === "truck") {
    width = "80px";
    height = "60px";
  } else if (typeId === "motorcycle") {
    width = "20px";
    height = "40px";
  }

  el.style.width = width;
  el.style.height = height;
  el.style.backgroundImage = `url(${imageUrl ?? carIcon})`;
  el.style.backgroundSize = "contain";
  el.style.backgroundRepeat = "no-repeat";
  el.style.transformOrigin = "center center";
  el.style.position = "absolute";
  el.style.top = "0";
  el.style.left = "0";
  el.style.cursor = "pointer";

  if (onClick) {
    el.onclick = onClick;
  }

  return el;
};

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
    options?: { skipFitBounds?: boolean }
  ) => Promise<{
    routeData: any;
    trafficRules: TrafficElement[];
  } | null>,
  setTrafficRules: React.Dispatch<React.SetStateAction<TrafficElement[]>>
) => {
  /* ---------- calcula ruta ---------- */
  const fallbackDest: [number, number] = [coord[0] + 0.01, coord[1] + 0.01];
  const destination = destinationCoords ?? fallbackDest;

  const result = await handleRouteCalculation(coord, destination, {
    skipFitBounds: true,
  });
  if (!result) return;

  const { routeData, trafficRules: newRules } = result;

  /* ---------- fusiona reglas ---------- */
  setTrafficRules(prev => mergeTrafficRules(prev, newRules));

  /* ---------- marcador y agente ---------- */
  const agentId = crypto.randomUUID();
  const start   = routeData.coordinates[0];                 // origen real

  // const { w, h } = vehicleSizes[selectedCarType.id] ?? { w: 36, h: 60 };

  const marker = new mapboxgl.Marker({
    element: createCarIcon(
      selectedCarType.image,
      selectedCarType.id,
      agentId,
      () => setSelectedCarId(agentId)
    ),
    rotationAlignment: "map",
    pitchAlignment: "map",
    anchor: "center",
  })
    .setLngLat(start)
    .addTo(map);

  const { wM, lM } = (vehicleSizes as any)[selectedCarType.id] ?? { wM: 1.8, lM: 4.5 };
  const detachZoom = attachMeterScaling(map, marker, wM, lM);
  const agent = new CarAgent(
    agentId,
    start,
    routeData.coordinates,
    marker,
    selectedCarType,
    routeData.stepSpeeds
  );
  (agent as any).detachZoom = detachZoom;   // para limpiar al eliminar
  agent.targetSpeed = agent.maxSpeed;

  agentsRef.current.push(agent);
};


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

  const start = points[0];                                 // origen real
  const { w, h } = vehicleSizes[selectedCarType.id] ?? { w: 36, h: 60 };

  /* --------- marker --------- */
  const marker = new mapboxgl.Marker({
    element: createCarIcon(
      selectedCarType.image,
      selectedCarType.id,
      "main-car",
      () => setSelectedCarId("main-car")
    ),
    rotationAlignment: "map",
    pitchAlignment: "map",
    anchor: "center",
  })
    .setLngLat(start)
    .addTo(map);

  /* escala dinámica con zoom */
  const detachZoom = attachZoomScaling(map, marker, 16, w, h);

  /* --------- agente --------- */
  const mainCar = new CarAgent(
    "main-car",
    start,
    points,
    marker,
    selectedCarType,
    routeData?.stepSpeeds ?? []
  );
  (mainCar as any).detachZoom = detachZoom;

  agentsRef.current = agentsRef.current.filter(a => a.id !== "main-car");
  agentsRef.current.push(mainCar);  

  /* --------- UI --------- */
  setShowCarSelector(true);
  setShowSimulationControls(true);
  setSelectionSent(true);
};


export const getBearing = (from: [number, number], to: [number, number]) => {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  return Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
};
