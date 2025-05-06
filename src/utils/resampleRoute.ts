import { lineString } from "@turf/helpers";
import along from "@turf/along";
import length from "@turf/length";

export function resampleRoute(coords: [number, number][], stepMeters: number = 2): [number, number][] {
  const line = lineString(coords);
  const totalDistance = length(line, { units: "meters" }); // total en metros
  const steps = Math.floor(totalDistance / stepMeters);
  const newPoints: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const point = along(line, i * stepMeters, { units: "meters" });
    newPoints.push(point.geometry.coordinates as [number, number]);
  }

  return newPoints;
}
