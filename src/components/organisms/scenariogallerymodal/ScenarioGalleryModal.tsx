import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./ScenarioGalleryModal.css";

interface Props {
  onClose: () => void;
  onSelectScenario: (csv: string) => void;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  csv: string;
}

const ScenarioGalleryModal: React.FC<Props> = ({ onClose, onSelectScenario }) => {
  const [showForm, setShowForm] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const res = await fetch("/scenarios/index.json");
        const defaultScenarios = await res.json();
        const customScenarios = JSON.parse(localStorage.getItem("customScenarios") || "[]");
        setScenarios([...defaultScenarios, ...customScenarios]);
      } catch {
        setScenarios([]);
      }
    };
    loadScenarios();
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const description = (form.elements.namedItem("description") as HTMLInputElement).value;
    const csvFile = (form.elements.namedItem("csv") as HTMLInputElement).files?.[0];
    if (!csvFile) return;

    const toBase64 = (file: File) =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

    const csvData = await toBase64(csvFile);

    const newScenario: Scenario = {
      id: `custom-${Date.now()}`,
      title,
      description,
      csv: csvData,
    };

    const current = JSON.parse(localStorage.getItem("customScenarios") || "[]");
    localStorage.setItem("customScenarios", JSON.stringify([...current, newScenario]));

    setScenarios((prev) => [...prev, newScenario]);
    setShowForm(false);
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content">
        {/* ───── Cabecera ───── */}
        <div className="modal-header">
          <h2>{showForm ? "Nuevo escenario" : "Galería de escenarios"}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
  
        {/* ───── Formulario o galería según estado ───── */}
        {showForm ? (
          <form className="scenario-form" onSubmit={handleFormSubmit}>
            <div className="form-group">
              <label>Título</label>
              <input name="title" type="text" required />
            </div>
  
            <div className="form-group">
              <label>Descripción</label>
              <input name="description" type="text" required />
            </div>
  
            <div className="form-group">
              <label>Archivo CSV</label>
              <input name="csv" type="file" accept=".csv" required />
            </div>
  
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Guardar escenario
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="scenario-grid">
            {/* Tarjeta para crear nuevo */}
            <div
              className="scenario-card add-card"
              onClick={() => setShowForm(true)}
            >
              <div className="add-icon">＋</div>
              <p>Crear nuevo escenario</p>
            </div>
  
            {/* Tarjetas de escenarios existentes */}
            {scenarios.map((s) => (
              <div key={s.id} className="scenario-card">
                <h4>{s.title}</h4>
                <p className="scenario-desc">{s.description}</p>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onSelectScenario(s.csv)}
                >
                  Cargar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.getElementById("modal-root")!
  );
  
};

export default ScenarioGalleryModal;
