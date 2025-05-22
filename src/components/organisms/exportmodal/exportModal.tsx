// src/components/ExportModal.tsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import './ExportModal.css'; // importa ahí el CSS de arriba

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

        <fieldset className="mb-4">
          <legend className="font-medium mb-2">Criterio</legend>
          <label className="inline-flex items-center mr-4">
            <input
              type="radio"
              name="criterion"
              value="meters"
              checked={criterion === 'meters'}
              onChange={() => setCriterion('meters')}
              className="mr-1"
            />
            Metros
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="criterion"
              value="seconds"
              checked={criterion === 'seconds'}
              onChange={() => setCriterion('seconds')}
              className="mr-1"
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
            className="w-full border rounded px-2 py-1"
          >
            {intervals.map(i => (
              <option key={i} value={i}>
                Cada {i}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(criterion, interval)}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 primary-button"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
}
