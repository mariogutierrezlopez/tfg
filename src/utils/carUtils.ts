import * as mapboxgl from "mapbox-gl";
import { CarAgent } from "../logic/agents/CarAgents";
import carIcon from "../assets/car-top-view.png";
import { fetchRouteFrom } from "./routeUtils";

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
  setSelectedCarId: (id: string) => void
) => {
  const fallbackDest: [number, number] = [coord[0] + 0.01, coord[1] + 0.01];
  const destination = destinationCoords ?? fallbackDest;
  const route = await fetchRouteFrom(coord, destination);
  if (!route) return;

  const agentId = crypto.randomUUID();
  const marker = new mapboxgl.Marker({
    element: createCarIcon(selectedCarType.image, selectedCarType.id, agentId, () => {
      setSelectedCarId(agentId);
    }),
    rotationAlignment: "map",
    pitchAlignment: "map",
    anchor: "center",
  }).setLngLat(coord).addTo(map);

  const agent = new CarAgent(agentId, coord, route, marker, selectedCarType);
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

  const marker = new mapboxgl.Marker({
    element: createCarIcon(selectedCarType.image, selectedCarType.id, "main-car", () => {
      setSelectedCarId("main-car");
    }),
    rotationAlignment: "map",
    pitchAlignment: "map",
    anchor: "center",
  }).setLngLat(points[0]).addTo(map);

  const mainCar = new CarAgent("main-car", points[0], points, marker, selectedCarType);
  agentsRef.current = agentsRef.current.filter((a) => a.id !== "main-car");
  agentsRef.current.push(mainCar);

  setShowCarSelector(true);
  setShowSimulationControls(true);
  setSelectionSent(true);
};

export const getBearing = (from: [number, number], to: [number, number]) => {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  return Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
};
