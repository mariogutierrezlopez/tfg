import { useCallback } from "react";
import { lineString, point as turfPoint } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { TrafficElement } from "../utils/types";
import { drawRoundaboutEntryZone } from "../utils/mapSetup";
import { resampleRoute } from "../utils/resampleRoute";
import distance from "@turf/distance";
import { mergeTrafficRules } from "../utils/mergeTrafficRules";

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
  setTrafficRules: React.Dispatch<React.SetStateAction<TrafficElement[]>>;
  setRouteData: (data: any) => void;
  setShowPostRouteView: (show: boolean) => void;
  mapRef: React.RefObject<mapboxgl.Map>;
  token: string;
}) => {
  const handleRouteCalculation = useCallback(async (
    customOrigin?: [number, number],
    customDestination?: [number, number],
    options?: { skipFitBounds?: boolean }
  ): Promise<{ routeData: any; trafficRules: TrafficElement[] } | null> => {
    const origin = customOrigin ?? originCoords;
    const destination = customDestination ?? destinationCoords;
    const skipFitBounds = options?.skipFitBounds ?? false;
    
    console.log("Calculando ruta con:", originCoords, destinationCoords);

    if (!origin || !destination) {
      setRouteStatus("error");
      return null;
    }

    function deduplicateRules(
      rules: TrafficElement[],
      minDistance = 10
    ): TrafficElement[] {
      const unique: TrafficElement[] = [];

      for (const rule of rules) {
        const isTooClose = unique.some(
          (other) =>
            distance(turfPoint(rule.location), turfPoint(other.location), {
              units: "meters",
            }) < minDistance && rule.type === other.type
        );

        if (!isTooClose) {
          unique.push(rule);
        }
      }

      return unique;
    }
    
    function isValidCoordArray(coord: any): coord is [number, number] {
      return (
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === "number" &&
        typeof coord[1] === "number" &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1])
      );
    }

    if (!isValidCoordArray(origin) || !isValidCoordArray(destination)) {
      console.error("❌ Coordenadas inválidas:", origin, destination);
      setRouteStatus("error");
      return null;
    }
    
    

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&overview=full&steps=true&annotations=maxspeed&access_token=${token}`;
      if (
        !origin ||
        !destination ||
        origin.some((v) => isNaN(v)) ||
        destination.some((v) => isNaN(v))
      ) {
        console.error("❌ Coordenadas inválidas:", origin, destination);
        setRouteStatus("error");
        return null;
      }      
      const response = await fetch(url);
      const data = await response.json();
      const route = data.routes?.[0];
      const geometry = route?.geometry;

      if (!geometry || geometry.coordinates.length < 2) {
        setRouteStatus("error");
        return null;
      }

      const steps = route.legs?.[0]?.steps ?? [];

      // 🆕 Extraer límites de velocidad por step
      const stepSpeeds = steps.map((step) => {
        const raw = step.maxspeed?.speed ?? null;
        const roadClass = step.class ?? "unknown";

        let inferredSpeed = 30; // km/h por defecto
        switch (roadClass) {
          case "motorway":
            inferredSpeed = 120;
            break;
          case "primary":
            inferredSpeed = 100;
            break;
          case "secondary":
            inferredSpeed = 80;
            break;
          case "tertiary":
            inferredSpeed = 60;
            break;
          case "residential":
            inferredSpeed = 50;
            break;
        }

        const speedKmh = raw ?? inferredSpeed;
        return speedKmh / 3.6; // convertimos a m/s
      });

      // 🧠 Puedes pasar esto a tu lógica de CarAgent luego
      const resampled = resampleRoute(geometry.coordinates, 3);
      const resampledLine = lineString(resampled);

      // Detectar y ajustar reglas de tráfico
      const extractedRules: TrafficElement[] = [];

      steps.forEach((step, stepIndex) => {
        const maneuver = step.maneuver;
        const intersections = step.intersections ?? [];

        // Solo considerar reglas si el paso es el acceso a la rotonda
        const isEnteringRoundabout =
          maneuver?.type === "roundabout" || maneuver?.type === "rotary";

        if (isEnteringRoundabout) {
          extractedRules.push({
            id: `roundabout-${stepIndex}`,
            type: "roundabout",
            location: maneuver.location,
            radius: 30,
            priorityRule: "must-stop",
          });
        } else {
          intersections.forEach((intersection, i) => {
            const loc = intersection.location;
            if (
              maneuver?.modifier === "yield" ||
              maneuver?.type === "merge" ||
              maneuver?.type === "fork"
            ) {
              extractedRules.push({
                id: `yield-${stepIndex}-${i}`,
                type: "yield",
                location: loc,
                radius: 15,
                priorityRule: "give-way",
              });
            }
          });
        }
      });

      const deduplicatedRules = deduplicateRules(extractedRules);

      const adjustedRules = deduplicatedRules.map((rule) => {
        const snapped = nearestPointOnLine(
          resampledLine,
          turfPoint(rule.location)
        );
        return {
          ...rule,
          location: snapped.geometry.coordinates as [number, number],
        };
      });

      const map = mapRef.current;
      if (!map) return null;

      setTrafficRules(prev => {
        const merged = mergeTrafficRules(prev, adjustedRules);
    
        merged.forEach(rule => {
          if (rule.type === "roundabout") {
            const layerId = `${rule.id}-zone`;
            if (!map.getLayer(layerId)) {
              drawRoundaboutEntryZone(map, rule, layerId);
            }
          }
        });
    
        return merged;          // <<< el estado queda con todas las reglas
      });
      // 🧠 Guardar todo en el routeData para que lo consuma el coche
      setRouteData({
        ...route,
        coordinates: resampled,
        stepSpeeds, // <-- Aquí lo mandamos
      });

      if (map.getLayer("route")) {
        map.removeLayer("route");
      }

      if (map.getLayer("route-clickable-layer")) {
        map.removeLayer("route-clickable-layer");
      }

      if (map.getSource("route")) {
        map.removeSource("route");
      }

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

      // 👇 Usa un ID único y diferente aquí:
      map.addLayer({
        id: "route-clickable-layer",
        type: "line",
        source: "route",
        layout: {},
        paint: {
          "line-color": "#888888",
          "line-width": 6,
          "line-opacity": 0.6,
        },
      });

      if (!skipFitBounds) {
        map.fitBounds([origin, destination], { padding: 50 });
      }
      


      setRouteStatus("success");
      setShowPostRouteView(true);

      return {
        routeData: {
          ...route,
          coordinates: resampled,
          stepSpeeds,
        },
        trafficRules: adjustedRules,
      };
      
    } catch (err) {
      console.error("Route calculation failed:", err);
      setRouteStatus("error");
      return(null);
    }
  }, [originCoords, destinationCoords, mapRef, token]);

  return { handleRouteCalculation };
};
