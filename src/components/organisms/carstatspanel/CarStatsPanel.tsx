import React, { useEffect, useRef, useState } from "react";
import "./CarStatsPanel.css";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";
import { CarAgent } from "../../../logic/agents/CarAgents";
import mapboxgl from "mapbox-gl";
import { FaTimes } from "react-icons/fa";

type Props = {
  car: CarAgent;
  simulationSpeed: number;
  isPlaying: boolean;
  onClose: () => void;
  onRequestRouteChange: (carId: string) => void;
  onDelete: (carId: string) => void;
  mapRef: React.RefObject<mapboxgl.Map>;
};

const formatTime = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const CarStatsPanel: React.FC<Props> = ({
  car,
  simulationSpeed,
  isPlaying,
  onClose,
  onRequestRouteChange,
  onDelete,
  mapRef,
}) => {
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [direction, setDirection] = useState(0);
  const [realSpeed, setRealSpeed] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [keepCentered, setKeepCentered] = useState(false);

  const prevPos = useRef<[number, number] | null>(null);
  const lastUpdate = useRef<number>(Date.now());
  const totalTime = useRef<number>(0);
  const ticking = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    ticking.current = setInterval(() => {
      const now = Date.now();
      const pos = car.position;
      const rot = car.marker.getRotation();

      setLat(pos[1]);
      setLng(pos[0]);
      setDirection(rot);

      // Velocidad real y distancia acumulada
      // Velocidad real y distancia acumulada
      if (prevPos.current) {
        const distMeters = distance(
          turfPoint(prevPos.current),
          turfPoint(pos),
          { units: "meters" }
        );

        const deltaTime = (now - lastUpdate.current) / 1000;

        /* 👉 solo actualizamos la velocidad si la simulación está en marcha */
        if (isPlaying && deltaTime > 0) {
          const speedMps = distMeters / deltaTime;
          setRealSpeed(speedMps * 3.6); // km/h
        }

        /* la distancia total solo debe aumentar cuando el coche avanza */
        if (isPlaying) {
          setTotalDistance((prev) => prev + distMeters / 1000); // km
        }
      }

      prevPos.current = pos;
      lastUpdate.current = now;

      // Tiempo total
      if (isPlaying) {
        totalTime.current += 0.2 * simulationSpeed; // cada 200ms * speed
        setTimeElapsed(totalTime.current);
      }

      // Centrado automático
      if (keepCentered && mapRef.current) {
        mapRef.current.flyTo({
          center: pos,
          zoom: 20,
          speed: 0.5,
          duration: 500,
          essential: true,
        });
      }
    }, 200);

    return () => {
      if (ticking.current) clearInterval(ticking.current);
    };
  }, [car, simulationSpeed, isPlaying, keepCentered]);
  // console.log("StepSpeeds:", car.stepSpeeds);
  return (
    <div className="car-stats-panel">
      {/* ===== Cabecera ===== */}
      <div className="car-stats-header">
        <div className="car-id">Coche {car.id}</div>
        <button className="close-btn" onClick={onClose}>
          <FaTimes size={12} />
        </button>
      </div>

      {/* ===== Lista ===== */}
      <ul>
        <li>
          <strong>Velocidad:</strong> {realSpeed.toFixed(1)} km/h
        </li>
        <li>
          <strong>Latitud:</strong> {lat.toFixed(5)}
        </li>
        <li>
          <strong>Longitud:</strong> {lng.toFixed(5)}
        </li>
        <li>
          <strong>Dirección:</strong> {direction.toFixed(1)}°
        </li>
        <li>
          <strong>Distancia:</strong> {totalDistance.toFixed(2)} km
        </li>
        <li>
          <strong>Tiempo en ruta:</strong> {formatTime(timeElapsed)}
        </li>
        {car.stepSpeeds && car.stepSpeeds.length > 0 && (
          <li>
            <strong>Límite de velocidad:</strong>{" "}
            {(() => {
              const remaining = car.route.length + 1;
              const idx = Math.max(0, car.stepSpeeds.length - remaining);
              const limitKmh = car.stepSpeeds[idx] * 3.6; // m/s a km/h
              const diff = realSpeed - limitKmh;
              const status =
                diff > 3 ? "🚨 Exceso" : diff < -5 ? "↘ Bajo" : "✅ Ok";
              return `${limitKmh.toFixed(0)} km/h (${status})`;
            })()}
          </li>
        )}
      </ul>

      {/* ===== Botón de ruta ===== */}
      <button
        className="panel-btn"
        onClick={() => onRequestRouteChange(car.id)}
      >
        Cambiar ruta
      </button>

      <button
        className={`panel-btn ${keepCentered ? "panel-btn--primary" : ""}`}
        onClick={() => setKeepCentered((prev) => !prev)}
      >
        {keepCentered ? "Centrado ON" : "Centrar vehículo"}
      </button>

      {car.id !== "main-car" && (
        <button
          className="panel-btn panel-btn--danger"
          onClick={() => onDelete(car.id)}
        >
          Eliminar vehículo
        </button>
      )}
    </div>
  );
};

export default CarStatsPanel;
