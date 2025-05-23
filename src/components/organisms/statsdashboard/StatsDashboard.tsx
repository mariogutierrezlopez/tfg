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
  // Si no hay agentes, mostramos placeholder
  if (carAgents.length === 0) {
    return (
      <div
        className="stats-placeholder"
      >
        <h3>Aquí se mostrarán las estadísticas de los vehículos</h3>
        <p>Selecciona una ruta para visualizar velocidad, posición y más.</p>
      </div>
    );
  }

  // 1) Opciones de selector
  const agentOptions: AgentOption[] = carAgents.map((a) => ({
    id: a.id,
    label: `Coche ${a.id}`,
  }));
  const [selected, setSelected] = useState<AgentOption[]>([]);

  // 2) Datos de la gráfica
  const [chartData, setChartData] = useState<any[]>([]);
  const firstTs = useRef<number | null>(null);

  // 3) Estados para calcular stats
  const prevPos = useRef(new Map<string, [number, number]>()).current;
  const lastTs = useRef(new Map<string, number>()).current;
  const totalDist = useRef(new Map<string, number>()).current;
  const totalTime = useRef(new Map<string, number>()).current;
  const statsMap = useRef(new Map<string, any>()).current;

  // Efecto A: cada 200ms recalculamos la estadística y rellenamos statsMap
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();

      selected.forEach((opt) => {
        const agent = carAgents.find((a) => a.id === opt.id);
        if (!agent) return;

        const pos = agent.position;
        const prev = prevPos.get(opt.id);
        const last = lastTs.get(opt.id) ?? now;
        const dt = (now - last) / 1000;

        let speedKmh = 0;
        if (prev && isPlaying && dt > 0) {
          const dMeters = distance(
            turfPoint(prev),
            turfPoint(pos),
            { units: "meters" }
          );
          speedKmh = (dMeters / dt) * 3.6;

          // acumulamos distancia (km)
          const accDist = (totalDist.get(opt.id) ?? 0) + dMeters / 1000;
          totalDist.set(opt.id, accDist);

          // acumulamos tiempo real
          const accTime = (totalTime.get(opt.id) ?? 0) + 0.2 * simulationSpeed;
          totalTime.set(opt.id, accTime);
        }

        prevPos.set(opt.id, pos);
        lastTs.set(opt.id, now);

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
    }, 200);

    return () => clearInterval(iv);
  }, [selected, carAgents, isPlaying, simulationSpeed]);

  // Efecto B: cada 200ms añadimos punto a chartData solo si isPlaying
  useEffect(() => {
    const iv = setInterval(() => {
      if (!isPlaying) return;

      const now = Date.now();
      if (firstTs.current === null) firstTs.current = now;

      const entry: any = { time: now };
      selected.forEach((opt) => {
        const s = statsMap.get(opt.id) || { speed: 0 };
        entry[opt.id] = s.speed;
      });

      setChartData((cd) => [...cd.slice(-1000), entry]);
    }, 200);

    return () => clearInterval(iv);
  }, [selected, isPlaying, simulationSpeed]);

  // Ventana últimos 10s
  const times = chartData.map((d) => d.time);
  const maxTime = times.length ? Math.max(...times) : Date.now();
  const minTime = maxTime - 10_000;

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

  return (
    <div className="stats-dashboard">
      {/* Selector */}
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

      {/* Tarjetas */}
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

      {/* Gráfica últimos 10s */}
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
              domain={[minTime, maxTime]}
              tickFormatter={(ts) =>
                `${Math.floor((ts - (firstTs.current || 0)) / 1000)}s`
              }
              tickCount={6}
            />
            <YAxis unit=" km/h" />
            <Tooltip
              labelFormatter={(ts) =>
                `T+${((ts - (firstTs.current || 0)) / 1000).toFixed(1)}s`
              }
            />
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
    </div>
  );
};

export default StatsDashboard;
