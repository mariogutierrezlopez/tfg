import mapboxgl from "mapbox-gl";

export function addRoadClickableLayer(map: mapboxgl.Map) {
  if (map.getLayer("roads-clickable-layer")) return;

  try {
    map.addLayer(
      {
        id: "roads-clickable-layer",
        type: "line",
        source: "composite",
        "source-layer": "road",
        layout: {},
        paint: {
          "line-color": "#888",
          "line-width": 4,
          "line-opacity": 0.2,
        },
      },
      "road-label"
    );
  } catch (e) {
    console.warn("⚠️ Error añadiendo 'roads-clickable-layer':", e);
  }
}
