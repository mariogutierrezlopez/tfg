import React, { useRef, useState, useEffect } from "react";
import * as mapboxgl from "mapbox-gl";
import "./App.css";
import SearchForm from "./components/organisms/searchform/SearchForm";
import RouteActionsPanel from "./components/organisms/routeactionpanel/RouteActionPanel";
import MapContainer from "./components/organisms/mapcontainer/MapContainer";
import useMapDraw from "./hooks/useMapDraw";
import "mapbox-gl/dist/mapbox-gl.css";
import { lineString, point as turfPoint } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line"
import CarSelectorPanel from "./components/organisms/carselectionpanel/CarSelectorPanel";
import SimulationControls from "./components/organisms/simulationcontrols/SimulationControls";
import CarListPanel from "./components/organisms/carlistpanel/CarListPanel";
import CarStatsPanel from "./components/organisms/carstatspanel/CarStatsPanel";
import { useCleanOnUnmount } from "./hooks/useCleanOnUnmount";
import { useManualPointSelection } from "./hooks/useManualPointSelection";
import { useDrawModeHandler } from "./hooks/useDrawModeHandler";
import { CarAgent } from "./logic/agents/CarAgents";
import { TrafficElement } from "./utils/types";
import carIcon from "./assets/car-top-view.png";
import truckIcon from "./assets/truck-top-view.png";
import motorcycleIcon from "./assets/motorbike-top-view.png";

import { useSimulationLoop } from "./hooks/useSimulationLoop";
import { handleMapReady, drawRoundaboutEntryZone } from "./utils/mapSetup";
import {
  createCarIcon,
  addCarMarker,
  getBearing,
} from "./utils/carUtils";
import { fetchRouteFrom } from "./utils/routeUtils";
import { resampleRoute } from "./utils/resampleRoute";


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
  const [lastBearing, setLastBearing] = useState<number | null>(null);
  const [showCarSelector, setShowCarSelector] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(0.1);
  const [showSimulationControls, setShowSimulationControls] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(simulationSpeed);
  const [selectionSent, setSelectionSent] = useState(false);
  const [trafficRules, setTrafficRules] = useState<TrafficElement[]>([]);
  const agentsRef = useRef<CarAgent[]>([]);
  const [carPendingRouteChange, setCarPendingRouteChange] = useState<string | null>(null);
  const destinationPinRef = useRef<mapboxgl.Marker | null>(null);



  //Estados para los coches
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const selectedCar = agentsRef.current.find((car) => car.id === selectedCarId);

  const defaultCar: CarOption = {
    id: "car",
    name: "Coche",
    image: carIcon,
  };

  useSimulationLoop({
    agentsRef,
    trafficRules,
    map: mapRef.current,
    isPlayingRef,
  });

  const [selectedCarType, setSelectedCarType] = useState<CarOption>(defaultCar);


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

  const handleRoadClick = async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
    const coord = [e.lngLat.lng, e.lngLat.lat] as [number, number];

    // Verifica si el clic fue dentro de un coche (hitbox 20px)
    const clickedAgent = agentsRef.current.find(agent => {
      const markerEl = agent.marker.getElement();
      const bbox = markerEl.getBoundingClientRect();
      return (
        e.originalEvent.clientX >= bbox.left &&
        e.originalEvent.clientX <= bbox.right &&
        e.originalEvent.clientY >= bbox.top &&
        e.originalEvent.clientY <= bbox.bottom
      );
    });

    if (clickedAgent) {
      setSelectedCarId(clickedAgent.id);
      return; // ⛔️ No añadas un coche nuevo
    }

    // Si estamos cambiando la ruta de un coche
    if (carPendingRouteChange != null) {
      const car = agentsRef.current.find(a => a.id === carPendingRouteChange);
      if (!car) {
        setCarPendingRouteChange(null);
        return;
      }

      const newRoute = await fetchRouteFrom(car.position, coord, mapboxToken);
      if (!newRoute) {
        setCarPendingRouteChange(null);
        return;
      }

      car.route = newRoute;
      setCarPendingRouteChange(null);

      if (destinationPinRef.current) {
        destinationPinRef.current.remove();
      }

      const el = document.createElement("div");
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.backgroundColor = "red";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 6px rgba(0,0,0,0.5)";

      const pin = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(coord)
        .addTo(mapRef.current!);

      destinationPinRef.current = pin;

      mapRef.current?.getSource("car-route-preview")?.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: newRoute,
        },
      });

      return;
    }

    // Solo se ejecuta si no se clicó en un coche ni estamos en modo cambio de ruta
    await addCarMarker(
      coord,
      mapInstance!,
      selectedCarType,
      destinationCoords,
      agentsRef,
      setSelectedCarId
    );
  };





  useEffect(() => {
    if (!mapInstance?.getLayer("roads-clickable-layer")) return;

    mapInstance.off("click", "roads-clickable-layer", handleRoadClick);
    mapInstance.on("click", "roads-clickable-layer", handleRoadClick);

    return () => {
      mapInstance?.off("click", "roads-clickable-layer", handleRoadClick);
    };
  }, [mapInstance, selectedCarType, carPendingRouteChange]); // <-- Añade esto


  const startCarAnimation = (coords?: [number, number][]) => {
    if (!selectedCarType) {
      alert("Selecciona un tipo de coche antes de continuar.");
      return;
    }

    const points = coords ?? routeData?.coordinates;
    if (!points || !mapInstance || !mapRef.current) {
      console.warn("❌ No se puede iniciar la animación: faltan datos");
      return;
    }

    console.log("✅ Iniciando animación del coche principal en", points[0]);

    setLastBearing(null);
    setShowCarSelector(true);
    setShowSimulationControls(true);
    setSelectionSent(true);

    const marker = new mapboxgl.Marker({
      element: createCarIcon(selectedCarType.image, selectedCarType.id, "main-car", () => {
        setSelectedCarId("main-car");
      }),
      rotationAlignment: "map",
      pitchAlignment: "map",
      anchor: "center",
    }).setLngLat(points[0]).addTo(mapInstance);

    const mainCar = new CarAgent("main-car", points[0], points, marker, selectedCarType);

    agentsRef.current = agentsRef.current.filter((a) => a.id !== "main-car");
    agentsRef.current.push(mainCar);

    if (mapInstance && mapInstance.getSource("route") && !mapInstance.getLayer("roads-clickable-layer")) {
      mapInstance.addLayer({
        id: "roads-clickable-layer",
        type: "line",
        source: "route",
        layout: {},
        paint: {
          "line-color": "#888888",
          "line-width": 6,
          "line-opacity": 0.6,
        },
      });
      console.log("✅ roads-clickable-layer añadido desde startCarAnimation");
    }

  };



  const handleRouteCalculation = async () => {
    if (!originCoords || !destinationCoords) {
      setRouteStatus("error");
      return;
    }

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&overview=full&steps=true&access_token=${mapboxToken}`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data.routes?.[0]?.geometry;
      if (!route || route.coordinates.length < 2) {
        setRouteStatus("error");
        return;
      }

      const steps = data.routes?.[0]?.legs?.[0]?.steps ?? [];

      const extractedRules: TrafficElement[] = steps
        .map((step, index) => {
          const loc = step.maneuver?.location;
          const type = step.maneuver?.type;
          if (!loc || !type) return null;

          if (type === "roundabout" || type === "rotary") {
            return {
              id: `roundabout-${index}`,
              type: "roundabout",
              location: loc,
              radius: 30,
              priorityRule: "must-stop",
            };
          }

          if (type === "turn" || type === "merge" || type === "fork") {
            return {
              id: `yield-${index}`,
              type: "yield",
              location: loc,
              radius: 15,
              priorityRule: "give-way",
            };
          }

          return null;
        })
        .filter((x): x is TrafficElement => x !== null);

      const resampled = resampleRoute(route.coordinates, 3); // 🆕 pasos cada 3 metros
      const resampledLine = lineString(resampled);

      // 🧠 Ajustamos las reglas a puntos de la ruta resampleada
      const adjustedRules = extractedRules.map((rule) => {
        const snapped = nearestPointOnLine(resampledLine, turfPoint(rule.location));
        return {
          ...rule,
          location: [snapped.geometry.coordinates[0], snapped.geometry.coordinates[1]],
        };
      });

      setTrafficRules(adjustedRules);
      const map = mapRef.current;
      if (!map) return;

      if (map) {
        adjustedRules.forEach((rule, i) => {
          if (rule.type === "roundabout") {
            drawRoundaboutEntryZone(map, rule, `roundabout-zone-${i}`);
          }
        });
      }




      const iconFeatures: GeoJSON.Feature[] = adjustedRules.map(rule => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: rule.location,
        },
        properties: {
          icon: rule.type === "roundabout"
            ? "roundabout-sign"
            : rule.priorityRule === "must-stop"
              ? "stop-sign"
              : "yield-sign",
        },
      }));

      if (map.getSource("traffic-icons")) {
        (map.getSource("traffic-icons") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: iconFeatures,
        });
      } else {
        map.addSource("traffic-icons", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: iconFeatures,
          },
        });

        map.addLayer({
          id: "traffic-icons-layer",
          type: "symbol",
          source: "traffic-icons",
          layout: {
            "icon-image": ["get", "icon"],
            "icon-size": 0.1,
            "icon-allow-overlap": true,
          },
        });
      }

      // 🔥 Limpia capas y fuentes previas si existen
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getLayer("roads-clickable-layer")) map.removeLayer("roads-clickable-layer");
      if (map.getSource("route")) map.removeSource("route");

      // ✅ Añade la nueva fuente de la ruta
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { ...route, coordinates: resampled },
        },
      });

      // ✅ Añade la capa visual azul (la ruta en sí)
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#007AFF", "line-width": 5 },
      });

      // ✅ Añade la capa clicable encima (gris, para detectar clicks)
      map.addLayer({
        id: "roads-clickable-layer",
        type: "line",
        source: "route",
        layout: {},
        paint: {
          "line-color": "#888888",
          "line-width": 6,
          "line-opacity": 0.6,
        },
      });

      console.log("✅ Capas 'route' y 'roads-clickable-layer' actualizadas correctamente");





      map.fitBounds([originCoords, destinationCoords], { padding: 50 });
      setRouteStatus("success");
      setShowPostRouteView(true);
      setRouteData({ ...route, coordinates: resampled });

    } catch (err) {
      console.error("Route calculation failed:", err);
      setRouteStatus("error");
    }
  };


  useCleanOnUnmount(mapInstance);
  useManualPointSelection(mapInstance, inputMode, setOriginCoords, setDestinationCoords, handleRouteCalculation);
  useDrawModeHandler(mapInstance, drawRef, mode, areaType);

  // const animateGenericCar = (
  //   coords: [number, number][],
  //   marker: mapboxgl.Marker,
  //   index: number = 0,
  //   lastAngle: number | null = null
  // ) => {
  //   if (!mapInstance || index >= coords.length - 1) return;
  //   const start = coords[index];
  //   const end = coords[index + 1];
  //   const dist = distance(turfPoint(start), turfPoint(end), { units: "meters" });
  //   const duration = (dist / carSpeedMps) * 1000 / speedRef.current;
  //   const startTime = performance.now();
  //   const angle = getBearing(start, end);
  //   const smoothed = lastAngle !== null ? lastAngle + (angle - lastAngle) * 0.2 : angle;
  //   marker.setRotation(smoothed);

  //   const animateStep = (now: number) => {
  //     if (!isPlayingRef.current) {
  //       requestAnimationFrame(animateStep);
  //       return;
  //     }
  //     const elapsed = now - startTime;
  //     const t = Math.min(elapsed / duration, 1);
  //     const lng = start[0] + (end[0] - start[0]) * t;
  //     const lat = start[1] + (end[1] - start[1]) * t;
  //     marker.setLngLat([lng, lat]);
  //     if (t < 1) {
  //       requestAnimationFrame(animateStep);
  //     } else {
  //       animateGenericCar(coords, marker, index + 1, smoothed);
  //     }
  //   };
  //   requestAnimationFrame(animateStep);
  // };


  const handleSearchSelection = (feature: GeoJSON.Feature, isOrigin: boolean) => {
    const coords = feature.geometry?.type === "Point" ? feature.geometry.coordinates : null;
    if (!coords) return;
    isOrigin ? setOriginCoords(coords as [number, number]) : setDestinationCoords(coords as [number, number]);
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer onMapReady={(map) => handleMapReady(map, setMapInstance, mapRef)} />


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
                onRequestRouteChange={(carId) => {
                  setCarPendingRouteChange(carId);
                  alert("Haz clic en el mapa para elegir un nuevo destino para el coche.");
                }}
              />

            )}

            <CarListPanel
              cars={agentsRef.current}
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
