// src/components/organisms/SecondaryCarPanel.tsx
import React, { useState } from 'react';
import SecondaryCarModal from '../secondarycarmodal/SecondaryCarModal';
import './SecondaryCarPanel.css';

export type Profile = {
  id: string;
  name: string;
  speed: number; // km/h
};

interface Props {
  onEnterMode: (profileId: string | null) => void;
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  selectedProfileId?: string | null;
}

const SecondaryCarPanel: React.FC<Props> = ({
  onEnterMode,
  profiles,
  setProfiles,
  selectedProfileId = null,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const handleNewProfile = () => {
    setEditingProfileId(null);
    setShowModal(true);
  };

  const handleSaveProfile = (name: string, speed: number) => {
    if (editingProfileId) {
      setProfiles(ps =>
        ps.map(p =>
          p.id === editingProfileId ? { ...p, name, speed } : p
        )
      );
    } else {
      const id = crypto.randomUUID();
      setProfiles(ps => [...ps, { id, name, speed }]);
      onEnterMode(id);
    }
    setShowModal(false);
  };

  return (
    <div className="secondary-panel">
      <h4 className="secondary-panel__header">Perfiles de coche</h4>
      <ul className="secondary-panel__list">
        {profiles.map(p => {
          const isSelected = p.id === selectedProfileId;
          return (
            <li
              key={p.id}
              className={`secondary-panel__item${isSelected ? ' selected' : ''}`}
              onClick={() => onEnterMode(isSelected ? null : p.id)}
            >
              <span className="secondary-panel__item-text">
                {p.name} ({p.speed} km/h)
              </span>
              <button
                className="secondary-panel__edit-btn"
                onClick={e => {
                  e.stopPropagation();
                  setEditingProfileId(p.id);
                  setShowModal(true);
                }}
              >
                ✎
              </button>
            </li>
          );
        })}
      </ul>
      <div className="secondary-panel__actions">
        <button
          className="secondary-panel__btn secondary-panel__btn-outline"
          onClick={handleNewProfile}
        >
          + Nuevo perfil
        </button>
        <button
          className="secondary-panel__btn secondary-panel__btn-primary"
          disabled={!selectedProfileId}
          onClick={() => onEnterMode(selectedProfileId!)}
        >
          Crear coche secundario
        </button>
      </div>

      {showModal && (
        <SecondaryCarModal
          isOpen={showModal}
          initialName={
            editingProfileId
              ? profiles.find(p => p.id === editingProfileId)!.name
              : ''
          }
          initialSpeed={
            editingProfileId
              ? profiles.find(p => p.id === editingProfileId)!.speed
              : 30
          }
          onClose={() => setShowModal(false)}
          onCreate={handleSaveProfile}
        />
      )}
    </div>
  );
};

export default SecondaryCarPanel;
