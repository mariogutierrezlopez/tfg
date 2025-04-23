import React, { useRef, useState, useEffect } from "react";
import * as mapboxgl from "mapbox-gl";
import "./App.css";
import SearchForm from "./components/organisms/searchform/SearchForm";
import RouteActionsPanel from "./components/organisms/routeactionpanel/RouteActionPanel";
import MapContainer from "./components/organisms/mapcontainer/MapContainer";
import useMapDraw from "./hooks/useMapDraw";
import "mapbox-gl/dist/mapbox-gl.css";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";
import CarSelectorPanel from "./components/organisms/carselectionpanel/CarSelectorPanel";
import SimulationControls from "./components/organisms/simulationcontrols/SimulationControls";
import CarListPanel from "./components/organisms/carlistpanel/CarListPanel";
import CarStatsPanel from "./components/organisms/carstatspanel/CarStatsPanel";


import { useCleanOnUnmount } from "./hooks/useCleanOnUnmount";
import { useManualPointSelection } from "./hooks/useManualPointSelection";
import { useDrawModeHandler } from "./hooks/useDrawModeHandler";

import carIcon from "./assets/car-top-view.png";
import truckIcon from "./assets/truck-top-view.png";
import motorcycleIcon from "./assets/motorbike-top-view.png";

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
  const [allCars, setAllCars] = useState<CustomCar[]>([]);
  const [lastBearing, setLastBearing] = useState<number | null>(null);
  const [selectedCarType, setSelectedCarType] = useState<CarOption | null>(null);
  const [showCarSelector, setShowCarSelector] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showSimulationControls, setShowSimulationControls] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(simulationSpeed);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const selectedCar = allCars.find((car) => car.id === selectedCarId);
  const [selectionSent, setSelectionSent] = useState(false);



  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = simulationSpeed; }, [simulationSpeed]);

  type CustomCar = {
    id: string;
    type: CarOption;
    position: [number, number];
    marker: mapboxgl.Marker;
    route: [number, number][];
  };

  type CarOption = {
    id: string;
    name: string;
    image: string;
  };

  const carOptions = [
    { id: "car", name: "Coche", image: carIcon },
    { id: "truck", name: "Camión", image: truckIcon },
    { id: "motorcycle", name: "Moto", image: motorcycleIcon },
  ];


  const [inputMode, setInputMode] = useState<"search" | "manual" | "csv">("search");
  const carSpeedMps = 10;

  const handleRoadClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
    if (!e.lngLat) return;
    const coord = [e.lngLat.lng, e.lngLat.lat] as [number, number];
    addCarMarker(coord);
  };

  useEffect(() => {
    if (!mapInstance?.getLayer("roads-clickable-layer")) return;
    mapInstance.off("click", "roads-clickable-layer", handleRoadClick);
    mapInstance.on("click", "roads-clickable-layer", handleRoadClick);
    return () => {
      mapInstance?.off("click", "roads-clickable-layer", handleRoadClick);
    };
  }, [mapInstance, selectedCarType]);

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

  useCleanOnUnmount(mapInstance);
  useManualPointSelection(mapInstance, inputMode, setOriginCoords, setDestinationCoords, handleRouteCalculation);
  useDrawModeHandler(mapInstance, drawRef, mode, areaType);

  const createCarIcon = (imageUrl?: string, typeId?: string) => {

    const el = document.createElement("div");

    let width = "36px";
    let height = "60px";

    if (typeId === "truck") {
      width = "80px";
      height = "60px";
    } else if (typeId === "motorcycle") {
      width = "20px";
      height = "40px";
    }

    el.style.width = width;
    el.style.height = height;
    el.style.backgroundImage = `url(${imageUrl ?? carIcon})`;
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.transformOrigin = "center center";
    el.style.position = "absolute";
    el.style.top = "0";
    el.style.left = "0";

    return el;
  };


  const getBearing = (from: [number, number], to: [number, number]) => {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;
    return Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
  };

  const fetchRouteFrom = async (from: [number, number], to: [number, number]): Promise<[number, number][] | null> => {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.routes?.[0]?.geometry?.coordinates ?? null;
  };

  const animateGenericCar = (
    coords: [number, number][],
    marker: mapboxgl.Marker,
    index: number = 0,
    lastAngle: number | null = null
  ) => {
    if (!mapInstance || index >= coords.length - 1) return;
    const start = coords[index];
    const end = coords[index + 1];
    const dist = distance(turfPoint(start), turfPoint(end), { units: "meters" });
    const duration = (dist / carSpeedMps) * 1000 / speedRef.current;
    const startTime = performance.now();
    const angle = getBearing(start, end);
    const smoothed = lastAngle !== null ? lastAngle + (angle - lastAngle) * 0.2 : angle;
    marker.setRotation(smoothed);

    const animateStep = (now: number) => {
      if (!isPlayingRef.current) {
        requestAnimationFrame(animateStep);
        return;
      }
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const lng = start[0] + (end[0] - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;
      marker.setLngLat([lng, lat]);
      if (t < 1) {
        requestAnimationFrame(animateStep);
      } else {
        animateGenericCar(coords, marker, index + 1, smoothed);
      }
    };
    requestAnimationFrame(animateStep);
  };

  const addCarMarker = async (coord: [number, number]) => {
    if (!mapInstance || !selectedCarType) return;
    const fallbackDest: [number, number] = [coord[0] + 0.01, coord[1] + 0.01];
    const destination = destinationCoords ?? fallbackDest;
    const route = await fetchRouteFrom(coord, destination);
    if (!route) return;
    const marker = new mapboxgl.Marker({
      element: createCarIcon(selectedCarType.image, selectedCarType.id),
      rotationAlignment: "map",
      pitchAlignment: "map",
      anchor: "center",
    }).setLngLat(coord).addTo(mapInstance);

    const carObject: CustomCar = {
      id: crypto.randomUUID(),
      type: selectedCarType,
      position: coord,
      marker,
      route,
    };

    setAllCars((prev) => [...prev, carObject]);
    animateGenericCar(route, marker);
  };

  const startCarAnimation = (coords?: [number, number][]) => {
    setLastBearing(null);
    setShowCarSelector(true);
    setShowSimulationControls(true);
    setSelectionSent(true);
    const points = coords ?? routeData?.coordinates;
    if (!points || !mapInstance || !mapRef.current) return;
    if (mapRef.current !== mapInstance) return;

    if (!mapInstance.getLayer("roads-layer")) {
      if (mapInstance.getSource("composite")) {
        mapInstance.addLayer({
          id: "roads-layer",
          type: "line",
          source: "composite",
          "source-layer": "road",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#AAAAAA", "line-width": 1.5 },
        });
        mapInstance.addLayer({
          id: "roads-clickable-layer",
          type: "line",
          source: "composite",
          "source-layer": "road",
          layout: {},
          paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 20 },
        });
      }
    }

    const marker = new mapboxgl.Marker({
      element: createCarIcon(selectedCarType?.image, selectedCarType?.id),
      rotationAlignment: "map",
      pitchAlignment: "map",
    }).setLngLat(points[0]).addTo(mapInstance);

    const mainCar: CustomCar = {
      id: "main-car",
      type: selectedCarType ?? { id: "car", name: "Coche Principal", image: carIcon },
      position: points[0],
      marker,
      route: points,
    };


    setAllCars((prev) => [...prev.filter((c) => c.id !== "main-car"), mainCar]);
    animateGenericCar(points, marker);
  };

  const handleSearchSelection = (feature: GeoJSON.Feature, isOrigin: boolean) => {
    const coords = feature.geometry?.type === "Point" ? feature.geometry.coordinates : null;
    if (!coords) return;
    isOrigin ? setOriginCoords(coords as [number, number]) : setDestinationCoords(coords as [number, number]);
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer mapRef={mapRef} onMapReady={setMapInstance} />
      {!selectionSent && (
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
      )}


      {showPostRouteView && !selectionSent && (
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


      {showCarSelector && (
        <CarSelectorPanel
          carOptions={carOptions}
          selectedCar={selectedCarType}
          onSelectCar={setSelectedCarType}
        />
      )}

      {routeStatus && (
        <div className={`alert alert-${routeStatus === "success" ? "success" : "danger"} alert-dismissible fade show`} role="alert">
          {routeStatus === "success" ? "Ruta calculada con éxito" : "Error al calcular la ruta"}
          <button type="button" className="custom-close-button" aria-label="Cerrar" onClick={() => setRouteStatus(null)}>
            x
          </button>
          <div className="progress-bar-timer" />
        </div>
      )}

      {showSimulationControls && (
        <>
          <SimulationControls
            isPlaying={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            speed={simulationSpeed}
            onSpeedChange={() => setSimulationSpeed((prev) => (prev === 4 ? 1 : prev * 2))}
          />

          <div
            style={{
              position: "absolute",
              top: 100,
              right: 20,
              display: "flex",
              flexDirection: "row",
              gap: "16px",
              zIndex: 1001
            }}
          >
            {selectedCar && (
              <CarStatsPanel
                car={selectedCar}
                carSpeedMps={carSpeedMps}
                simulationSpeed={simulationSpeed}
                isPlaying={isPlaying}
                onClose={() => setSelectedCarId(null)}
              />
            )}

            <CarListPanel
              cars={allCars}
              selectedCarId={selectedCarId}
              onSelect={setSelectedCarId}
            />
          </div>


        </>
      )}


    </div>
  );
};

export default App;
