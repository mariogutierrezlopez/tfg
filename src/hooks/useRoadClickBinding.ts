// src/hooks/useRoadClickBinding.ts
import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";

type MapEvt = mapboxgl.MapMouseEvent & mapboxgl.EventData;

const TARGET_LAYERS = ["roads-clickable-layer", "route-clickable-layer"];

export function useRoadClickBinding(
  map: mapboxgl.Map | null,
  onClick: (e: MapEvt) => void,
  deps: any[] = [],
  mode: "full" | "area" | "manual-secondary" | null = null
) {
  const cbRef = useRef<(e: MapEvt) => void>(() => { });
  cbRef.current = onClick ?? (() => { });

  useEffect(() => {
    if (!map) return;
    // Si estamos en modo área, no queremos capturar clicks en carreteras
    if (mode === "area") return;

    // Pero si modo_manual_secondary, dejamos que React capture el click
    if (mode === "manual-secondary") return;

    /** único listener para todo el mapa */
    const listener = (e: MapEvt) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: TARGET_LAYERS,
      });
      if (feats.length && typeof cbRef.current === "function") {
        cbRef.current(e);
      }
    };

    map.on("click", listener);

    return () => {
      map.off("click", listener);
    };
  }, [map, mode, ...deps]);
}
