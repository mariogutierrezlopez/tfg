// src/components/SearchForm.tsx
import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { SearchBox } from "@mapbox/search-js-react";
import { useRules } from "../../../context/rulesContext";  // ← tu contexto
import "./SearchForm.css";
import InputField from "../../atoms/inputfield/InputField";

interface Props {
  originText: string;
  destinationText: string;
  setOriginText: (text: string) => void;
  setDestinationText: (text: string) => void;
  originCoords: [number, number] | null;
  destinationCoords: [number, number] | null;
  setOriginCoords: (coords: [number, number]) => void;
  setDestinationCoords: (coords: [number, number]) => void;
  setShowGallery: (b: boolean) => void;
  handleSearchSelection: (feature: GeoJSON.Feature, isOrigin: boolean) => void;
  onCalculateRoute: () => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  inputMode: "search" | "manual" | "csv";
  setInputMode: (mode: "search" | "manual" | "csv") => void;
  mapRef: React.RefObject<mapboxgl.Map>;
}

const SearchForm: React.FC<Props> = ({
  originText,
  destinationText,
  setOriginText,
  setDestinationText,
  originCoords,
  destinationCoords,
  setOriginCoords,
  setDestinationCoords,
  setShowGallery,
  handleSearchSelection,
  onCalculateRoute,
  onFileUpload,
  inputMode,
  setInputMode,
  mapRef,
}) => {
  const { setTree } = useRules();              // ← sacamos setTree del contexto
  const [rulesLoaded, setRulesLoaded] = useState(false);

  const [sessionToken] = useState(() => crypto.randomUUID());
  const tabRef = useRef<HTMLDivElement>(null);
  const canCalculate = !!originCoords && !!destinationCoords;

  // scroll en las tabs
  useEffect(() => {
    const tabEl = tabRef.current;
    if (!tabEl) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        tabEl.scrollLeft += e.deltaY;
      }
    };
    tabEl.addEventListener("wheel", handler, { passive: false });
    return () => tabEl.removeEventListener("wheel", handler);
  }, []);


  /** ------- Funciones para poder arrastrar un archivo al input y reconocer las reglas -------- */
  const parseRulesFile = async (file: File) => {
    try {
      const text = await file.text();
      console.log("JSON text loaded:", text);
      const parsed = JSON.parse(text);
      console.log("Parsed JSON object:", parsed);
      setTree(parsed);
      console.log("setTree called with parsed rules.");
      setRulesLoaded(true);
    } catch (err) {
      console.error("Error al parsear JSON de reglas:", err);
      alert("El JSON de reglas no es válido.");
    }
  };

  const handleRulesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseRulesFile(file);
  };

  const handleRulesDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) parseRulesFile(file);
  };

  /** ------- FUnciones buscador en modo manual -------- */

  const [manualQuery, setManualQuery] = useState("");
  const [manualFeature, setManualFeature] = useState<GeoJSON.Feature | null>(null);

  // al pulsar buscar, centramos
  const handleManualSearch = () => {
    if (!manualFeature || !mapRef.current) return;
    const [lng, lat] = manualFeature.geometry.coordinates as [number, number];
    mapRef.current.flyTo({ center: [lng, lat], zoom: 15 });
  };


  /** ----------- Return ------------ */

  return (
    <div className="search-form-container">
      {!rulesLoaded ? (
        <div className="rules-upload-container"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleRulesDrop}>
          <h2>Carga tus reglas de decisión</h2>
          <p>Antes de poder elegir origen/destino o modo CSV, sube tu JSON de reglas.</p>

          {/* envolvemos el input en un label estilo botón */}
          <label htmlFor="rules-file" className="upload-btn">
            <span>Subir JSON de reglas</span>
          </label>
          <input
            id="rules-file"
            type="file"
            accept=".json"
            onChange={handleRulesFile}
          />
        </div>
      ) : (
        <>
          {/* ─── PESTAÑAS ─── */}
          <div className="tab-buttons" ref={tabRef}>
            <button
              className={`tab-btn ${inputMode === "search" ? "tab-btn--active" : ""}`}
              onClick={() => setInputMode("search")}
            >
              Origen/Destino
            </button>
            <button
              className={`tab-btn ${inputMode === "manual" ? "tab-btn--active" : ""}`}
              onClick={() => setInputMode("manual")}
            >
              Selección en mapa
            </button>
            <button
              className={`tab-btn ${inputMode === "csv" ? "tab-btn--active" : ""}`}
              onClick={() => setInputMode("csv")}
            >
              Importar CSV
            </button>
          </div>

          {/* ─── MODO SEARCH ─── */}
          {inputMode === "search" && (
            <div className="search-form-inner">
              <label className="form-label">Origen</label>
              <SearchBox
                accessToken={import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN}
                value={originText}
                options={{ sessionToken }}
                placeholder="Introduce origen"
                onChange={e => setOriginText(e.target.value)}
                onRetrieve={res => {
                  const f = res.features?.[0];
                  if (f) handleSearchSelection(f, true);
                }}
              />

              <label className="form-label">Destino</label>
              <SearchBox
                accessToken={import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN}
                value={destinationText}
                options={{ sessionToken }}
                placeholder="Introduce destino"
                onChange={e => setDestinationText(e.target.value)}
                onRetrieve={res => {
                  const f = res.features?.[0];
                  if (f) handleSearchSelection(f, false);
                }}
              />
            </div>
          )}

          {inputMode === "manual" && (
            <div className="search-form-inner">
              <div className="manual-search-row">
                <InputField
                  value={manualQuery}
                  onChange={setManualQuery}
                  onRetrieve={(feat) => {
                    setManualFeature(feat);
                  }}
                  placeholder="Busca una zona..."
                />
                <button
                  className="btn btn-outline-secondary manual-search-btn"
                  onClick={handleManualSearch}
                  disabled={!manualFeature}
                >
                  Buscar zona
                </button>
              </div>
              <p className="manual-instruction">
                Ahora clic en el mapa para elegir origen y destino.
              </p>
            </div>
          )}


          {/* ─── MODO CSV ─── */}
          {inputMode === "csv" && (
            <div className="search-form-inner">
              <label className="form-label">
                Importar CSV
                <input type="file" onChange={onFileUpload} />
              </label>
              <div className="csv-import-container mt-3">
                <p className="mb-0 d-inline">
                  O explora la{" "}
                  <button
                    className="btn btn-link p-0 d-inline"
                    onClick={() => setShowGallery(true)}
                  >
                    galería de escenarios
                  </button>.
                </p>
              </div>
            </div>
          )}

          {/* ─── BOTÓN CALCULAR ─── */}
          {inputMode !== "csv" && (
            <button
              className="btn btn-primary mt-3 w-100"
              onClick={() => onCalculateRoute()}
              disabled={!canCalculate}
              title={!canCalculate ? "Debes seleccionar origen y destino" : undefined}
            >
              Calcular ruta
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default SearchForm;
