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
  areaType: "square" | "polygon" | null;
  setAreaType: (type: "square" | "polygon" | null) => void;
  onSendSelection?: (coords?: [number, number][]) => void; // 🆕 acepta coords opcionales
}

const RouteActionsPanel: React.FC<Props> = ({
  mapRef,
  drawRef,
  mode,
  setMode,
  areaType,
  setAreaType,
  onSendSelection,
}) => {
  const handleSubmit = () => {
    const draw = drawRef.current;
    const map = mapRef.current;
    const data = draw?.getAll();

    if (!map) return;

    if (mode === "area") {
      if (!data || !Array.isArray(data.features) || data.features.length === 0) return;

      const polygon = data.features[0] as Feature<Polygon>;
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

      const firstCoord = filteredCoords[0] as [number, number];
      map.fitBounds(
        filteredCoords.reduce(
          (bounds: mapboxgl.LngLatBounds, coord) =>
            bounds.extend(coord as [number, number]),
          new mapboxgl.LngLatBounds(firstCoord, firstCoord)
        ),
        { padding: 40 }
      );

      console.log("✂️ Ruta filtrada:", filteredCoords);
      onSendSelection?.(filteredCoords); // ✅ pasa coords filtradas
      return;
    }

    if (mode === "full") {
      console.log("➡️ Ruta completa seleccionada");
      onSendSelection?.(); // ✅ animación con ruta completa
    }
  };

  return (
    <div className="post-route-view">
      <div className="mode-buttons">
        <button
          className={`btn ${mode === "full" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => {
            setMode("full");
            setAreaType(null);
            drawRef.current?.deleteAll();
          }}
        >
          Vista completa
        </button>
        <button
          className={`btn ${mode === "area" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setMode("area")}
        >
          Seleccionar área
        </button>
      </div>

      {mode === "area" && (
        <div className="area-options">
          <button
            className={`btn ${areaType === "square" ? "btn-secondary" : "btn-outline-secondary"}`}
            onClick={() => setAreaType("square")}
          >
            Área cuadrada
          </button>
          <button
            className={`btn ${areaType === "polygon" ? "btn-secondary" : "btn-outline-secondary"}`}
            onClick={() => setAreaType("polygon")}
          >
            Área con pluma
          </button>
        </div>
      )}

      <button className="btn btn-success mt-2" onClick={handleSubmit}>
        Enviar selección
      </button>
    </div>
  );
};

export default RouteActionsPanel;
