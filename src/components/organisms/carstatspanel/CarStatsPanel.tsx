import React, { useEffect, useState } from "react";
import "./CarStatsPanel.css";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";
import { CarAgent } from "../../../logic/agents/CarAgents";

type Props = {
  car: CarAgent;
  carSpeedMps: number;
  simulationSpeed: number;
  isPlaying: boolean;
  onClose: () => void;
  onRequestRouteChange: (carId: string) => void;
};

const formatTime = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const CarStatsPanel: React.FC<Props> = ({ car, carSpeedMps, simulationSpeed, isPlaying, onClose, onRequestRouteChange }) => {

  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedTime, setAccumulatedTime] = useState(0); // en ms
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [direction, setDirection] = useState(0);
  const [distanceTravelled, setDistanceTravelled] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const pos = car.position;
      const rotation = car.marker.getRotation(); // seguimos usando el marker para el ángulo
      setLat(pos[1]);
      setLng(pos[0]);
      setDirection(rotation);

      if (car.route.length > 1) {
        const start = turfPoint(car.route[0]);
        const current = turfPoint(pos);
        const dist = distance(start, current, { units: "kilometers" });
        setDistanceTravelled(dist);
      }

      // control del tiempo
      if (isPlaying) {
        setStartTime((prev) => prev ?? Date.now());
      } else if (startTime) {
        const now = Date.now();
        const delta = now - startTime;

        setAccumulatedTime((prev) => prev + delta * simulationSpeed);
        setStartTime(null);
      }

    }, 200);

    return () => clearInterval(interval);
  }, [car, isPlaying]);

  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    const updateElapsed = () => {
      if (startTime) {
        const now = Date.now();
        const delta = now - startTime;
        setTimeElapsed((accumulatedTime + delta * simulationSpeed) / 1000);
      } else {
        setTimeElapsed(accumulatedTime / 1000);
      }
    };

    const t = setInterval(updateElapsed, 300);
    return () => clearInterval(t);
  }, [startTime, accumulatedTime]);

  return (
    <div className="car-stats-panel">
      <div className="car-id">Coche</div>
      <button className="close-btn" onClick={onClose}>x</button>
      <button className="change-route-btn" onClick={() => onRequestRouteChange(car.id)}>
        Cambiar ruta
      </button>
      <ul>
        <li><strong>Velocidad:</strong> {(carSpeedMps * simulationSpeed * 3.6).toFixed(1)} km/h</li>
        <li><strong>Latitud:</strong> {lat.toFixed(5)}</li>
        <li><strong>Longitud:</strong> {lng.toFixed(5)}</li>
        <li><strong>Dirección:</strong> {direction.toFixed(1)}°</li>
        <li><strong>Distancia:</strong> {distanceTravelled.toFixed(2)} km</li>
        <li><strong>Tiempo en ruta:</strong> {formatTime(timeElapsed)}</li>
      </ul>
    </div>
  );
};

export default CarStatsPanel;
