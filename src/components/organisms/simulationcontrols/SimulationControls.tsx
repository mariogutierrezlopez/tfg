import React from "react";
import "./SimulationControls.css";

type Props = {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  speed: number;
  onSpeedChange: () => void;
};

const SimulationControls: React.FC<Props> = ({
  isPlaying,
  onPlay,
  onPause,
  speed,
  onSpeedChange,
}) => {
  return (
    <div className="simulation-controls">
      <button onClick={isPlaying ? onPause : onPlay}>
        {isPlaying ? "Pausa" : "Reproducir"}
      </button>
      <button onClick={onSpeedChange}>
        Velocidad: {speed}x
      </button>
    </div>
  );
};

export default SimulationControls;
