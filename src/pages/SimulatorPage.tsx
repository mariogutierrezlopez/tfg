import React, { useRef, useState, useEffect } from "react";
import * as mapboxgl from "mapbox-gl";
import SearchForm from "../components/organisms/searchform/SearchForm";
import RouteActionsPanel from "../components/organisms/routeactionpanel/RouteActionPanel";
import MapContainer from "../components/organisms/mapcontainer/MapContainer";
import useMapDraw from "../hooks/useMapDraw";
import "mapbox-gl/dist/mapbox-gl.css";
import CarSelectorPanel from "../components/organisms/carselectionpanel/CarSelectorPanel";
import SimulationControls from "../components/organisms/simulationcontrols/SimulationControls";
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
import { importScenarioFromCsv, exportScenarioToCsv } from "../utils/csvUtils";
import ScenarioGalleryModal from "../components/organisms/scenariogallerymodal/ScenarioGalleryModal";
import { drawCarRoute } from "../utils/mapUtils";
import { addRoadClickableLayer } from "../utils/mapLayers";
import { FaFileCsv, FaChartLine } from "react-icons/fa";
import { exportTelemetryToCsv, setExportConfig } from "../utils/csvUtils";
import { ExportModal } from "../components/organisms/exportmodal/ExportModal";
import StatsDashboard from "../components/organisms/statsdashboard/StatsDashboard";
import "./SimulationPage.css";
import { spawnSecondaryCar } from "../utils/carUtils"; // o la función que uses para spawnear
import SecondaryCarPanel, { Profile } from "../components/organisms/secondarycarpanel/SecondaryCarPanel";


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

  //Modal para exportar telemetría
  const [showModal, setShowModal] = useState(false);

  // Nuevo estado para el panel de secundarios
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const selectedCar = agentsRef.current.find((car) => car.id === selectedCarId);

  const [rulesError, setRulesError] = useState<string | null>(null);



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

  const { spawnMainCar, handleRoadClick: baseHandleRoadClick } = useCarManager(
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
    if (rulesError) {
      const timer = setTimeout(() => setRulesError(null), 5000); // El mensaje dura 5 segundos
      return () => clearTimeout(timer);
    }
  }, [rulesError]);

  // estados para creación de coche secundario
  const [secondaryOrigin, setSecondaryOrigin] = useState<[number, number] | null>(null);
  const [secondaryDestination, setSecondaryDestination] = useState<[number, number] | null>(null);
  const secondaryOriginMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const secondaryDestinationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // En tu SimulationPage.tsx

  const handleRoadClick = async (
    e: mapboxgl.MapMouseEvent & mapboxgl.EventData
  ) => {
    const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    if (selectedProfileId) {
      // 1) primer clic: origen
      if (!secondaryOrigin) {
        setSecondaryOrigin(coord);
        if (mapInstance) {
          // crear marcador de origen
          secondaryOriginMarkerRef.current = new mapboxgl.Marker({ color: 'green' })
            .setLngLat(coord)
            .addTo(mapInstance);

          // auto-eliminar en 5s
          setTimeout(() => {
            secondaryOriginMarkerRef.current?.remove();
            secondaryOriginMarkerRef.current = null;
          }, 5000);
        }
        return;
      }

      // 2) segundo clic: destino + spawn secundario
      if (!secondaryDestination) {
        setSecondaryDestination(coord);
        if (mapInstance) {
          // crear marcador de destino
          secondaryDestinationMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
            .setLngLat(coord)
            .addTo(mapInstance);

          // auto-eliminar en 5s
          setTimeout(() => {
            secondaryDestinationMarkerRef.current?.remove();
            secondaryDestinationMarkerRef.current = null;
          }, 5000);
        }

        const profile = profiles.find(p => p.id === selectedProfileId)!;
        await spawnSecondaryCar(
          mapInstance!,
          agentsRef,
          secondaryOrigin,
          coord,
          profile.speed,
          `sec-${selectedProfileId}-${Date.now()}`,
          trafficRules
        );

        // limpiamos estado de selección (los refs ya se limpiarán tras 5 s)
        setSecondaryOrigin(null);
        setSecondaryDestination(null);
        setSelectedProfileId(null);
        return;
      }
    }

    // en modo normal delegamos a coche principal si procede
    await baseHandleRoadClick(e);
  };

  useEffect(() => {
    if (mapInstance) {
        const getCoordsOnClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            console.log(`COORDS_CENTRO_MANUAL: [${lng}, ${lat}]`);
            // Para facilitar copiar y pegar, puedes incluso hacer esto:
            // console.log(`MANUAL_CENTER_LON: ${lng},`);
            // console.log(`MANUAL_CENTER_LAT: ${lat},`);
        };

        mapInstance.on('click', getCoordsOnClick);
        console.log("Listener de clic añadido al mapa para obtener coordenadas. Haz clic en el centro de la rotonda.");

        // Es importante limpiar el listener cuando el componente se desmonte o mapInstance cambie
        return () => {
            mapInstance.off('click', getCoordsOnClick);
            console.log("Listener de clic eliminado del mapa.");
        };
    }
}, [mapInstance]); // Este useEffect se ejecutará cuando mapInstance esté disponible



  // atar listener para creación de coches secundarios
  useRoadClickBinding(
    mapInstance,
    handleRoadClick,
    [selectedProfileId, secondaryOrigin, secondaryDestination],
    mode
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

  // binding para el coche principal: usa baseHandleRoadClick en lugar de handleRoadClick
  useRoadClickBinding(
    mapInstance,
    baseHandleRoadClick,
    [selectedCarType, carPendingRouteChange],
    mode
  );

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


  // const deleteCar = (carId: string) => {
  //   const car = agentsRef.current.find(c => c.id === carId);
  //   if (!car) return;

  //   /* 1 — Quitar marcador */
  //   car.marker.remove();
  //   agentsRef.current = agentsRef.current.filter(c => c.id !== carId);

  //   /* 2 — Eliminar capa y fuente de la ruta, si existen */
  //   const map = mapRef.current;
  //   if (map) {
  //     const layerId = `${carId}-route`;
  //     const sourceId = `${carId}-route`;

  //     if (map.getLayer(layerId)) map.removeLayer(layerId);
  //     if (map.getSource(sourceId)) map.removeSource(sourceId);
  //   }

  //   /* 3 — Cerrar panel si era el seleccionado */
  //   if (selectedCarId === carId) setSelectedCarId(null);
  // };


  return (
    <div className="simulator-layout">
      {/* 60%: simulador + overlays */}
      <div className="simulator-pane">
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
                    importScenarioFromCsv(file, mapRef.current, (cars, rules) => {
                      agentsRef.current = cars;
                      setTrafficRules(rules);              // ← guarda las reglas

                      const mainCar = cars.find(c => c.id === "main-car");
                      if (mainCar && mainCar.route.length > 1) {
                        drawCarRoute(mapRef.current!, mainCar.id, mainCar.route);
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
                importScenarioFromCsv(file, mapRef.current, (cars, rules) => {
                  agentsRef.current = cars;
                  setTrafficRules(rules);

                  const mainCar = cars.find((c) => c.id === "main-car");
                  if (mainCar && mainCar.route.length > 1) {
                    drawCarRoute(mapRef.current!, mainCar.id, mainCar.route);
                  }

                  setShowSimulationControls(true);
                  setShowCarSelector(true);
                  setSelectionSent(true);
                });
              }
            }}
            inputMode={inputMode}
            setInputMode={setInputMode}
            mapRef={mapRef}
            onRulesInvalid={(message) => setRulesError(message)}
          />
        )}

        {showPostRouteView && !selectionSent && (
          <RouteActionsPanel
            mapRef={mapRef}
            drawRef={drawRef}
            mode={mode}
            setMode={setMode}
            onSendSelection={() => { void spawnMainCar(); }}
          />
        )}

        {rulesError && (
          <div
            className="alert alert-danger alert-dismissible fade show"
            role="alert"
          >
            {rulesError}
            <button
              type="button"
              className="custom-close-button"
              aria-label="Cerrar"
              onClick={() => setRulesError(null)}
            >
              x
            </button>
            <div className="progress-bar-timer" />
          </div>
        )}

        {routeStatus && (
          <div
            className={`alert alert-${routeStatus === "success" ? "success" : "danger"
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

            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1001 }}>
              <SecondaryCarPanel
                selectedProfileId={selectedProfileId}
                onEnterMode={pid => {
                  setSelectedProfileId(pid);
                  setSecondaryOrigin(null);
                  setSecondaryDestination(null);
                }}
                profiles={profiles}
                setProfiles={setProfiles}
              />
            </div>

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
              
              <button
                className="export-btn"
                onClick={() => exportScenarioToCsv(agentsRef.current, trafficRules)}
                title="Exportar a CSV"
              >
                <FaFileCsv className="export-icon" />
              </button>
              <button
                className="export-btn"
                onClick={() => { setShowModal(true) }}
                title="Descargar telemetría CSV"
              >
                <FaChartLine className="export-icon" />
              </button>

              <ExportModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onConfirm={(criterion, interval) => {
                  setExportConfig({ criterion, interval });
                  exportTelemetryToCsv();
                  setShowModal(false);
                }} />
            </div>
          </>
        )}
      </div>



      {/* 40%: dashboard de estadísticas */}
      <div className="stats-pane">
        <StatsDashboard
          carAgents={agentsRef.current}
          simulationSpeed={simulationSpeed}
          isPlaying={isPlaying}
        />
      </div>
    </div>
  );
};

export default SimulatorApp;
