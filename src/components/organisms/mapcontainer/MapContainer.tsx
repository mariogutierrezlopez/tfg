import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

const mapboxToken = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN;

interface MapContainerProps {
  onMapReady?: (map: mapboxgl.Map) => void;
}

const MapContainer: React.FC<MapContainerProps> = ({ onMapReady }) => {
  const localRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: localRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-3.7038, 40.4168],
      zoom: 13,
    });

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
      map.remove();
    };
  }, []);

  return <div id="map-container" ref={localRef} style={{ height: "100vh", width: "100vw" }} />;
};

export default MapContainer;
