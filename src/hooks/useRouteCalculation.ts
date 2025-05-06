import { useCallback } from "react";
import { lineString, point as turfPoint } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { TrafficElement } from "../utils/types";
import { drawRoundaboutEntryZone } from "../utils/mapSetup";
import { resampleRoute } from "../utils/resampleRoute";

export const useRouteCalculation = ({
  originCoords,
  destinationCoords,
  setRouteStatus,
  setTrafficRules,
  setRouteData,
  setShowPostRouteView,
  mapRef,
  token,
}: {
  originCoords: [number, number] | null;
  destinationCoords: [number, number] | null;
  setRouteStatus: (status: string | null) => void;
  setTrafficRules: (rules: TrafficElement[]) => void;
  setRouteData: (data: any) => void;
  setShowPostRouteView: (show: boolean) => void;
  mapRef: React.RefObject<mapboxgl.Map>;
  token: string;
}) => {
  const handleRouteCalculation = useCallback(async () => {
    if (!originCoords || !destinationCoords) {
      setRouteStatus("error");
      return;
    }

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&overview=full&steps=true&access_token=${token}`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data.routes?.[0]?.geometry;
      if (!route || route.coordinates.length < 2) {
        setRouteStatus("error");
        return;
      }

      const steps = data.routes?.[0]?.legs?.[0]?.steps ?? [];
      const extractedRules: TrafficElement[] = steps.map((step, index) => {
        const loc = step.maneuver?.location;
        const type = step.maneuver?.type;
        if (!loc || !type) return null;

        if (type === "roundabout" || type === "rotary") {
          return {
            id: `roundabout-${index}`,
            type: "roundabout",
            location: loc,
            radius: 30,
            priorityRule: "must-stop",
          };
        }

        if (type === "turn" || type === "merge" || type === "fork") {
          return {
            id: `yield-${index}`,
            type: "yield",
            location: loc,
            radius: 15,
            priorityRule: "give-way",
          };
        }

        return null;
      }).filter((x): x is TrafficElement => x !== null);

      const resampled = resampleRoute(route.coordinates, 3);
      const resampledLine = lineString(resampled);

      const adjustedRules = extractedRules.map(rule => {
        const snapped = nearestPointOnLine(resampledLine, turfPoint(rule.location));
        return {
          ...rule,
          location: [snapped.geometry.coordinates[0], snapped.geometry.coordinates[1]],
        };
      });

      const map = mapRef.current;
      if (!map) return;

      setTrafficRules(adjustedRules);

      adjustedRules.forEach((rule, i) => {
        if (rule.type === "roundabout") {
          drawRoundaboutEntryZone(map, rule, `roundabout-zone-${i}`);
        }
      });

      const iconFeatures: GeoJSON.Feature[] = adjustedRules.map(rule => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: rule.location },
        properties: {
          icon: rule.type === "roundabout"
            ? "roundabout-sign"
            : rule.priorityRule === "must-stop"
              ? "stop-sign"
              : "yield-sign",
        },
      }));

      if (map.getSource("traffic-icons")) {
        (map.getSource("traffic-icons") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: iconFeatures,
        });
      } else {
        map.addSource("traffic-icons", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: iconFeatures,
          },
        });

        map.addLayer({
          id: "traffic-icons-layer",
          type: "symbol",
          source: "traffic-icons",
          layout: {
            "icon-image": ["get", "icon"],
            "icon-size": 0.1,
            "icon-allow-overlap": true,
          },
        });
      }

      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getLayer("roads-clickable-layer")) map.removeLayer("roads-clickable-layer");
      if (map.getSource("route")) map.removeSource("route");

      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { ...route, coordinates: resampled },
        },
      });

      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#007AFF", "line-width": 5 },
      });

      map.addLayer({
        id: "roads-clickable-layer",
        type: "line",
        source: "route",
        layout: {},
        paint: {
          "line-color": "#888888",
          "line-width": 6,
          "line-opacity": 0.6,
        },
      });

      map.fitBounds([originCoords, destinationCoords], { padding: 50 });

      setRouteStatus("success");
      setShowPostRouteView(true);
      setRouteData({ ...route, coordinates: resampled });

    } catch (err) {
      console.error("Route calculation failed:", err);
      setRouteStatus("error");
    }
  }, [originCoords, destinationCoords, mapRef, token]);

  return { handleRouteCalculation };
};
