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
import { rawTelemetry, TelemetryRow } from "../../utils/telemetryStore";
import { evalTree, TreeNode } from "../roundaboutsDecisions";


// Constantes de configuracion
// ------------------------------------------------
//Velocidad máxima de entrada a la rotonda
const ENTRY_LIMIT = 4.17;      // m/s  
// Margen de seguridad entre coches
const EXTRA_MARGIN = 3;         // m

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
  private decisionTree: TreeNode | null;
  public usingDecisionTree = false; //Flag para saber si se está usando el árbol de decisiones

  constructor(
    id: string,
    position: [number, number],
    route: [number, number][],
    marker: mapboxgl.Marker,
    carType: CarOption,
    public stepSpeeds: number[] = [],
    decisionTree: TreeNode | null = null
  ) {
    super(id, position, route, marker, carType.id);
    this.maxSpeed = 100;
    this.targetSpeed = stepSpeeds[0] ?? this.maxSpeed;
    this.acceleration = 2;
    this.carType = carType;
    this.prevPosition = [...position]; // ⬅️ Añade esta línea
    //console.log(`[${id}] CarAgent creado con stepSpeeds:`, stepSpeeds);
    this.decisionTree = decisionTree;
  }

  private getCurrentStepSpeed(): number {
    /*  stepSpeeds.length == nº de segmentos (N)
        this.route.length  == nodos que aún quedan (N, N-1, …, 0)
  
        Índice del tramo = N − this.route.length                    */
    const idx = this.stepSpeeds.length - this.route.length;

    /*  Clamp por si ya hemos llegado al final (route.length == 0)   */
    return this.stepSpeeds[Math.min(idx, this.stepSpeeds.length - 1)] ?? this.maxSpeed;
  }

  private distanceToRoundaboutCenter(rules: TrafficElement[]): number {
    const round = rules.find(r => r.type === "roundabout");
    if (!round) return Infinity;
    return distance(
      turfPoint(this.position),
      turfPoint(round.location),
      { units: "meters" }
    );
  }



  public reactToTrafficRules(rules: TrafficElement[], others: CarAgent[]) {
    // console.group(`[${this.id}] reactToTrafficRules start`);
    //console.log("Posición:", this.position);
    //console.log("Velocidad actual (m/s):", this.speed.toFixed(2));
    //console.log("targetSpeed previo (m/s):", this.targetSpeed.toFixed(2));
    //console.log("currentStepSpeed (m/s):", this.currentStepSpeed.toFixed(2));
    //console.log("insideRoundaboutIds:", [...this.insideRoundaboutIds]);
    //console.log("stopped:", this.stopped);


    this.usingDecisionTree = false; //Limpia el flag al inicio de la función

    // buscamo rotonda
    const round = rules.find(r => r.type === "roundabout");

    // ─── 1) LÓGICA DINÁMICA ─────────────────────────────
    if (this.decisionTree && round) {
      //console.log("🔧 Usando decisionTree (solo dentro de rotonda)");

      // distancia al centro
      const distY = turfDistance(
        turfPoint(this.position),
        turfPoint(round.location),
        { units: "meters" }
      );
      //console.log("Feature distY:", distY.toFixed(1));

      if (distY <= 100) {
        this.usingDecisionTree = true; //Se activa el flag si se está usando el árbol de decisiones


        // armamos inputs
        const inputs: Record<string, number> = {
          speedVRnd: this.speed,
          distY,
          speedL: this.currentStepSpeed,
          Dist_YL: this.insideRoundaboutIds.has(round.id) ? 1 : 0,
          Dist_YN: this.insideRoundaboutIds.has(round.id) ? 0 : 1,
          Lz: this.stopped ? 1 : 0,
        };
        //console.log("Inputs for evalTree:", inputs);

        const action = evalTree(this.decisionTree, inputs);
        //console.log("evalTree result:", action);

        // aplicamos acción
        switch (action) {
          case "GD":
            this.targetSpeed = this.maxSpeed;
            //console.log("→ GD: targetSpeed = maxSpeed", this.maxSpeed.toFixed(2));
            break;
          case "T-HOLD":
          case "STOP":
            this.speed = 0;
            //console.log("→ STOP/T-HOLD: speed = 0");
            break;
          case "T-OFF":
          case "B-ON":
            this.targetSpeed = 0;
            //console.log("→ T-OFF/B-ON: targetSpeed = 0");
            break;
          case "T-ON":
            this.targetSpeed = this.currentStepSpeed;
            //console.log("→ T-ON: targetSpeed = currentStepSpeed", this.currentStepSpeed.toFixed(2));
            break;
          case "LB-ON":
            this.targetSpeed = Math.min(this.currentStepSpeed, ENTRY_LIMIT);
            //console.log("→ LB-ON: targetSpeed = clamp(", this.currentStepSpeed.toFixed(2), ", ENTRY_LIMIT)");
            break;
          case "RND-MD":
          case "RND-IN":
            this.targetSpeed = ENTRY_LIMIT;
            //console.log(`→ ${action}: targetSpeed = ENTRY_LIMIT`, ENTRY_LIMIT.toFixed(2));
            break;
          default:
            //console.log("→ Acción desconocida:", action);
            break;
        }


        // console.groupEnd();
        return;
      }

      //console.log("→ Fuera de zona de decisión del árbol (> 100 m)");
    }

    // ─── 2) LÓGICA LEGACY ────────────────────────────────
    //console.log("🔧 Usando lógica legacy");

    // 0) Limpieza de salidas de rotonda
    for (const rule of rules) {
      if (rule.type !== "roundabout") continue;
      const dCenter = distance(
        turfPoint(this.position),
        turfPoint(rule.location),
        { units: "meters" }
      );
      if (this.insideRoundaboutIds.has(rule.id) && dCenter > rule.radius + 1) {
        //console.log(`→ Sale de ${rule.id}, dCenter=${dCenter.toFixed(1)} > R+1`);
        this.insideRoundaboutIds.delete(rule.id);
        if (this.stopped) {
          //console.log("→ Liberando stop tras salir de rotonda");
          this.stopped = false;
        }
      }
    }

    if (this.stopped) {
      //console.log("→ Está detenido, stopTimer =", this.stopTimer.toFixed(2));
      // console.groupEnd();
      return;
    }

    let shouldSlowDown = false;

    for (const rule of rules) {
      const d = distance(
        turfPoint(this.position),
        turfPoint(rule.location),
        { units: "meters" }
      );
      //console.log(`Regla ${rule.id}, tipo=${rule.type}, d=${d.toFixed(1)}`);

      if (rule.type === "roundabout") {
        const isInside = d < rule.radius;
        //console.log(`  Dentro de rotonda? ${isInside}`);
        if (isInside) {
          if (!this.insideRoundaboutIds.has(rule.id)) {
            //console.log(`  Entra en ${rule.id}`);
            this.insideRoundaboutIds.add(rule.id);
          }
          this.targetSpeed = Math.min(this.targetSpeed, ENTRY_LIMIT);
          shouldSlowDown = true;
          continue;
        }

        const brakingDist = Math.max(
          0,
          (this.speed * this.speed - ENTRY_LIMIT * ENTRY_LIMIT) /
          (2 * this.acceleration)
        );
        const isApproaching = d < rule.radius + brakingDist + EXTRA_MARGIN;
        //console.log(`  isApproaching? ${isApproaching} (brakingDist=${brakingDist.toFixed(1)})`);

        if (isApproaching && !this.insideRoundaboutIds.has(rule.id)) {
          const carsInside = others.filter(o => o.insideRoundaboutIds.has(rule.id));
          //console.log(`  cochesInside=${carsInside.length}`);
          if (carsInside.length > 0) {
            //console.log("  Stop-and-wait activado");
            this.stopped = true;
            this.stopTimer = 1.0;
            this.speed = 0;
            this.targetSpeed = 0;
            // console.groupEnd();
            return;
          }
          //console.log("  Frenando a ENTRY_LIMIT");
          this.speed = Math.min(this.speed, ENTRY_LIMIT);
          this.targetSpeed = Math.min(this.targetSpeed, ENTRY_LIMIT);
          shouldSlowDown = true;
        }
      }

      if (rule.priorityRule === "give-way" && d < rule.radius + 15) {
        //console.log("  Ceda el paso: ajustando targetSpeed a 1.0");
        this.targetSpeed = Math.min(this.targetSpeed, 1.0);
        shouldSlowDown = true;
      }
    }

    if (!shouldSlowDown) {
      //console.log("  Recuperando velocidad normal:", this.currentStepSpeed.toFixed(2));
      this.targetSpeed = this.insideRoundaboutIds.size
        ? ENTRY_LIMIT
        : this.currentStepSpeed;
    }
    //console.log("targetSpeed final:", this.targetSpeed.toFixed(2));
    // console.groupEnd();
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
    const row: TelemetryRow = {
      id: car.id,
      ts: Date.now(),
      lat: car.position[1],
      lng: car.position[0],
      speedKmh: car.speed * 3.6,
      direction: car.lastRotation,
      distance: car.totalDistance, // km
      simTime,
    };

    (rawTelemetry[car.id] ??= []).push(row);
  }
  updatePosition(dt: number) {
    /* -----------------------------------------
       0.  Copia posición previa
    ----------------------------------------- */
    this.prevPosition = [...this.position];

    /* -----------------------------------------
       1.  Velocidad objetivo y frenadas
    ----------------------------------------- */
    // const totalRoute = this.route.length + 1;
    // const stepIndex = Math.max(0, this.stepSpeeds.length - totalRoute);
    this.currentStepSpeed = this.getCurrentStepSpeed();
    this.maxSpeed = this.currentStepSpeed;
    this.targetSpeed = Math.min(this.targetSpeed, this.currentStepSpeed);

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

    // rules.filter(r => r.type === "roundabout").forEach(r =>
    //   //console.log(`[RULE] ${r.id} centro=${r.location}  R=${r.radius}`)
    // );


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
