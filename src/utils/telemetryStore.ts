// utils/telemetryStore.ts

export interface TelemetryRow {
  id: string;
  ts: number;
  lat: number;
  lng: number;
  speedKmh: number;
  direction: number;
  distance: number;  // km
  simTime: number;   // sec
}

// Raw acumula todo lo que registre maybeLog
export const rawTelemetry: Record<string, TelemetryRow[]> = {};

  