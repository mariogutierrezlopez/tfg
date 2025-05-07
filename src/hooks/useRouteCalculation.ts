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
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&overview=full&steps=true&annotations=maxspeed&access_token=${token}`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data.routes?.[0];
      const geometry = route?.geometry;
    
      if (!geometry || geometry.coordinates.length < 2) {
        setRouteStatus("error");
        return;
      }
    
      const steps = route.legs?.[0]?.steps ?? [];
    
      // 🆕 Extraer límites de velocidad por step
      const stepSpeeds = steps.map((step) => {
        const raw = step.maxspeed?.speed ?? null;
        const roadClass = step.class ?? "unknown";
    
        let inferredSpeed = 30; // km/h por defecto
        switch (roadClass) {
          case "motorway": inferredSpeed = 120; break;
          case "primary": inferredSpeed = 100; break;
          case "secondary": inferredSpeed = 80; break;
          case "tertiary": inferredSpeed = 60; break;
          case "residential": inferredSpeed = 50; break;
        }
    
        const speedKmh = raw ?? inferredSpeed;
        return speedKmh / 3.6; // convertimos a m/s
      });
    
      // 🧠 Puedes pasar esto a tu lógica de CarAgent luego
      const resampled = resampleRoute(geometry.coordinates, 3);
      const resampledLine = lineString(resampled);
    
      // Detectar y ajustar reglas de tráfico
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
      console.log("🚗 Velocidades extraídas del route:", stepSpeeds);
      // 🧠 Guardar todo en el routeData para que lo consuma el coche
      setRouteData({
        ...route,
        coordinates: resampled,
        stepSpeeds, // <-- Aquí lo mandamos
      });
    
      map.getLayer("route") && map.removeLayer("route");
      map.getLayer("roads-clickable-layer") && map.removeLayer("roads-clickable-layer");
      map.getSource("route") && map.removeSource("route");
    
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { ...geometry, coordinates: resampled },
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
    } catch (err) {
      console.error("Route calculation failed:", err);
      setRouteStatus("error");
    }
    
  }, [originCoords, destinationCoords, mapRef, token]);

  return { handleRouteCalculation };
};
