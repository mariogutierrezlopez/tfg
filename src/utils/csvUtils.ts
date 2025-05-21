import { CarAgent } from "../logic/agents/CarAgents";
import { carOptions } from "../constants/carOptions";
import Papa from "papaparse";
import mapboxgl from "mapbox-gl";
import { telemetry, TelemetryRow } from "./telemetryStore";

export function exportCarsToCsv(cars: CarAgent[]): void {
  const csvContent = [
    [
      "id",
      "type",
      "longitude",
      "latitude",
      "speed",
      "maxSpeed",
      "targetSpeed",
      "route",
      "stepSpeeds",
    ],
    ...cars.map((car) => [
      car.id,
      car.carType.id,
      car.position[0],
      car.position[1],
      car.speed,
      car.maxSpeed,
      car.targetSpeed,
      `"${JSON.stringify(car.route).replace(/"/g, '""')}"`,
      `"${JSON.stringify(car.stepSpeeds).replace(/"/g, '""')}"`,
    ]),
  ]
    .map((row) => row.join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "escenario.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function importCarsFromCsv(
  file: File,
  map: mapboxgl.Map,
  callback: (cars: CarAgent[]) => void
): void {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const parsedCars = (results.data as any[])
        .map((data) => {
          const carType = carOptions.find((c) => c.id === data.type);
          if (!carType) {
            console.warn(`Tipo de coche desconocido: ${data.type}`);
            return null;
          }

          const el = document.createElement("div");
          el.className = "vehicle-marker";
          el.style.width = "32px";
          el.style.height = "32px";
          el.style.backgroundImage = `url(${carType.image})`;
          el.style.backgroundSize = "contain";
          el.style.backgroundRepeat = "no-repeat";
          el.style.backgroundPosition = "center";
          el.title = data.id;

          const marker = new mapboxgl.Marker(el)
            .setLngLat([parseFloat(data.longitude), parseFloat(data.latitude)])
            .addTo(map);

          let route: [number, number][] = [];
          try {
            route = data.route ? JSON.parse(data.route) : [];
          } catch (e) {
            console.warn(`Ruta malformada para el coche ${data.id}`, e);
          }

          let stepSpeeds: number[] = [];
          try {
            stepSpeeds = data.stepSpeeds ? JSON.parse(data.stepSpeeds) : [];
          } catch (e) {
            console.warn(`stepSpeeds malformado para el coche ${data.id}`, e);
          }

          const agent = new CarAgent(
            data.id,
            [parseFloat(data.longitude), parseFloat(data.latitude)],
            route,
            marker,
            carType,
            stepSpeeds
          );

          agent.speed = parseFloat(data.speed);
          agent.maxSpeed = parseFloat(data.maxSpeed);
          agent.targetSpeed = parseFloat(data.targetSpeed);

          return agent;
        })
        .filter(Boolean) as CarAgent[];

      if (parsedCars.length > 0) {
        map.flyTo({ center: parsedCars[0].position, zoom: 17 });
      }

      callback(parsedCars);
    },
  });
}

/** Convierte toda la telemetría acumulada a CSV y lanza la descarga */
export function exportTelemetryToCsv() {
  const header =
    "carId,timestampUTC,lat,lng,speedKmh,directionDeg,distanceKm,simTimeSec\n";

  /* aplanamos las filas de todos los coches */
  const rows: TelemetryRow[] = Object.values(telemetry).flat();

  /* orden opcional por tiempo */
  rows.sort((a, b) => a.ts - b.ts);

  const csv = header +
    rows
      .map(r =>
        [
          r.id,
          new Date(r.ts).toISOString(),
          r.lat.toFixed(6),
          r.lng.toFixed(6),
          r.speedKmh.toFixed(2),
          r.direction.toFixed(1),
          r.distance.toFixed(3),
          r.simTime.toFixed(1),
        ].join(",")
      )
      .join("\n");

  /* descarga */
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `telemetry-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}