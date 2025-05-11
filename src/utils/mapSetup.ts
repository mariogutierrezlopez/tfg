import * as mapboxgl from "mapbox-gl";
import { TrafficElement } from "../utils/types";

export const drawRoundaboutEntryZone = (
  map: mapboxgl.Map,
  roundabout: TrafficElement,
  id: string
) => {
  const circleFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: roundabout.location,
    },
    properties: {},
  };

  const radiusMeters = roundabout.radius + 15;

  if (!map.getSource(id)) {
    map.addSource(id, {
      type: "geojson",
      data: circleFeature,
    });

    // Capa circular para mostrar área de influencia
    map.addLayer({
      id: `${id}-circle`,
      type: "circle",
      source: id,
      paint: {
        "circle-radius": {
          stops: [
            [0, 0],
            [20, radiusMeters],
          ],
          base: 2,
        },
        "circle-color": "#FF0000",
        "circle-opacity": 0.25,
      },
    });

    // Añade una capa simbólica (icono) para señal visual explícita
    map.addLayer({
      id: `${id}-icon`,
      type: "symbol",
      source: id,
      layout: {
        "icon-image": "roundabout-sign", // asegúrate que este icono esté cargado previamente
        "icon-size": 0.3,
        "icon-allow-overlap": true,
      },
    });
  } else {
    const source = map.getSource(id) as mapboxgl.GeoJSONSource;
    source.setData(circleFeature);
  }
};

