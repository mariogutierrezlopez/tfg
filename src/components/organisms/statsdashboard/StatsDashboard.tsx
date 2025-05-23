// src/components/organisms/statsdashboard/StatsDashboard.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";
import { CarAgent } from "../../../logic/agents/CarAgents";
import "./StatsDashboard.css";

type AgentOption = { id: string; label: string };

const CarStatsCard: React.FC<{
  label: string;
  stats: {
    speed: number;
    lat: number;
    lng: number;
    direction: number;
    distance: number;
    time: number;
  };
}> = ({ label, stats }) => (
  <div className="car-stats-card">
    <h4>{label}</h4>
    <ul>
      <li>Vel: {stats.speed.toFixed(1)} km/h</li>
      <li>Lat: {stats.lat.toFixed(5)}</li>
      <li>Lng: {stats.lng.toFixed(5)}</li>
      <li>Dir: {stats.direction.toFixed(1)}°</li>
      <li>Dist: {stats.distance.toFixed(2)} km</li>
      <li>
        Tiempo:{" "}
        {Math.floor(stats.time / 60)
          .toString()
          .padStart(2, "0")}
        :
        {(stats.time % 60)
          .toFixed(0)
          .toString()
          .padStart(2, "0")}
      </li>
    </ul>
  </div>
);

interface Props {
  carAgents: CarAgent[];
  simulationSpeed: number;
  isPlaying: boolean;
}

const StatsDashboard: React.FC<Props> = ({
  carAgents,
  simulationSpeed,
  isPlaying,
}) => {
  if (carAgents.length === 0) {
    return (
      <div className="stats-placeholder">
        <h3>Aquí se mostrarán las estadísticas de los vehículos</h3>
        <p>Selecciona una ruta para visualizar velocidad, posición y más.</p>
      </div>
    );
  }

  const agentOptions: AgentOption[] = carAgents.map((a) => ({
    id: a.id,
    label: `Coche ${a.id}`,
  }));
  const [selected, setSelected] = useState<AgentOption[]>([]);

  // — Datos para la gráfica —
  const [chartData, setChartData] = useState<any[]>([]);
  const startedRef = useRef(false);       // ¿Ya hemos pulsado “play”?
  const simTimeRef = useRef(0);           // tiempo simulado acumulado (s)
  const lastSimRef = useRef(Date.now());  // para medir delta real

  // — Estadísticas internas —
  const prevPos = useRef(new Map<string, [number, number]>()).current;
  const lastUpdate = useRef(new Map<string, number>()).current;
  const totalDist = useRef(new Map<string, number>()).current;
  const totalTime = useRef(new Map<string, number>()).current;
  const statsMap = useRef(new Map<string, any>()).current;

  // — Efecto A: recalcula statsMap cada 200ms usando distancia/tiempo real —
  useEffect(() => {
    const intervalMs = 200;
    const FIXED_DT = 0.016;

    const iv = setInterval(() => {
      const now = Date.now();
      const dtSim = FIXED_DT * simulationSpeed;

      selected.forEach((opt) => {
        const agent = carAgents.find((a) => a.id === opt.id);
        if (!agent) return;

        const pos = agent.position;
        const prev = prevPos.get(opt.id);
        const lastTime = lastUpdate.get(opt.id) ?? now;
        const deltaTime = (now - lastTime) / 1000;

        // velocidad real (m/s → km/h)
        let speedKmh = 0;
        if (prev && isPlaying && deltaTime > 0) {
          const dMeters = distance(
            turfPoint(prev),
            turfPoint(pos),
            { units: "meters" }
          );
          speedKmh = (dMeters / deltaTime) * 3.6;
          totalDist.set(opt.id, (totalDist.get(opt.id) ?? 0) + dMeters / 1000);
        }

        // tiempo simulado acumulado
        totalTime.set(
          opt.id,
          (totalTime.get(opt.id) ?? 0) + (isPlaying ? dtSim : 0)
        );

        prevPos.set(opt.id, pos);
        lastUpdate.set(opt.id, now);

        const direction = agent.marker.getRotation();
        const distKm = totalDist.get(opt.id) ?? 0;
        const tElapsed = totalTime.get(opt.id) ?? 0;

        statsMap.set(opt.id, {
          speed: speedKmh,
          lat: pos[1],
          lng: pos[0],
          direction,
          distance: distKm,
          time: tElapsed,
        });
      });
    }, intervalMs);

    return () => clearInterval(iv);
  }, [selected, carAgents, isPlaying, simulationSpeed]);

  // — Al primer play: reiniciar todo y marcar startedRef —
  useEffect(() => {
    if (isPlaying && !startedRef.current) {
      simTimeRef.current = 0;
      lastSimRef.current = Date.now();
      setChartData([]);
      startedRef.current = true;
    }
  }, [isPlaying]);

  // — Efecto B: añade puntos solo cuando isPlaying === true —
  useEffect(() => {
    const intervalMs = 200;

    const iv = setInterval(() => {
      if (!startedRef.current) return;

      const now = Date.now();
      const delta = (now - lastSimRef.current) / 1000;

      if (isPlaying) {
        simTimeRef.current += delta;
        const elapsed = Math.floor(simTimeRef.current);

        const entry: any = { time: elapsed };
        selected.forEach((opt) => {
          const s = statsMap.get(opt.id) || { speed: 0 };
          entry[opt.id] = s.speed;
        });

        setChartData((cd) => [...cd.slice(-1000), entry]);
      }

      // Actualizamos el marcador de tiempo en cualquier caso
      lastSimRef.current = now;
    }, intervalMs);

    return () => clearInterval(iv);
  }, [selected, isPlaying]);

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

  return (
    <div className="stats-dashboard">
      {/* Selector de coches */}
      <div className="car-selector-panel">
        {agentOptions.map((opt) => {
          const isSel = selected.some((s) => s.id === opt.id);
          return (
            <div
              key={opt.id}
              className={`car-option ${isSel ? "selected" : ""}`}
              onClick={() =>
                setSelected((prev) =>
                  isSel
                    ? prev.filter((s) => s.id !== opt.id)
                    : prev.length < 4
                    ? [...prev, opt]
                    : prev
                )
              }
            >
              {opt.label}
            </div>
          );
        })}
      </div>

      {/* Tarjetas de stats */}
      <div className="stats-cards">
        {selected.map((opt) => {
          const s = statsMap.get(opt.id) || {
            speed: 0,
            lat: 0,
            lng: 0,
            direction: 0,
            distance: 0,
            time: 0,
          };
          return <CarStatsCard key={opt.id} label={opt.label} stats={s} />;
        })}
      </div>

      {/* Gráfica: visible tras el primer play y permanece al pausar */}
      {startedRef.current && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, 10]}
                tickFormatter={(sec) => `${sec}s`}
                tickCount={6}
              />
              <YAxis unit=" km/h" />
              <Tooltip labelFormatter={(sec) => `T+${sec.toFixed(1)}s`} />
              <Legend />
              {selected.map((opt, i) => (
                <Line
                  key={opt.id}
                  type="monotone"
                  dataKey={opt.id}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatsDashboard;
