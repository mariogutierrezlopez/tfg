// utils/telemetryStore.ts
export type TelemetryRow = {
    id:        string;           // id del coche
    ts:        number;           // epoch ms
    lat:       number;
    lng:       number;
    speedKmh:  number;
    direction: number;
    distance:  number;           // km acumulados
    simTime:   number;           // seg de simulación
  };
  
  export const telemetry: Record<string, TelemetryRow[]> = {};   // por coche
  export const lastKm:   Record<string, number> = {};            // km ⇒ verificación 50 m
  