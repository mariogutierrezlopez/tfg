/*  utils/carUtils.ts  */
/*  ———————————————————————————————————————————————————————————————— */
/*  Cambios aplicados:                                                   */
/*   • Escalado físico en metros con attachMeterScaling                  */
/*   • Uso de vehicleSizes { wPx, hPx, wM, lM }                          */
/*   • El marker se coloca siempre en el 1er punto real de la ruta       */
/*  ———————————————————————————————————————————————————————————————— */

import * as mapboxgl          from "mapbox-gl";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */


/**
 * drawMainCarRoute
 * @param map 
 * @param route 
 */
export function drawMainCarRoute(
  map: mapboxgl.Map,
  route: [number, number][]
) {
  if (map.getLayer("main-car-route")) map.removeLayer("main-car-route");
  if (map.getSource("main-car-route")) map.removeSource("main-car-route");

  map.addSource("main-car-route", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: route,
      },
      properties: {},
    },
  });

  map.addLayer({
    id: "main-car-route",
    type: "line",
    source: "main-car-route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.8 },
  });
}