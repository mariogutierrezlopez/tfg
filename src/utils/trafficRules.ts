import {
  point as turfPoint,
  lineString,
  featureCollection,
  point,
} from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import centroid from "@turf/centroid";
import circle from "@turf/circle";
import { FeatureCollection, Feature, Point } from "geojson";
import { TrafficElement, TrafficPriorityRule } from "../utils/types";

type RawRule = {
  id: string;
  type: "roundabout" | "yield";
  location: [number, number];
  radius: number;
  priorityRule: TrafficPriorityRule;
  stepIndex: number;
};

// Ajuste geométrico de circunferencia
function fitCircle(points: [number, number][]): [number, number] {
  const n = points.length;
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
  let sumX3 = 0, sumY3 = 0, sumX1Y2 = 0, sumX2Y1 = 0;

  for (const [x, y] of points) {
    const x2 = x * x;
    const y2 = y * y;
    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumXY += x * y;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumX1Y2 += x * y2;
    sumX2Y1 += x2 * y;
  }

  const C = n * sumX2 - sumX * sumX;
  const D = n * sumXY - sumX * sumY;
  const E = n * (sumX3 + sumX1Y2) - (sumX2 + sumY2) * sumX;
  const G = n * sumY2 - sumY * sumY;
  const H = n * (sumY3 + sumX2Y1) - (sumX2 + sumY2) * sumY;

  const denominator = 2 * (C * G - D * D);
  if (Math.abs(denominator) < 1e-12) return [sumX / n, sumY / n];

  const centerX = (G * E - D * H) / denominator;
  const centerY = (C * H - D * E) / denominator;
  return [centerX, centerY];
}

async function getRoundaboutCenterFromOSM(
  location: [number, number]
): Promise<[number, number] | null> {
  const [lng, lat] = location;
  const query = `
    [out:json][timeout:10];
    way(around:50, ${lat}, ${lng})["junction"="roundabout"];
    out geom;
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    const data = await res.json();

    if (data?.elements?.length > 0 && data.elements[0].geometry) {
      const coords = data.elements[0].geometry.map(
        (p: any) => [p.lon, p.lat]
      ) as [number, number][];

      const isClosed =
        coords.length > 6 &&
        distance(turfPoint(coords[0]), turfPoint(coords[coords.length - 1]), {
          units: "meters",
        }) < 5;

      return isClosed ? fitCircle(coords) : centroid(lineString(coords)).geometry.coordinates as [number, number];
    }
  } catch (err) {
    console.warn("❗ Error consultando Overpass API:", err);
  }

  return null;
}

export async function getTrafficRules(
  origin: [number, number],
  destination: [number, number],
  snappedRoute: [number, number][],
  token: string
): Promise<TrafficElement[]> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.join(",")};${destination.join(",")}` +
    `?geometries=geojson&overview=full&steps=true&access_token=${token}`;
  const { routes } = await fetch(url).then((r) => r.json());
  const steps = routes?.[0]?.legs?.[0]?.steps ?? [];

  const raw: RawRule[] = [];
  steps.forEach((s, i) => {
    const loc = s.maneuver?.location as [number, number] | undefined;
    const tp = s.maneuver?.type;
    if (!loc || !tp) return;
    if (tp === "roundabout" || tp === "rotary") {
      raw.push({
        id: `rb-${i}`,
        type: "roundabout",
        location: loc,
        radius: 30,
        priorityRule: "must-stop",
        stepIndex: i,
      });
    } else if (["merge", "fork", "turn"].includes(tp)) {
      raw.push({
        id: `y-${i}`,
        type: "yield",
        location: loc,
        radius: 15,
        priorityRule: "give-way",
        stepIndex: i,
      });
    }
  });

  const roundRaw = raw.filter(r => r.type === "roundabout").sort((a, b) => a.stepIndex - b.stepIndex);
  const roundClusters: RawRule[][] = [];
  for (const rule of roundRaw) {
    const last = roundClusters[roundClusters.length - 1];
    if (
      last &&
      rule.stepIndex - last[last.length - 1].stepIndex <= 2 &&
      distance(turfPoint(rule.location), turfPoint(last[last.length - 1].location), { units: "meters" }) < 100
    ) {
      last.push(rule);
    } else {
      roundClusters.push([rule]);
    }
  }

  const yieldRaw = raw.filter((r) => r.type === "yield");
  const yieldUniq: RawRule[] = [];
  for (const y of yieldRaw) {
    if (!yieldUniq.some((u) =>
      distance(turfPoint(u.location), turfPoint(y.location), { units: "meters" }) < 10
    )) {
      yieldUniq.push(y);
    }
  }

  const routeLine = lineString(snappedRoute);
  const result: TrafficElement[] = [];
  const debugGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  for (const [index, cluster] of roundClusters.entries()) {
    let ctr: [number, number] | null = null;

    try {
      ctr = await getRoundaboutCenterFromOSM(cluster[0].location);
    } catch (e) {
      console.warn("Overpass fallback error:", e);
    }

    if (!ctr) {
      const snappedIndices: number[] = [];

      cluster.forEach((r) => {
        const snapped = nearestPointOnLine(routeLine, turfPoint(r.location));
        const idx = snapped.properties.index;
        if (typeof idx === "number") snappedIndices.push(idx);
      });

      const minIdx = Math.max(0, Math.min(...snappedIndices) - 5);
      const maxIdx = Math.min(snappedRoute.length - 1, Math.max(...snappedIndices) + 5);

      const roundaboutPoints = snappedRoute
        .slice(minIdx, maxIdx + 1)
        .map((pt) => turfPoint(pt)) as Feature<Point>[];

      ctr = centroid(featureCollection(roundaboutPoints)).geometry.coordinates as [number, number];
    }

    debugGeoJSON.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: ctr },
      properties: { type: "center", id: cluster[0].id },
    });

    const circleFeature = circle(ctr, cluster[0].radius / 1000, {
      steps: 64,
      units: "kilometers",
    });

    debugGeoJSON.features.push({
      type: "Feature",
      geometry: circleFeature.geometry,
      properties: { type: "circle", id: cluster[0].id },
    });

    result.push({
      id: cluster[0].id,
      type: "roundabout",
      location: ctr,
      radius: cluster[0].radius,
      priorityRule: cluster[0].priorityRule,
    });
  }

  for (const y of yieldUniq) {
    const snapped = nearestPointOnLine(routeLine, turfPoint(y.location));
    const [lng, lat] = snapped.geometry.coordinates;
    result.push({
      id: y.id,
      type: "yield",
      location: [lng, lat],
      radius: y.radius,
      priorityRule: y.priorityRule,
    });
  }

  console.log("Final Traffic Elements:", result);
  console.log("🔵 Visual Debug GeoJSON:", debugGeoJSON);

  return result;
}
