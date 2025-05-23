import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./MapContainer.css";

const mapboxToken = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN;

interface MapContainerProps {
  onMapReady?: (map: mapboxgl.Map) => void;
}

const MapContainer: React.FC<MapContainerProps> = ({ onMapReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-3.7038, 40.4168],
      zoom: 13,
    });

    // guardamos referencia
    mapRef.current = map;

    // callback al iniciar
    onMapReady?.(map);

    map.on("style.load", () => {
      const style = map.getStyle();
      if (!style?.layers) return;
      style.layers.forEach((layer) => {
        if (layer.type === "symbol" && layer.layout?.["text-field"]) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      });
    });

    return () => {
      // desmontaje protegido
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          console.warn("⚠️ Error al desmontar el mapa:", err);
        }
        mapRef.current = null;
      }
    };
  }, [onMapReady]);

  return (
    <div
      ref={containerRef}
      id="map-container"
      className="map-container"
      style={{ height: "100%", width: "100%" }}
    />
  );
};

export default MapContainer;
