import React, { useRef, useState, useEffect } from "react";
import * as mapboxgl from "mapbox-gl";
import "./App.css";
import SearchForm from "./components/organisms/searchform/SearchForm";
import RouteActionsPanel from "./components/organisms/routeactionpanel/RouteActionPanel";
import MapContainer from "./components/organisms/mapcontainer/MapContainer";
import useMapDraw from "./hooks/useMapDraw";
import carIcon from "./assets/car-top-view.png";
import "mapbox-gl/dist/mapbox-gl.css";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";

//Hooks
import { useCleanOnUnmount } from "./hooks/useCleanOnUnmount";
import { useManualPointSelection } from "./hooks/useManualPointSelection";
import { useDrawModeHandler } from "./hooks/useDrawModeHandler"

const mapboxToken = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN;

const App: React.FC = () => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const drawRef = useMapDraw(mapInstance);
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [showPostRouteView, setShowPostRouteView] = useState(false);
  const [mode, setMode] = useState<"full" | "area" | null>(null);
  const [areaType, setAreaType] = useState<"square" | "polygon" | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<any | null>(null);
  const [carMarker, setCarMarker] = useState<mapboxgl.Marker | null>(null);
  const [lastBearing, setLastBearing] = useState<number | null>(null);


  const [inputMode, setInputMode] = useState<"search" | "manual" | "csv">("search");


  const carSpeedMps = 10; // ✅ Velocidad en metros por segundo


  const handleRouteCalculation = async () => {
    if (!originCoords || !destinationCoords) {
      setRouteStatus("error");
      return;
    }

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data.routes?.[0]?.geometry;

      if (!route || route.coordinates.length < 2) {
        setRouteStatus("error");
        return;
      }

      const map = mapRef.current;
      if (!map) return;

      if (map.getSource("route")) {
        if (map.getLayer("route")) map.removeLayer("route");
        map.removeSource("route");
      }

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: route },
      });

      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#007AFF", "line-width": 5 },
      });

      map.fitBounds([originCoords, destinationCoords], { padding: 50 });
      setRouteStatus("success");
      setShowPostRouteView(true);
      setRouteData(route);
    } catch (err) {
      setRouteStatus("error");
    }
  };
  
  //Hooks
  useCleanOnUnmount(mapInstance);

  useManualPointSelection(
    mapInstance,
    inputMode,
    setOriginCoords,
    setDestinationCoords,
    handleRouteCalculation
  );

  useDrawModeHandler(mapInstance, drawRef, mode, areaType);

  

  const createCarIcon = () => {
    const el = document.createElement("div");
    el.style.width = "36px";
    el.style.height = "60px";
    el.style.backgroundImage = `url(${carIcon})`;
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.zIndex = "1000";
    el.style.transformOrigin = "center center";
    return el;
  };

  const getBearing = (from: [number, number], to: [number, number]) => {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;
    return Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
  };

  const animateCar = (
    coords: [number, number][],
    index: number = 0,
    marker: mapboxgl.Marker
  ) => {
    if (!mapInstance || index >= coords.length - 1) return;

    const start = coords[index];
    const end = coords[index + 1];
    const dist = distance(turfPoint(start), turfPoint(end), {
      units: "meters",
    });
    const duration = (dist / carSpeedMps) * 1000;

    const startTime = performance.now();
    const angle = getBearing(start, end);
    const smoothedBearing =
      lastBearing !== null ? lastBearing + (angle - lastBearing) * 0.2 : angle;

    marker.setRotation(smoothedBearing);
    setLastBearing(smoothedBearing);

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      const lng = start[0] + (end[0] - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;

      marker.setLngLat([lng, lat]);

      if (t < 1) {
        requestAnimationFrame(animateStep);
      } else {
        animateCar(coords, index + 1, marker); // ✅ avanzar correctamente
      }
    };

    requestAnimationFrame(animateStep);
  };

  const startCarAnimation = (coords?: [number, number][]) => {
    setLastBearing(null);
    const points = coords ?? routeData?.coordinates;
    if (!points || !mapInstance || !mapRef.current) return;
    if (mapRef.current !== mapInstance) return;

    carMarker?.remove();

    const marker = new mapboxgl.Marker({
      element: createCarIcon(),
      rotationAlignment: "map",
      pitchAlignment: "map",
    })
      .setLngLat(points[0])
      .addTo(mapInstance);

    setCarMarker(marker);
    animateCar(points, 0, marker);
  };



  const handleSearchSelection = (
    feature: GeoJSON.Feature,
    isOrigin: boolean
  ) => {
    const coords =
      feature.geometry?.type === "Point" ? feature.geometry.coordinates : null;
    if (!coords) return;

    isOrigin
      ? setOriginCoords(coords as [number, number])
      : setDestinationCoords(coords as [number, number]);
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer mapRef={mapRef} onMapReady={setMapInstance} />
      <SearchForm
        originText={originText}
        destinationText={destinationText}
        setOriginText={setOriginText}
        setDestinationText={setDestinationText}
        originCoords={originCoords}
        destinationCoords={destinationCoords}
        setOriginCoords={setOriginCoords}
        setDestinationCoords={setDestinationCoords}
        handleSearchSelection={handleSearchSelection}
        onCalculateRoute={handleRouteCalculation}
        onFileUpload={(e) => console.log("Archivo CSV:", e.target.files?.[0])}
        inputMode={inputMode}
        setInputMode={setInputMode}
      />

      {showPostRouteView && (
        <RouteActionsPanel
          mapRef={mapRef}
          drawRef={drawRef}
          mode={mode}
          setMode={setMode}
          areaType={areaType}
          setAreaType={setAreaType}
          onSendSelection={startCarAnimation}
        />
      )}

      {routeStatus && (
        <div
          className={`alert alert-${
            routeStatus === "success" ? "success" : "danger"
          } alert-dismissible fade show`}
          role="alert"
        >
          {routeStatus === "success"
            ? "Ruta calculada con éxito"
            : "Error al calcular la ruta"}
          <button
            type="button"
            className="custom-close-button"
            aria-label="Cerrar"
            onClick={() => setRouteStatus(null)}
          >
            x
          </button>
          <div className="progress-bar-timer" />
        </div>
      )}
    </div>
  );
};

export default App;
