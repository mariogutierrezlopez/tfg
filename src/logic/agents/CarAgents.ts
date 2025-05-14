import { TrafficAgent } from "./TrafficAgent";
import { TrafficElement } from "../../utils/types";
import {
  point as turfPoint,
  lineString,
  distance as turfDistance,
  nearestPointOnLine,
} from "@turf/turf";
import distance from "@turf/distance";
import { CarOption } from "../../utils/types";
import { destination, bearing } from "@turf/turf";
import { telemetry, lastKm, TelemetryRow } from "../../utils/telemetryStore";

export class CarAgent extends TrafficAgent {
  maxSpeed: number;
  stopped = false;
  stopTimer = 0;
  carType: CarOption;
  lastRotation = 0;
  private processedRuleIds: Set<string> = new Set();
  public totalDistance = 0;
  private insideRoundaboutIds: Set<string> = new Set(); // 🆕 múltiples rotondas
  targetSpeed = 0;
  currentStepSpeed: number = 0; // velocidad actual del paso
  prevPosition: [number, number];

  constructor(
    id: string,
    position: [number, number],
    route: [number, number][],
    marker: mapboxgl.Marker,
    carType: CarOption,
    public stepSpeeds: number[] = []
  ) {
    super(id, position, route, marker, carType.id);
    this.maxSpeed = 100;
    this.targetSpeed = stepSpeeds[0] ?? this.maxSpeed;
    this.acceleration = 2;
    this.carType = carType;
    this.prevPosition = [...position]; // ⬅️ Añade esta línea
    console.log(`[${id}] CarAgent creado con stepSpeeds:`, stepSpeeds);
  }

  /** ------------------------------------------------------------------
   *  Analiza señales / reglas de tráfico y ajusta la velocidad / parada
   *  ------------------------------------------------------------------ */
  reactToTrafficRules(rules: TrafficElement[], others: CarAgent[]) {
    if (this.stopped) return;

    let shouldSlowDown = false;

    for (const rule of rules) {
      const d = distance(turfPoint(this.position), turfPoint(rule.location), {
        units: "meters",
      });

      /* ========== 1. ROTONDAS ========== */
      if (rule.type === "roundabout") {
        const isInside = d < rule.radius;

        /* Ya estoy dentro → marco bandera y continúo */
        if (isInside) {
          this.insideRoundaboutIds.add(rule.id);
          continue;
        }

        /* Me aproximo al borde (radio + 25 m) */
        const isApproaching = d < rule.radius + 25;

        if (isApproaching && !this.insideRoundaboutIds.has(rule.id)) {
          /* Coches que ya están dentro */
          const carsInside = others.filter((o) =>
            o.insideRoundaboutIds.has(rule.id)
          );

          /* ---------- GAP-ACCEPTANCE ---------- */
          let conflict = false;

          for (const insideCar of carsInside) {
            /* bearing del brazo de entrada (centro → yo) */
            const entryBearing = bearing(
              turfPoint(rule.location),
              turfPoint(this.position)
            );

            /* bearing actual del coche que está dentro (centro → él) */
            const insideBearing = bearing(
              turfPoint(rule.location),
              turfPoint(insideCar.position)
            );

            /* diferencia angular más corta (0-180) */
            const angDiff = Math.abs(
              ((insideBearing - entryBearing + 540) % 360) - 180
            );

            /* distancia del interior al centro */
            const rDist = distance(
              turfPoint(rule.location),
              turfPoint(insideCar.position),
              { units: "meters" }
            );

            /* Conflicto si:
               1) está aún dentro (≤ 1.4× R)
               2) está en mi semicírculo delantero (±90°) */
            if (rDist < rule.radius * 1.4 && angDiff < 90) {
              conflict = true;
              break;
            }
          }

          if (conflict) {
            /* Detención completa: cede paso */
            this.stopped = true;
            this.stopTimer = 1.5; // ⬅ ajusta a tu gusto
            this.speed = 0;
            this.targetSpeed = 0;
            return;
          }

          /* Si no hay conflicto real → reduzco velocidad de entrada */
          this.targetSpeed = Math.min(this.targetSpeed, 2.0); // 2 m/s ≈ 7 km/h
          shouldSlowDown = true;
        }
      }

      /* ========== 2. CEDA EL PASO GENÉRICO ========== */
      if (rule.priorityRule === "give-way" && d < rule.radius + 15) {
        this.targetSpeed = Math.min(this.targetSpeed, 1.0);
        shouldSlowDown = true;
      }
    }

    /* --- Limpieza de bandera: salgo de la rotonda --- */
    for (const rule of rules) {
      if (rule.type !== "roundabout" || !this.insideRoundaboutIds.has(rule.id))
        continue;

      const dCenter = distance(
        turfPoint(this.position),
        turfPoint(rule.location),
        { units: "meters" }
      );
      const headingOut = bearing(
        turfPoint(rule.location),
        turfPoint(this.position)
      );
      const next = this.route[0] ?? this.position;
      const goingOut =
        Math.abs(
          bearing(turfPoint(this.position), turfPoint(next)) - headingOut
        ) < 60; // dirección ya apunta fuera

      if (dCenter > rule.radius && goingOut) {
        this.insideRoundaboutIds.delete(rule.id);
      }
    }

    /* --- Recupera velocidad si no había motivos para frenar --- */
    if (!shouldSlowDown) {
      this.targetSpeed = Math.min(
        this.targetSpeed + this.acceleration * 0.5,
        this.currentStepSpeed
      );
    }
  }

  hasPassedRule(rule: TrafficElement): boolean {
    if (this.route.length < 1) return false;
    const next = this.route[0];

    if (
      !next ||
      !Array.isArray(next) ||
      next.length !== 2 ||
      isNaN(next[0]) ||
      isNaN(next[1]) ||
      !Array.isArray(this.position) ||
      this.position.length !== 2 ||
      isNaN(this.position[0]) ||
      isNaN(this.position[1]) ||
      !Array.isArray(rule.location) ||
      rule.location.length !== 2 ||
      isNaN(rule.location[0]) ||
      isNaN(rule.location[1]) ||
      (this.position[0] === next[0] && this.position[1] === next[1]) // 👈 esta línea evita segmentos vacíos
    ) {
      console.warn("⚠️ Segmento inválido en hasPassedRule, se omite.");
      return false;
    }

    const seg = lineString([this.position, next]);
    const rulePt = turfPoint(rule.location);
    const snapped = nearestPointOnLine(seg, rulePt);

    const distToRule = turfDistance(turfPoint(this.position), rulePt, {
      units: "meters",
    });
    const distToSnapped = turfDistance(turfPoint(this.position), snapped, {
      units: "meters",
    });

    this.targetSpeed = Math.min(this.targetSpeed, this.currentStepSpeed);

    return distToSnapped > distToRule;
  }

  isInFront(other: CarAgent): boolean {
    const [lng1, lat1] = this.position;
    const [lng2, lat2] = other.position;

    const dirToOther = Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
    const myDirection =
      this.route.length >= 1
        ? Math.atan2(this.route[0][0] - lng1, this.route[0][1] - lat1) *
          (180 / Math.PI)
        : 0;

    const angleDiff = Math.abs(dirToOther - myDirection);
    return angleDiff < 60;
  }

  /* ───────────────────────────────────────────────
   2) isApproachingSameRoundaboutEntry  ▶ ajustado
   ─────────────────────────────────────────────── */
  private isApproachingSameRoundaboutEntry(
    other: CarAgent,
    roundabout: TrafficElement
  ): boolean {
    const myDist = distance(
      turfPoint(this.position),
      turfPoint(roundabout.location),
      { units: "meters" }
    );
    const otherDist = distance(
      turfPoint(other.position),
      turfPoint(roundabout.location),
      { units: "meters" }
    );

    const bothClose =
      myDist < roundabout.radius + 15 && otherDist < roundabout.radius + 15;
    const oneInside =
      this.insideRoundaboutIds.has(roundabout.id) !==
      other.insideRoundaboutIds.has(roundabout.id);

    /* misma entrada (±35°) */
    const myBearing = bearing(
      turfPoint(roundabout.location),
      turfPoint(this.position)
    );
    const otherBearing = bearing(
      turfPoint(roundabout.location),
      turfPoint(other.position)
    );
    const sameArm = Math.abs(myBearing - otherBearing) < 35;

    return bothClose && oneInside && sameArm;
  }

  /** Registra una fila cada 50 m (= 0.05 km) */
  public maybeLog(car: CarAgent, simTime: number) {
    const traveledKm = car.totalDistance; // km acumulados
    const prevKm = lastKm[car.id] ?? 0;

    if (traveledKm - prevKm < 0.05) return; // aún no llegó a 50 m

    lastKm[car.id] = traveledKm; // actualiza referencia

    const row: TelemetryRow = {
      id: car.id,
      ts: Date.now(),
      lat: car.position[1],
      lng: car.position[0],
      speedKmh: car.speed * 3.6,
      direction: car.lastRotation,
      distance: traveledKm,
      simTime,
    };

    (telemetry[car.id] ??= []).push(row);
  }

  updatePosition(dt: number) {
    /* -----------------------------------------
       0.  Copia posición previa
    ----------------------------------------- */
    this.prevPosition = [...this.position];

    /* -----------------------------------------
       1.  Velocidad objetivo y frenadas
    ----------------------------------------- */
    const totalRoute = this.route.length + 1;
    const stepIndex = Math.max(0, this.stepSpeeds.length - totalRoute);
    this.currentStepSpeed = this.stepSpeeds[stepIndex] ?? this.maxSpeed;
    this.maxSpeed = this.currentStepSpeed;
    this.targetSpeed = Math.min(this.targetSpeed, this.currentStepSpeed);

    if (this.stopped) {
      this.stopTimer -= dt;
      if (this.stopTimer <= 0) this.stopped = false;
      return;
    }

    /* aceleración / deceleración */
    if (this.speed < this.targetSpeed) {
      this.speed = Math.min(
        this.targetSpeed,
        this.speed + this.acceleration * dt
      );
    } else if (this.speed > this.targetSpeed) {
      this.speed = Math.max(
        this.targetSpeed,
        this.speed - this.acceleration * dt
      );
    }

    /* -----------------------------------------
       2.  Movimiento a lo largo de la ruta
    ----------------------------------------- */
    const next = this.route[0];
    if (!next) return;

    const curPt = turfPoint(this.position);
    const nextPt = turfPoint(next);
    const distToNxt = distance(curPt, nextPt, { units: "meters" });

    const MIN_STEP = 0.05;
    const stepLen = Math.max(this.speed * dt, MIN_STEP);

    if (distToNxt === 0 && this.route.length > 1) {
      this.route.shift();
      return;
    }

    if (distToNxt <= stepLen) {
      this.position = next;
      this.route.shift();
    } else {
      const ang = bearing(curPt, nextPt);
      const moved = destination(curPt, stepLen, ang, { units: "meters" });
      this.position = moved.geometry.coordinates as [number, number];
    }

    /* suma distancia recorrida */
    this.totalDistance += stepLen / 1000; // km

    /* -----------------------------------------
       3.  Suavizado de rotación
    ----------------------------------------- */
    const rawBearing = bearing(curPt, nextPt); // −180…+180
    const targetRot = (rawBearing + 360) % 360; // 0…359
    let delta = targetRot - this.lastRotation;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360; 
    this.lastRotation = (this.lastRotation + delta * 0.2 + 360) % 360;

    this.marker.setRotation(this.lastRotation);

    // /* -----------------------------------------
    //    4.  Telemetría cada 50 m
    // ----------------------------------------- */
    // this.maybeLog(this, simTime);

    // /* 4. telemetría (solo si el caller envía simTime>0) */
    // if (simTime > 0) this.maybeLog(this, simTime);
  }

  reactToOtherCars(others: CarAgent[], rules: TrafficElement[]) {
    if (this.stopped) return;

    let shouldSlow = false;

    for (const other of others) {
      if (other.id === this.id) continue;

      // 🔁 Prioridad en entradas de rotondas
      for (const rule of rules) {
        if (rule.type !== "roundabout") continue;

        if (this.isApproachingSameRoundaboutEntry(other, rule)) {
          const iAmInside = this.insideRoundaboutIds.has(rule.id);
          const otherIsInside = other.insideRoundaboutIds.has(rule.id);

          if (iAmInside && !otherIsInside) {
            continue; // tengo prioridad, no freno
          }

          if (!iAmInside && otherIsInside) {
            // debo ceder
            this.targetSpeed = 0;
            shouldSlow = true;
            break;
          }
        }
      }

      // Si ya se decidió frenar por rotonda, ignora el resto
      if (shouldSlow) break;

      // 🚗 Lógica de frenado por cercanía genérica
      const sharedRoundabouts = [...this.insideRoundaboutIds].filter((id) =>
        other.insideRoundaboutIds.has(id)
      );
      if (sharedRoundabouts.length === 0 && this.insideRoundaboutIds.size > 0) {
        continue; // yo estoy dentro y el otro no => tengo prioridad
      }

      const dist = distance(
        turfPoint(this.position),
        turfPoint(other.position),
        { units: "meters" }
      );

      if (dist < 8 && other.speed < 0.00005 && this.isInFront(other)) {
        this.targetSpeed = 0;
        shouldSlow = true;
        break;
      }

      if (dist < 10 && this.isInFront(other)) {
        this.targetSpeed = Math.min(this.targetSpeed, 1.5); // 1.5 m/s ≈ 5.4 km/h
        shouldSlow = true;
      } else if (dist < 20 && this.isInFront(other)) {
        this.targetSpeed = Math.min(this.targetSpeed, 3.0); // 3.0 m/s ≈ 10.8 km/h
        shouldSlow = true;
      }
    }

    if (!shouldSlow) {
      this.targetSpeed = this.maxSpeed;
    }
    this.targetSpeed = Math.min(this.targetSpeed, this.currentStepSpeed);
  }
}
