import { TrafficElement } from "./types";
import { point as turfPoint } from "@turf/helpers";
import distance from "@turf/distance";

export const findNearbyTrafficRule = (
  pos: [number, number],
  rules: TrafficElement[],
  maxDistance: number = 10
): TrafficElement | null => {
  return rules.find((rule) => {
    const d = distance(turfPoint(rule.location), turfPoint(pos), { units: "meters" });
    return d <= (rule.radius ?? maxDistance);
  }) || null;
};
