// src/hooks/useRoadClickBinding.ts
import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";

type MapEvt = mapboxgl.MapMouseEvent & mapboxgl.EventData;

/** capas sobre las que queremos actuar */
const TARGET_LAYERS = ["roads-clickable-layer", "route-clickable-layer"];

export function useRoadClickBinding(
  map: mapboxgl.Map | null,
  onClick: (e: MapEvt) => void,
  deps: any[] = [],
  mode: "full" | "area" | null = null
) {
  /* ref estable para la callback */
  const cbRef = useRef<(e: MapEvt) => void>(() => {});
  cbRef.current = onClick ?? (() => {});

  useEffect(() => {
    if (!map) return;
    // Si estamos en modo área, no queremos capturar clicks en carreteras
    if (mode === "area") return;

    /** único listener para todo el mapa */
    const listener = (e: MapEvt) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: TARGET_LAYERS,
      });
      if (feats.length && typeof cbRef.current === "function") {
        cbRef.current(e);          // clic sobre una de las capas
      }
    };

    map.on("click", listener);

    return () => {
      map.off("click", listener);
    };
  }, [map, mode, ...deps]); // re-crea el listener al cambiar `mode` o deps
}
