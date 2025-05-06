import mapboxgl from "mapbox-gl";

export abstract class TrafficAgent {
  id: string;
  position: [number, number];
  speed: number; // m/s
  acceleration: number; // m/s²
  route: [number, number][];
  marker: mapboxgl.Marker;
  type: string;

  constructor(
    id: string,
    position: [number, number],
    route: [number, number][],
    marker: mapboxgl.Marker,
    type: string
  ) {
    this.id = id;
    this.position = position;
    this.route = route;
    this.marker = marker;
    this.speed = 0;
    this.acceleration = 2;
    this.type = type;
  }

  updatePosition(dt: number) {
    throw new Error("Must be implemented by subclass");
  }

  draw(map: mapboxgl.Map) {
    this.marker.setLngLat(this.position);
  }
}
