// src/components/organisms/SecondaryCarModal.tsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import './SecondaryCarModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, speedKmh: number) => void;
  initialName?: string;
  initialSpeed?: number;
}

export default function SecondaryCarModal({ isOpen, onClose, onCreate, initialName='', initialSpeed=30 }: Props) {
  const [name, setName] = useState('');
  const [speed, setSpeed] = useState(30);

  if (!isOpen) return null;
  const handleSubmit = () => {
    onCreate(name.trim() || 'Secundario', speed);
  };

  return ReactDOM.createPortal(
    <div className="scm-overlay" onClick={onClose}>
      <div className="scm-content" onClick={e => e.stopPropagation()}>
        <h2>Nuevo coche secundario</h2>
        <div className="scm-field">
          <label>Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Coche A" />
        </div>
        <div className="scm-field">
          <label>Velocidad (km/h)</label>
          <input type="number" min={1} max={200} value={speed} onChange={e => setSpeed(Number(e.target.value))} />
        </div>
        <div className="scm-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Crear coche</button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
}
