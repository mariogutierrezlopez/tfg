import { TrafficElement } from "../utils/types";

export async function getTrafficRules(
  origin: [number, number],
  destination: [number, number],
  _snappedRoute: [number, number][],
  token: string
): Promise<TrafficElement[]> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.join(",")};${destination.join(",")}` +
    `?geometries=geojson&overview=full&steps=true&access_token=${token}`;

  const { routes } = await fetch(url).then((r) => r.json());
  const steps = routes?.[0]?.legs?.[0]?.steps ?? [];

  return steps.flatMap((step: { maneuver: { location: [number, number] | undefined; type: any; }; }, i: any) => {
    const loc = step.maneuver?.location as [number, number] | undefined;
    if (!loc) return [];

    const t = step.maneuver.type;
    if (t === "roundabout" || t === "rotary") {
      return [{
        id: `rb-${i}`,
        type: "roundabout",
        location: loc,
        radius: 30,
        priorityRule: "must-stop",
      }];
    } else if (["merge", "fork", "turn"].includes(t)) {
      return [{
        id: `y-${i}`,
        type: "yield",
        location: loc,
        radius: 15,
        priorityRule: "give-way",
      }];
    }
    return [];
  });
}
