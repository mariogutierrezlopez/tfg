import React from "react";
import { point, lineString } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Feature, Polygon } from "geojson";

interface Props {
  mapRef: React.RefObject<mapboxgl.Map>;
  drawRef: React.RefObject<MapboxDraw>;
  mode: "full" | "area" | null;
  setMode: (mode: "full" | "area") => void;
  onSendSelection?: (coords?: [number, number][]) => void;
}


const RouteActionsPanel: React.FC<Props> = ({
  mapRef,
  drawRef,
  mode,
  setMode,
  onSendSelection,
}) => {
  const handleSubmit = () => {
    const draw = drawRef.current;
    const map = mapRef.current;

    if (!map || !draw) return;

    if (mode === "area") {
      const data = draw.getAll();
      if (!data || data.features.length === 0) {
        alert("No hay área seleccionada.");
        return;
      }

      const areaFeature = data.features[0];
      if (areaFeature.geometry.type !== "Polygon") {
        alert("El área seleccionada no es válida.");
        return;
      }

      const polygon = areaFeature as Feature<Polygon>;
      const routeSource = map.getSource("route") as mapboxgl.GeoJSONSource;
      const routeData = routeSource?._data as GeoJSON.Feature<GeoJSON.LineString>;

      if (!routeData || routeData.geometry.type !== "LineString") return;

      const originalCoords = routeData.geometry.coordinates;
      const filteredCoords = originalCoords.filter((coord) =>
        booleanPointInPolygon(point(coord), polygon)
      );

      if (filteredCoords.length < 2) {
        alert("No hay suficientes puntos dentro del área seleccionada.");
        return;
      }

      const filteredLine = lineString(filteredCoords);

      if (map.getLayer("filtered-route")) {
        map.removeLayer("filtered-route");
        map.removeSource("filtered-route");
      }

      map.addSource("filtered-route", {
        type: "geojson",
        data: filteredLine,
      });

      map.addLayer({
        id: "filtered-route",
        type: "line",
        source: "filtered-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff0000",
          "line-width": 4,
        },
      });

      const bounds = filteredCoords.reduce(
        (b: mapboxgl.LngLatBounds, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(filteredCoords[0], filteredCoords[0])
      );

      map.fitBounds(bounds, { padding: 40 });
      onSendSelection?.(filteredCoords);
      return;
    }

    if (mode === "full") {
      onSendSelection?.();
    }
  };

  return (
    <div className="post-route-view">
      <div className="mode-buttons">
        <button
          className={`btn ${mode === "full" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => {
            setMode("full");
            drawRef.current?.deleteAll();
          }}
        >
          Vista completa
        </button>
        <button
          className={`btn ${mode === "area" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => {
            setMode("area");
            drawRef.current?.deleteAll();
          }}
        >
          Seleccionar área
        </button>
      </div>


      <button className="btn btn-success mt-2" onClick={handleSubmit}>
        Enviar selección
      </button>
    </div>
  );
};

export default RouteActionsPanel;
