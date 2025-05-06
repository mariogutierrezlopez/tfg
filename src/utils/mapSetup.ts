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

    map.addLayer({
      id: id,
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
  } else {
    const source = map.getSource(id) as mapboxgl.GeoJSONSource;
    source.setData(circleFeature);
  }
};
