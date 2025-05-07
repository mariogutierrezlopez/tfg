import React, { useState, useEffect, useRef } from "react";
import { SearchBox } from "@mapbox/search-js-react";
import './SearchForm.css';

interface Props {
  originText: string;
  destinationText: string;
  setOriginText: (text: string) => void;
  setDestinationText: (text: string) => void;
  originCoords: [number, number] | null;
  destinationCoords: [number, number] | null;
  setOriginCoords: (coords: [number, number]) => void;
  setDestinationCoords: (coords: [number, number]) => void;
  setShowGallery: (v: boolean) => void;
  handleSearchSelection: (feature: GeoJSON.Feature, isOrigin: boolean) => void;
  onCalculateRoute: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputMode: "search" | "manual" | "csv";
  setInputMode: (mode: "search" | "manual" | "csv") => void;
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
  handleSearchSelection,
  onCalculateRoute,
  onFileUpload,
  inputMode,
  setInputMode,
}) => {
  const [sessionToken] = useState(() => crypto.randomUUID());
  const activeTab = inputMode;

  const handleSwap = () => {
    setOriginText(destinationText);
    setDestinationText(originText);

    if (originCoords && destinationCoords) {
      setOriginCoords(destinationCoords);
      setDestinationCoords(originCoords);
    }
  };

  // Scroll horizontal en tabs
  const tabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tabEl = tabRef.current;
    if (!tabEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        tabEl.scrollLeft += e.deltaY;
      }
    };

    tabEl.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      tabEl.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div className="search-form-container">
      {/* Tabs */}
      <div className="tab-buttons" ref={tabRef}>
        <button
          className={`btn ${activeTab === "search" ? "btn-primary" : ""}`}
          onClick={() => setInputMode("search")}
        >
          Origen/Destino
        </button>
        <button
          className={`btn ${activeTab === "manual" ? "btn-primary" : ""}`}
          onClick={() => setInputMode("manual")}
        >
          Selección en mapa
        </button>
        <button
          className={`btn ${activeTab === "csv" ? "btn-primary" : ""}`}
          onClick={() => setInputMode("csv")}
        >
          Importar CSV
        </button>
      </div>

      {/* Tab: Búsqueda Origen/Destino */}
      {activeTab === "search" && (
        <div className="search-form-inner">
          <label className="form-label">Origen</label>
          <SearchBox
            accessToken={import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN}
            value={originText}
            options={{ sessionToken }}
            placeholder="Introduce origen"
            onChange={(e) => setOriginText(e.target.value)}
            onRetrieve={(res) => {
              const feature = res.features?.[0];
              if (feature) handleSearchSelection(feature, true);
            }}
          />

          <label className="form-label">Destino</label>
          <SearchBox
            accessToken={import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN}
            value={destinationText}
            options={{ sessionToken }}
            placeholder="Introduce destino"
            onChange={(e) => setDestinationText(e.target.value)}
            onRetrieve={(res) => {
              const feature = res.features?.[0];
              if (feature) handleSearchSelection(feature, false);
            }}
          />

          <div className="search-form-buttons">
            <button className="btn btn-outline-secondary" onClick={handleSwap}>
              Intercambiar
            </button>
          </div>
        </div>
      )}

      {/* Tab: Selección en mapa */}
      {activeTab === "manual" && (
        <div className="search-form-inner text-muted">
          <p className="mb-2">
            Selecciona punto A y B directamente en el mapa. Usa <strong>Shift + clic</strong> para seleccionar cada uno.
          </p>
          <p>
            Esta funcionalidad se implementa con listeners en el mapa (no hay inputs aquí).
          </p>
        </div>
      )}

      {/* Tab: Importar CSV */}
      {activeTab === "csv" && (
        <div className="search-form-inner">
          <label className="form-label">Importar archivo CSV</label>
          <input type="file" onChange={onFileUpload} />

          <div className="mt-3">
            <p>Puedes importar un archivo CSV o explorar la <button className="btn btn-link p-0" onClick={() => setShowGallery(true)}>galería de escenarios configurados</button> para el simulador.</p>
          </div>
        </div>
      )}


      {/* Botón de calcular ruta (oculto en modo CSV) */}
      {activeTab !== "csv" && (
        <button className="btn btn-primary mt-3 w-100" onClick={onCalculateRoute}>
          Calcular ruta
        </button>
      )}
    </div>
  );
};

export default SearchForm;
