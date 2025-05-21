// src/hooks/useRoadClickBinding.ts
import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";

type MapEvt = mapboxgl.MapMouseEvent & mapboxgl.EventData;

/** capas sobre las que queremos actuar */
const TARGET_LAYERS = ["roads-clickable-layer", "route-clickable-layer"];

export function useRoadClickBinding(
  map: mapboxgl.Map | null,
  onClick: (e: MapEvt) => void,
  deps: any[] = []
) {
  /* ref estable para la callback */
  const cbRef = useRef<(e: MapEvt) => void>(() => {});
  cbRef.current = onClick ?? (() => {});

  useEffect(() => {
    if (!map) return;

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
  }, [map, ...deps]);              // <- se re-crea si cambian deps
}
