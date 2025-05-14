import React, { useRef, useState, useEffect } from "react";
import * as mapboxgl from "mapbox-gl";
import SearchForm from "../components/organisms/searchform/SearchForm";
import RouteActionsPanel from "../components/organisms/routeactionpanel/RouteActionPanel";
import MapContainer from "../components/organisms/mapcontainer/MapContainer";
import useMapDraw from "../hooks/useMapDraw";
import "mapbox-gl/dist/mapbox-gl.css";
import CarSelectorPanel from "../components/organisms/carselectionpanel/CarSelectorPanel";
import SimulationControls from "../components/organisms/simulationcontrols/SimulationControls";
import CarListPanel from "../components/organisms/carlistpanel/CarListPanel";
import CarStatsPanel from "../components/organisms/carstatspanel/CarStatsPanel";
import { useCleanOnUnmount } from "../hooks/useCleanOnUnmount";
import { useManualPointSelection } from "../hooks/useManualPointSelection";
import { useDrawModeHandler } from "../hooks/useDrawModeHandler";
import { CarAgent } from "../logic/agents/CarAgents";
import { TrafficElement } from "../utils/types";
import { useSimulationLoop } from "../hooks/useSimulationLoop";
import { useMapInitialization } from "../hooks/useMapInitialization";
import { useCarManager } from "../hooks/useCarManager";
import { carOptions } from "../constants/carOptions";
import { CarOption } from "../utils/types";
import { useRouteCalculation } from "../hooks/useRouteCalculation";
import { useSearchSelection } from "../hooks/useSearchSelection";
import { useRoadClickBinding } from "../hooks/useRoadClickBinding";
import { importCarsFromCsv, exportCarsToCsv } from "../utils/csvUtils";
import ScenarioGalleryModal from "../components/organisms/scenariogallerymodal/ScenarioGalleryModal";
import { drawMainCarRoute } from "../utils/mapUtils";
import { addRoadClickableLayer } from "../utils/mapLayers";
import { FaFileCsv } from "react-icons/fa";

const mapboxToken = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN;

const SimulatorApp: React.FC = () => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const drawRef = useMapDraw(mapInstance);
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(
    null
  );
  const [destinationCoords, setDestinationCoords] = useState<
    [number, number] | null
  >(null);
  const [showPostRouteView, setShowPostRouteView] = useState(false);
  const [mode, setMode] = useState<"full" | "area" | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<any | null>(null);
  const [showCarSelector, setShowCarSelector] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showSimulationControls, setShowSimulationControls] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(simulationSpeed);
  const [selectionSent, setSelectionSent] = useState(false);
  const [trafficRules, setTrafficRules] = useState<TrafficElement[]>([]);
  const agentsRef = useRef<CarAgent[]>([]);
  const [carPendingRouteChange, setCarPendingRouteChange] = useState<
    string | null
  >(null);
  const destinationPinRef = useRef<mapboxgl.Marker | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  //Estados para los coches
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const selectedCar = agentsRef.current.find((car) => car.id === selectedCarId);

  useSimulationLoop({
    agentsRef,
    trafficRules,
    map: mapRef.current,
    isPlayingRef,
    speedRef,
  });

  const [selectedCarType, setSelectedCarType] = useState<CarOption>(
    carOptions[0]
  );

  const { handleRouteCalculation } = useRouteCalculation({
    originCoords,
    destinationCoords,
    setRouteStatus,
    setTrafficRules,
    setRouteData,
    setShowPostRouteView,
    mapRef,
    token: mapboxToken,
  });

  const { startCarAnimation, handleRoadClick } = useCarManager(
    mapInstance,
    mapRef,
    agentsRef,
    selectedCarType,
    destinationCoords,
    setSelectedCarId,
    setShowCarSelector,
    setShowSimulationControls,
    setSelectionSent,
    setCarPendingRouteChange,
    carPendingRouteChange,
    destinationPinRef,
    mapboxToken,
    routeData,
    handleRouteCalculation,
    setTrafficRules
  );

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    speedRef.current = simulationSpeed;
  }, [simulationSpeed]);

  const [inputMode, setInputMode] = useState<"search" | "manual" | "csv">(
    "search"
  );
  const carSpeedMps = 10;

  useRoadClickBinding(mapInstance, handleRoadClick, [
    selectedCarType,
    carPendingRouteChange,
  ]);

  useCleanOnUnmount(mapInstance);
  useManualPointSelection(
    mapInstance,
    inputMode,
    setOriginCoords,
    setDestinationCoords,
    handleRouteCalculation
  );
  useDrawModeHandler(mapInstance, drawRef, mode);

  const handleSearchSelection = useSearchSelection(
    setOriginCoords,
    setDestinationCoords
  );
  const { onMapReady } = useMapInitialization(setMapInstance, mapRef);


  const deleteCar = (carId: string) => {
    const car = agentsRef.current.find(c => c.id === carId);
    if (!car) return;
  
    /* 1 — Quitar marcador */
    car.marker.remove();
    agentsRef.current = agentsRef.current.filter(c => c.id !== carId);
  
    /* 2 — Eliminar capa y fuente de la ruta, si existen */
    const map = mapRef.current;
    if (map) {
      const layerId  = `${carId}-route`;
      const sourceId = `${carId}-route`;
  
      if (map.getLayer(layerId))  map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  
    /* 3 — Cerrar panel si era el seleccionado */
    if (selectedCarId === carId) setSelectedCarId(null);
  };
  

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer onMapReady={onMapReady} />

      {showGallery && (
        <ScenarioGalleryModal
          onClose={() => setShowGallery(false)}
          onSelectScenario={(csvPath) => {
            fetch(csvPath)
              .then((res) => res.blob())
              .then((blob) => {
                const file = new File([blob], "scenario.csv", {
                  type: "text/csv",
                });
                if (mapRef.current) {
                  importCarsFromCsv(file, mapRef.current, (cars) => {
                    agentsRef.current = cars;

                    const mainCar = cars.find((c) => c.id === "main-car");
                    if (mainCar && mainCar.route.length > 1) {
                      drawMainCarRoute(mapRef.current!, mainCar.route);
                    }

                    addRoadClickableLayer(mapRef.current!);

                    setShowSimulationControls(true);
                    setShowCarSelector(true);
                    setSelectionSent(true);
                    setShowGallery(false);
                  });
                }
              });
          }}
        />
      )}

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
          setShowGallery={setShowGallery}
          handleSearchSelection={handleSearchSelection}
          onCalculateRoute={handleRouteCalculation}
          onFileUpload={(e) => {
            const file = e.target.files?.[0];
            if (file && mapRef.current) {
              importCarsFromCsv(file, mapRef.current, (cars) => {
                agentsRef.current = cars;

                const mainCar = cars.find((c) => c.id === "main-car");
                if (mainCar && mainCar.route.length > 1) {
                  drawMainCarRoute(mapRef.current, mainCar.route);
                }

                setShowSimulationControls(true);
                setShowCarSelector(true);
                setSelectionSent(true);
              });
            }
          }}
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

      {showSimulationControls && (
        <>
          <SimulationControls
            isPlaying={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            speed={simulationSpeed}
            onSpeedChange={() =>
              setSimulationSpeed((prev) => (prev === 4 ? 1 : prev * 2))
            }
          />

          <div
            style={{
              position: "absolute",
              top: 100,
              right: 20,
              display: "flex",
              flexDirection: "row",
              gap: "16px",
              zIndex: 1001,
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
                  alert(
                    "Haz clic en el mapa para elegir un nuevo destino para el coche."
                  );
                }}
                onDelete={deleteCar}
                mapRef={mapRef}
              />
            )}

            <CarListPanel
              cars={agentsRef.current}
              selectedCarId={selectedCarId}
              onSelect={setSelectedCarId}
            />

            <button
              className="export-btn"
              onClick={() => exportCarsToCsv(agentsRef.current)}
              title="Exportar a CSV"
            >
              <FaFileCsv className="export-icon" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SimulatorApp;
