// src/components/ExportModal.tsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import './ExportModal.css';

type Criterion = 'meters' | 'seconds';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (criterion: Criterion, interval: number) => void;
}

const intervals = [1, 2, 5, 10, 25, 50, 100];

export function ExportModal({ isOpen, onClose, onConfirm }: Props) {
  const [criterion, setCriterion] = useState<Criterion>('meters');
  const [interval, setInterval] = useState<number>(50);

  if (!isOpen) return null;
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={stopPropagation}>
        <div className="modal-header">
          <h2>Exportar telemetría</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <fieldset>
          <legend>Criterio</legend>
          <label className="inline-flex">
            <input
              type="radio"
              name="criterion"
              value="meters"
              checked={criterion === 'meters'}
              onChange={() => setCriterion('meters')}
            />
            Metros
          </label>
          <label className="inline-flex">
            <input
              type="radio"
              name="criterion"
              value="seconds"
              checked={criterion === 'seconds'}
              onChange={() => setCriterion('seconds')}
            />
            Segundos
          </label>
        </fieldset>

        <div className="mb-6">
          <label className="block mb-1">
            Intervalo ({criterion === 'meters' ? 'm' : 's'})
          </label>
          <select
            value={interval}
            onChange={e => setInterval(Number(e.target.value))}
          >
            {intervals.map(i => (
              <option key={i} value={i}>
                Cada {i}
              </option>
            ))}
          </select>
        </div>

        <div className="flex">
          <button onClick={onClose} className="btn-cancel">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(criterion, interval)}
            className="btn-export"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
}
