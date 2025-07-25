import { CarAgent } from "../logic/agents/CarAgents";
import { carOptions } from "../constants/carOptions";
import Papa from "papaparse";
import mapboxgl from "mapbox-gl";
import { TrafficElement } from "./types";
import { TreeNode } from "./decisionTree";
import { drawRoundaboutEntryZone } from "./mapSetup";
import { rawTelemetry, TelemetryRow } from './telemetryStore';

// --- SECCIÓN DE IMPORTACIÓN Y EXPORTACIÓN DE ESCENARIOS ---

const csvSafe = (val: string) => `"${val.replace(/"/g, '""')}"`;

export function exportScenarioToCsv(cars: CarAgent[], rules: TrafficElement[]) {
  const carRows = cars.map(c => {
    const fullOriginalRoute = [c.initialPosition, ...c.originalRoute];
    
    return [
      c.id, "car", c.carType.id,
      c.initialPosition[0],
      c.initialPosition[1],
      0,
      c.maxSpeed,
      c.targetSpeed,
      csvSafe(JSON.stringify(fullOriginalRoute)),
      csvSafe(JSON.stringify(c.stepSpeeds)),
      "", "", "", "",
      c.creationTime
    ];
  });

  const ruleRows = rules.map(r => [
    r.id, "rule", "",
    "", "", "", "", "",
    "", "",
    r.type,
    csvSafe(JSON.stringify(r.location)),
    r.radius ?? "",
    r.priorityRule ?? "",
    ""
  ]);

  const header = [
    "id","type","subtype","longitude","latitude","speed","maxSpeed",
    "targetSpeed","route","stepSpeeds",
    "ruleType","loc","radius","priority",
    "creationTime"
  ];

  const csv = [header, ...carRows, ...ruleRows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "scenario.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}


export function importScenarioFromCsv(
  file      : File,
  map       : mapboxgl.Map,
  callback  : (cars: CarAgent[], rules: TrafficElement[]) => void,
  decisionTree: TreeNode | null
){
  Papa.parse(file, {
    header        : true,
    skipEmptyLines: true,

    complete: (res) => {
      const cars : CarAgent[] = [];
      const rules: TrafficElement[] = [];

      (res.data as any[]).forEach(row => {
        if (row.type === "car"){
          const carType = carOptions.find(c => c.id === row.subtype || row.type);
          if (!carType) { console.warn("Tipo coche desconocido", row.subtype); return; }

          const el = document.createElement("div");
          el.style.cssText = `width:32px;height:32px;background:url(${carType.image}) center/contain no-repeat;`;

          const marker = new mapboxgl.Marker(el)
            .setLngLat([ +row.longitude, +row.latitude ])
            .addTo(map);

          let route: [number,number][] = [];
          let speeds: number[] = [];
          try{ route = row.route ? JSON.parse(row.route) : []; }catch{}
          try{ speeds = row.stepSpeeds ? JSON.parse(row.stepSpeeds) : []; }catch{}

          const agent = new CarAgent(
            row.id,
            [ +row.longitude, +row.latitude ],
            route,
            marker,
            carType,
            speeds,
            decisionTree,
            false,
            +row.creationTime || 0
          );

          
          cars.push(agent);
        }

        if (row.type === "rule"){
          try{
            const loc: [number,number] = JSON.parse(row.loc);
            rules.push({
              id           : row.id,
              type         : row.ruleType,
              location     : loc,
              radius       : Number(row.radius) || 20,
              priorityRule : row.priority || undefined
            });
          }catch(e){
            console.warn("Regla malformada:", row, e);
          }
        }
      });

      rules.forEach(r => {
        if (r.type === "roundabout"){
          drawRoundaboutEntryZone(map, r, `${r.id}-zone`);
        }
      });

      if (cars.length) map.flyTo({ center: cars[0].position, zoom:17 });

      callback(cars, rules);
    }
  });
}

// --- SECCIÓN DE EXPORTACIÓN DE TELEMETRÍA (INTACTA) ---

export type Criterion = 'meters' | 'seconds';

export let exportConfig: { criterion: Criterion; interval: number } = {
  criterion: 'meters',
  interval: 50,
};

export function setExportConfig(config: { criterion: Criterion; interval: number }) {
  exportConfig = config;
}

export function exportTelemetryToCsv() {
  const { criterion, interval } = exportConfig;

  const header =
    "carId,timestampUTC,lat,lng,speedKmh,directionDeg,distanceKm,simTimeSec\n";

  const filteredRows: TelemetryRow[] = [];

  for (const [carId, rows] of Object.entries(rawTelemetry)) {
    if (rows.length === 0) continue;

    const sorted = [...rows].sort((a, b) =>
      (criterion === 'meters' ? a.distance - b.distance : a.simTime - b.simTime)
    );

    if (criterion === 'meters') {
      const kmStep = interval / 1000;
      let nextThreshold = kmStep;
      for (const r of sorted) {
        if (r.distance >= nextThreshold) {
          filteredRows.push(r);
          nextThreshold += kmStep;
        }
      }
    } else {
      let nextThreshold = interval;
      for (const r of sorted) {
        if (r.simTime >= nextThreshold) {
          filteredRows.push(r);
          nextThreshold += interval;
        }
      }
    }
  }

  filteredRows.sort((a, b) => a.ts - b.ts);

  const csv = header +
    filteredRows
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

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `telemetry-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}