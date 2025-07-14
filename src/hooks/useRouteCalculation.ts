/* src/hooks/useRouteCalculation.tsx
   ⓘ  ya no contiene lógica de velocidades ni reglas — solo coordina  */

import { useCallback } from "react";
// import mapboxgl from "mapbox-gl";
// import { point as turfPoint }  from "@turf/helpers";
// import distance                from "@turf/distance";
import { TrafficElement } from "../utils/types";
import { fetchRouteFrom } from "../utils/routeUtils";        // ✅
import { mergeTrafficRules } from "../utils/mergeTrafficRules";
import { drawRoundaboutEntryZone } from "../utils/mapSetup";

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

  /* ────────────────────────────────────────────────────────────── */
  /*  handler                                                      */
  /* ────────────────────────────────────────────────────────────── */
  const handleRouteCalculation = useCallback(
    async (
      customOrigin?: [number, number],
      customDestination?: [number, number],
      opt?: { skipFitBounds?: boolean }
    ): Promise<{ routeData: any; trafficRules: TrafficElement[] } | null> => {

      const origin = customOrigin ?? originCoords;
      const destination = customDestination ?? destinationCoords;
      const skipFit = opt?.skipFitBounds ?? false;

      if (
        !origin ||
        !destination ||
        !Array.isArray(origin) ||
        !Array.isArray(destination) ||
        origin.length !== 2 ||
        destination.length !== 2 ||
        isNaN(origin[0]) ||
        isNaN(origin[1]) ||
        isNaN(destination[0]) ||
        isNaN(destination[1])
      ) {
        setRouteStatus("error");
        console.error("Invalid coordinates for route calculation", { origin, destination });
        return null;
      }

      try {
        /* obtén ruta + speeds + reglas con helper central */
        const res = await fetchRouteFrom(origin, destination, token);
        if (!res) { setRouteStatus("error"); return null; }

        const { routeData, trafficRules } = res;

        /* estado global de reglas (merge para no perder las previas) */
        setTrafficRules(prev => {
          const merged = mergeTrafficRules(prev, trafficRules);
          const map = mapRef.current;
          if (map) {
            merged.forEach(rule => {
              if (rule.type === "roundabout") {
                const id = `${rule.id}-zone`;
                if (!map.getLayer(id)) drawRoundaboutEntryZone(map, rule, id);
              }
            });
          }
          return merged;
        });

        /* guarda toda la ruta (incluye stepSpeeds) */
        setRouteData(routeData);

        /* pinta la polilínea */
        const map = mapRef.current;
        if (map) {
          /* elimina en orden: capas -> source */
          if (map.getLayer("route-clickable-layer"))
            map.removeLayer("route-clickable-layer");
          if (map.getLayer("route"))
            map.removeLayer("route");
          if (map.getSource("route"))
            map.removeSource("route");

          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: routeData.drawCoords },
              properties: {}
            }
          });

          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            paint: { "line-color": "#007AFF", "line-width": 5 }
          });

          /* capa clicable si la necesitas */
          map.addLayer({
            id: "route-clickable-layer",
            type: "line",
            source: "route",
            paint: {
              "line-color": "#888", "line-width": 6, "line-opacity": 0.6
            }
          });

          if (!skipFit) {
            map.fitBounds([origin, destination], { padding: 50 });
          }
        }

        setRouteStatus("success");
        setShowPostRouteView(true);
        return { routeData, trafficRules };

      } catch (e) {
        console.error("Route calculation failed:", e);
        setRouteStatus("error");
        return null;
      }
    },
    [originCoords, destinationCoords, mapRef, token]
  );

  /* expose */
  return { handleRouteCalculation };
};
