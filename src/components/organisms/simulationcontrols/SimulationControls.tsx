import React from "react";
import {
  FaPlay,
  FaPause,
  FaAngleRight,   // 1x
  FaForward,      // 2x
  FaFastForward,  // 4x
} from "react-icons/fa";
import "./SimulationControls.css";

type Props = {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  speed: 1 | 2 | 4;        // 💡 declara sólo los valores válidos
  onSpeedChange: () => void;
};

const SimulationControls: React.FC<Props> = ({
  isPlaying,
  onPlay,
  onPause,
  speed,
  onSpeedChange,
}) => {
  /* Devuelve el icono según la velocidad actual */
  const renderSpeedIcon = () => {
    switch (speed) {
      case 1:
        return <FaAngleRight className="control-icon" />;
      case 2:
        return <FaForward className="control-icon" />;
      case 4:
        return <FaFastForward className="control-icon" />;
      default:
        return <FaAngleRight className="control-icon" />;
    }
  };

  return (
    <div className="simulation-controls">
      {/* ▶︎ / ⏸ */}
      <button
        className="control-button"
        onClick={isPlaying ? onPause : onPlay}
      >
        {isPlaying
          ? <FaPause className="control-icon" />
          : <FaPlay  className="control-icon" />}
      </button>

      {/* Velocidad 1× → 2× → 4× → 1× ... */}
      <button
        className="control-button"
        onClick={onSpeedChange}
        aria-label={`Velocidad ${speed}x`}
      >
        {renderSpeedIcon()}
      </button>
    </div>
  );
};

export default SimulationControls;
