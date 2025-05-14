/* utils/attachMeterScaling.ts
------------------------------------------------------------------
Escala un Marker HTML según sus dimensiones reales expresadas
en metros.  Funciona tanto al hacer zoom como al mover el mapa
(cambia la latitud ⇒ cambia la escala).
------------------------------------------------------------------ */

import mapboxgl from "mapbox-gl";

const EARTH_RADIUS = 6_378_137;          // semieje mayor WGS-84 (m)

/**
* @param map      instancia de Mapbox GL
* @param marker   marker que contiene el <div> del vehículo
* @param widthM   anchura real del vehículo (metros)
* @param lengthM  longitud real del vehículo (metros)
* @returns        función para desuscribirse (llámala al borrar el coche)
*/
// utils/attachMeterScaling.ts
export const attachMeterScaling = (
  map: mapboxgl.Map,
  marker: mapboxgl.Marker,
  widthM  = 1.8,
  lengthM = 4.5,
  minPx   = 32               // 👈 nuevo argumento
) => {
  const el = marker.getElement();

  const update = () => {
    const zoom = map.getZoom();
    const lat  = marker.getLngLat().lat;

    const ppm =
      (256 * 2 ** zoom) /
      (2 * Math.PI * EARTH_RADIUS * Math.cos((lat * Math.PI) / 180));

    // ⬇️  Aplicamos el “clamp” mínimo
    el.style.width  = `${Math.max(widthM  * ppm, minPx)}px`;
    el.style.height = `${Math.max(lengthM * ppm, minPx)}px`;
  };

  update();
  map.on("zoom", update);
  map.on("move", update);

  return () => {
    map.off("zoom", update);
    map.off("move", update);
  };
};
