// src/logic/agents/CarAgents.ts

import { TrafficAgent } from "./TrafficAgent";
import { TrafficElement } from "../../utils/types";
import {
  point as turfPoint, // Usar turfPoint
  lineString,         // Usar lineString directamente
  distance as turfDistance,
  nearestPointOnLine, // Usar nearestPointOnLine directamente
  bearing,            // Usar bearing directamente
  destination         // Usar destination directamente
} from "@turf/turf";
import distance from "@turf/distance";
import { CarOption } from "../../utils/types";
import { rawTelemetry, TelemetryRow } from "../../utils/telemetryStore";
import { evalTree, TreeNode } from "../../utils/decisionTree";


// Constantes de configuracion
// ------------------------------------------------
//Velocidad máxima de entrada a la rotonda
const ENTRY_LIMIT = 4.17;       // m/s  
// Margen de seguridad entre coches
const EXTRA_MARGIN = 3;         // m

const MIN_STEP_DIST = 0.05; // Definir MIN_STEP_DIST aquí para que esté disponible en la clase


export class CarAgent extends TrafficAgent {
  maxSpeed: number;
  stopped = false;
  stopTimer = 0;
  carType: CarOption;
  lastRotation = 0;
  private processedRuleIds: Set<string> = new Set();
  public totalDistance = 0;
  private insideRoundaboutIds: Set<string> = new Set();
  targetSpeed = 0;
  currentStepSpeed: number = 0;
  prevPosition: [number, number];
  private decisionTree: TreeNode | null;
  public usingDecisionTree = false;

  public assignedLane: 'inner' | 'outer' | null = null;
  public isInsideRoundabout = false;
  private originalRoute: [number, number][] = [];
  public hasLaneBeenAssigned = false;
  public hasConstantSpeed: boolean;
  private prevIsInsideRoundabout = false; // <-- AÑADIDA PROPIEDAD

  private roundaboutManeuverPathLength = 0;
  private postRoundaboutContinuationRoute: [number, number][] = [];

  public features: {
    Lz: number;
    Cz: number;
    Rz: number;
    LL: number;
    RL: number;
    [key: string]: number;
  };

  constructor(
    id: string,
    position: [number, number],
    route: [number, number][],
    marker: mapboxgl.Marker,
    carType: CarOption,
    public stepSpeeds: number[] = [],
    decisionTree: TreeNode | null = null,
    hasConstantSpeed: boolean = false
  ) {
    super(id, position, route, marker, carType.id);
    this.maxSpeed = 100;
    this.targetSpeed = stepSpeeds[0] ?? this.maxSpeed;
    this.acceleration = 2;
    this.carType = carType;
    this.prevPosition = [...position];
     this.decisionTree = hasConstantSpeed ? null : decisionTree;
    this.features = { Lz: 0, Cz: 0, Rz: 0, LL: 0, RL: 0 };
    this.originalRoute = [...route];
    this.hasConstantSpeed = hasConstantSpeed;
    this.prevIsInsideRoundabout = this.isInsideRoundabout; // <-- INICIALIZAR AQUÍ

    console.log(`LOG_AGENT (${this.id}): Constructor - Decision tree received:`, decisionTree ? 'Yes' : 'No', `hasConstantSpeed: ${hasConstantSpeed}`);
  }

  private getCurrentStepSpeed(): number {
    const idx = this.stepSpeeds.length - this.route.length;
    return this.stepSpeeds[Math.min(idx, this.stepSpeeds.length - 1)] ?? this.maxSpeed;
  }

  // Modifica esta función completamente:
public assignRoundaboutLane(
    _innerLaneCoords: [number, number][],
    _outerLaneCoords: [number, number][],
    currentRoundaboutRule?: TrafficElement
  ) {
    if (this.hasLaneBeenAssigned) {
      return;
    }
    console.log(`LOG_AGENT (${this.id}): ----- INICIO assignRoundaboutLane (Versión Mejorada) -----`);

    if (!currentRoundaboutRule?.geometry || currentRoundaboutRule.geometry.length < 1) {
      console.error(`LOG_AGENT (${this.id}): ERROR No hay currentRoundaboutRule.geometry válida.`);
      return;
    }

    const roundaboutManeuverPath = [...currentRoundaboutRule.geometry];
    this.roundaboutManeuverPathLength = roundaboutManeuverPath.length;

    // --- LÓGICA DE EMPALME DE RUTA MEJORADA ---
    
    this.postRoundaboutContinuationRoute = [];
    const apiPathExitPoint = roundaboutManeuverPath[roundaboutManeuverPath.length - 1];
    
    // 1. Encontrar el índice del punto de entrada en la ruta original
    const entryPoint = roundaboutManeuverPath[0];
    let entryIndex = -1;
    let minEntryDist = Infinity;
    this.originalRoute.forEach((p, idx) => {
        const d = turfDistance(turfPoint(p), turfPoint(entryPoint));
        if (d < minEntryDist) {
            minEntryDist = d;
            entryIndex = idx;
        }
    });

    // 2. Buscar el punto MÁS CERCANO a la salida, pero solo DESPUÉS de la entrada
    let apiPathExitIndexInOriginalRoute = -1;
    let minExitDist = Infinity;

    if (entryIndex !== -1) {
        for (let i = entryIndex; i < this.originalRoute.length; i++) {
            const p = this.originalRoute[i];
            const d = turfDistance(turfPoint(p), turfPoint(apiPathExitPoint));
            if (d < minExitDist) {
                minExitDist = d;
                apiPathExitIndexInOriginalRoute = i;
            }
        }
    }

    // 3. Comprobar si el punto encontrado es suficientemente bueno (dentro de una tolerancia)
    const MAX_EXIT_DISTANCE_TOLERANCE = 20; // metros
    if (apiPathExitIndexInOriginalRoute !== -1 && minExitDist < MAX_EXIT_DISTANCE_TOLERANCE) {
        // La ruta de continuación es todo lo que sigue DESPUÉS del punto de empalme.
        // Usamos `+ 1` para no incluir el punto de empalme, que ya está en la maniobra.
        this.postRoundaboutContinuationRoute = this.originalRoute.slice(apiPathExitIndexInOriginalRoute + 1);
    } else {
        console.warn(`LOG_AGENT (${this.id}): No se encontró punto de continuación. El coche se detendrá. Distancia mínima a salida: ${minExitDist.toFixed(2)}m`);
        this.postRoundaboutContinuationRoute = [];
    }
    
    // --- FIN DE LA LÓGICA MEJORADA ---

    console.log(`LOG_AGENT (${this.id}): Ruta de continuación post-maniobra, longitud: ${this.postRoundaboutContinuationRoute.length}.`);

    this.route = [...roundaboutManeuverPath, ...this.postRoundaboutContinuationRoute];
    this.assignedLane = null;
    this.hasLaneBeenAssigned = true;
    this.isInsideRoundabout = true;

    console.log(`LOG_AGENT (${this.id}): Nueva ruta total asignada, longitud: ${this.route.length}.`);
    console.log(`LOG_AGENT (${this.id}): ----- FIN assignRoundaboutLane -----`);
  }

  // La función updatePosition que te di en el mensaje anterior (con el decremento de roundaboutManeuverPathLength)
  // debería seguir funcionando bien con este cambio. Revisa que la tengas así:
  public updatePosition(dt: number) {
    if (this.isInsideRoundabout !== this.prevIsInsideRoundabout) {
      console.log(
        `LOG_AGENT (${this.id}): isInsideRoundabout CAMBIÓ de ${this.prevIsInsideRoundabout} a ${this.isInsideRoundabout}. ` +
        `Pos: ${this.position[0].toFixed(2)},${this.position[1].toFixed(2)}. ` +
        `Ruta restante: ${this.route.length}`
      );
      this.prevIsInsideRoundabout = this.isInsideRoundabout;
    }

    this.prevPosition = [...this.position];
    this.currentStepSpeed = this.getCurrentStepSpeed();
    const currentMaxSpeed = this.isInsideRoundabout ? ENTRY_LIMIT : this.currentStepSpeed;
    this.maxSpeed = currentMaxSpeed;
    this.targetSpeed = Math.min(this.targetSpeed, currentMaxSpeed);

    if (this.speed < this.targetSpeed) {
      this.speed = Math.min(this.targetSpeed, this.speed + this.acceleration * dt);
    } else if (this.speed > this.targetSpeed) {
      this.speed = Math.max(this.targetSpeed, this.speed - this.acceleration * dt);
    }

    if (this.route.length === 0) {
      if (this.isInsideRoundabout) {
        console.warn(`LOG_AGENT (${this.id}): Estaba en maniobra de rotonda pero se quedó sin ruta. Marcando salida.`);
        this.isInsideRoundabout = false;
        this.assignedLane = null;
      }
      return;
    }

    const next = this.route[0];
    const curPt = turfPoint(this.position);
    const nextPt = turfPoint(next);
    const distToNxt = turfDistance(curPt, nextPt, { units: "meters" });

    const SNAP_THRESHOLD = 0.5;

    if (distToNxt < SNAP_THRESHOLD) {
      this.position = [...next];
      this.route.shift();

      if (this.isInsideRoundabout) { // Solo decrementa si aún se considera en la maniobra de rotonda
        this.roundaboutManeuverPathLength--;
        if (this.roundaboutManeuverPathLength <= 0) {
          console.log(`LOG_AGENT (${this.id}): Parte de maniobra de rotonda de Mapbox completada.`);
          this.isInsideRoundabout = false;
          this.assignedLane = null;
          if (this.route.length === 0) {
            console.warn(`LOG_AGENT (${this.id}): Maniobra rotonda y ruta de continuación vacías. El coche se detendrá.`);
          } else {
            console.log(`LOG_AGENT (${this.id}): Transicionando a ruta de continuación ya en this.route. Puntos restantes: ${this.route.length}`);
          }
        }
      } else if (this.route.length === 0) { // Si no estaba en rotonda y la ruta se acaba, es el fin.
        console.log(`LOG_AGENT (${this.id}): Ruta final/segmento completado (SNAP_THRESHOLD).`);
      }

      if (this.route.length === 0) return;

    } else {
      const ang = bearing(curPt, nextPt);
      const stepLen = Math.max(this.speed * dt, MIN_STEP_DIST);
      const moved = destination(curPt, stepLen, ang, { units: "meters" });
      this.position = moved.geometry.coordinates as [number, number];
    }

    this.totalDistance += Math.max(this.speed * dt, MIN_STEP_DIST) / 1000;

    if (this.position[0] !== this.prevPosition[0] || this.position[1] !== this.prevPosition[1]) {
      if (this.route.length > 0) {
        const rawBearingToNext = bearing(turfPoint(this.position), turfPoint(this.route[0]));
        const targetRot = (rawBearingToNext + 360) % 360;
        let delta = targetRot - this.lastRotation;
        if (delta > 180) delta -= 360; else if (delta < -180) delta += 360;
        this.lastRotation = (this.lastRotation + delta * 0.2 + 360) % 360;
      }
    }
    this.marker.setRotation(this.lastRotation);
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
    if (this.hasConstantSpeed) {
      this.targetSpeed = this.getCurrentStepSpeed();
      return;
    }

    // Intentar encontrar LA regla de rotonda más relevante para el reseteo de hasLaneBeenAssigned
    // Esto podría necesitar una lógica más sofisticada si hay múltiples rotondas muy cercanas.
    // Por ahora, usaremos la primera que encuentre o la más cercana si hay varias.
    let relevantRoundaboutRule: TrafficElement | undefined = rules.find(r => r.type === "roundabout");
    if (rules.filter(r => r.type === "roundabout").length > 1) {
      let minDist = Infinity;
      rules.filter(r => r.type === "roundabout").forEach(r => {
        const d = turfDistance(turfPoint(this.position), turfPoint(r.location), { units: "meters" });
        if (d < minDist) {
          minDist = d;
          relevantRoundaboutRule = r;
        }
      });
    }

    // Resetear hasLaneBeenAssigned si estamos suficientemente lejos de la rotonda Y no estamos dentro
    if (relevantRoundaboutRule && this.hasLaneBeenAssigned && !this.isInsideRoundabout) {
      const distToRelevantRoundCenter = turfDistance(turfPoint(this.position), turfPoint(relevantRoundaboutRule.location), { units: "meters" });
      // Aumentar este umbral si es necesario, ej. 50 o 60 metros
      if (distToRelevantRoundCenter > 50) {
        console.log(`LOG_AGENT (${this.id}): Lejos de rotonda ${relevantRoundaboutRule.id} (${distToRelevantRoundCenter.toFixed(1)}m) y fuera. Reseteando hasLaneBeenAssigned.`);
        this.hasLaneBeenAssigned = false;
        // Nota: assignedLane ya debería ser null si isInsideRoundabout es false después de salir.
      }
    }

    this.usingDecisionTree = false;
    const roundForDecision = relevantRoundaboutRule; // Usar la rotonda relevante para la lógica de decisión

    if (this.id === "main-car" && this.decisionTree == null) {
      console.warn(`LOG_TREE (${this.id}): ⚠️ Decision tree es null, usando lógica legacy.`);
    }

    if (this.decisionTree && roundForDecision) {
      const distY = turfDistance(
        turfPoint(this.position),
        turfPoint(roundForDecision.location), // Usar roundForDecision.location
        { units: "meters" }
      );

      if (distY <= 100) { // Usar el árbol si está a 100m o menos de esta rotonda
        this.usingDecisionTree = true;
        const inputs: Record<string, number> = {
          speedVRnd: this.speed,
          distY,
          speedL: this.currentStepSpeed,
          Dist_YL: this.isInsideRoundabout ? 1 : 0, // Este isInsideRoundabout es el estado general del coche
          Dist_YN: !this.isInsideRoundabout ? 1 : 0,
          Lz: this.features.Lz, Cz: this.features.Cz, RL: this.features.RL, LL: this.features.LL,
        };

        if (this.id === "main-car" && (this.features.Lz === 1 || this.features.Cz === 1 || this.features.Rz === 1)) {
          console.log(
            `LOG_TREE (${this.id}): ÁRBOL con Zona(s) Ocupada(s) Lz=${this.features.Lz},Cz=${this.features.Cz},Rz=${this.features.Rz}. Inputs: ` +
            `distY=${inputs.distY.toFixed(1)}, speedVRnd=${inputs.speedVRnd.toFixed(1)}, isInsideRnd=${inputs.Dist_YL}`
          );
        }
        const action = evalTree(this.decisionTree, inputs);
        if (this.id === "main-car" && (this.features.Lz === 1 || this.features.Cz === 1 || this.features.Rz === 1)) {
          console.log(`LOG_TREE (${this.id}): ÁRBOL ACCIÓN con Zona(s) Ocupada(s) -> ${action}`);
        }

        switch (action) { /* ... tu switch case ... */ }

        // Lógica de salida si el árbol de decisión estaba activo y el coche se aleja
        if (this.isInsideRoundabout) {
          const distToCurrentRoundCenter = turfDistance(this.position, roundForDecision.location, { units: 'meters' });
          if (distToCurrentRoundCenter > roundForDecision.radius + 15) { // Umbral de salida
            console.log(`LOG_AGENT (${this.id}): Saliendo de rotonda ${roundForDecision.id} (lógica árbol, dist: ${distToCurrentRoundCenter.toFixed(1)}m).`);
            this.isInsideRoundabout = false;
            this.assignedLane = null;
            // NO resetear hasLaneBeenAssigned aquí, se hará cuando esté más lejos.
          }
        }
        return; // Si el árbol de decisión actuó, no ejecutar lógica legacy para esta rotonda
      }
    }

    // Lógica Legacy (se aplicará si el árbol no se usó, o para reglas que no son la 'relevantRoundaboutRule')
    for (const rule of rules) { // Iterar sobre todas las reglas para la lógica legacy
      if (rule.type !== "roundabout") continue;
      const dCenter = turfDistance(turfPoint(this.position), turfPoint(rule.location), { units: "meters" });

      if (this.insideRoundaboutIds.has(rule.id) && dCenter > rule.radius + (this.assignedLane ? 5 : 1)) {
        console.log(`LOG_AGENT (${this.id}): Saliendo de rotonda ${rule.id} (lógica legacy).`);
        this.insideRoundaboutIds.delete(rule.id);
        this.isInsideRoundabout = false;
        this.assignedLane = null;
        // NO resetear hasLaneBeenAssigned aquí
        if (this.stopped) this.stopped = false;
      }
    }

    if (this.usingDecisionTree) return; // Si el árbol ya manejó la rotonda principal, no aplicar legacy de velocidad para ella.

    // ... (resto de tu lógica legacy de frenado y control de velocidad, sin cambios) ...
    if (this.stopped) { return; }
    let shouldSlowDown = false;
    for (const rule of rules) {
      const dToRuleCenter = distance(turfPoint(this.position), turfPoint(rule.location), { units: "meters" });
      if (rule.type === "roundabout") {
        if (this.isInsideRoundabout && this.assignedLane) {
          this.targetSpeed = Math.min(this.targetSpeed, ENTRY_LIMIT);
          shouldSlowDown = true; continue;
        }
        const brakingDist = Math.max(0, (this.speed * this.speed - ENTRY_LIMIT * ENTRY_LIMIT) / (2 * this.acceleration));
        const isApproaching = dToRuleCenter < rule.radius + brakingDist + EXTRA_MARGIN;
        if (isApproaching && !this.hasLaneBeenAssigned) { // Solo si no ha gestionado esta rotonda aún
          const carsInsideThisRoundabout = others.filter(o => o.isInsideRoundabout && o.insideRoundaboutIds.has(rule.id));
          if (carsInsideThisRoundabout.length > 0) {
            console.log(`LOG_AGENT (${this.id}): LEGACY - Detenido por coche dentro de rotonda ${rule.id}`);
            this.stopped = true; this.stopTimer = 1.0; this.speed = 0; this.targetSpeed = 0; return;
          }
          this.speed = Math.min(this.speed, ENTRY_LIMIT);
          this.targetSpeed = Math.min(this.targetSpeed, ENTRY_LIMIT);
          shouldSlowDown = true;
        }
      }
      if (rule.priorityRule === "give-way" && dToRuleCenter < (rule.radius || 10) + 15) {
        this.targetSpeed = Math.min(this.targetSpeed, 1.0); shouldSlowDown = true;
      }
    }
    if (!shouldSlowDown && !this.isInsideRoundabout) {
      this.targetSpeed = this.currentStepSpeed;
    } else if (this.isInsideRoundabout) {
      this.targetSpeed = Math.min(this.targetSpeed, ENTRY_LIMIT);
    }
  }



  reactToOtherCars(others: CarAgent[], rules: TrafficElement[]) {
    if (this.hasConstantSpeed) {
      this.targetSpeed = this.getCurrentStepSpeed();
      return;
    }

    if (this.stopped) return;
    let shouldSlow = false;

    for (const other of others) {
      if (other.id === this.id) continue;

      for (const rule of rules) {
        if (rule.type !== "roundabout") continue;
        if (this.isApproachingSameRoundaboutEntry(other, rule)) {
          const iAmInside = this.isInsideRoundabout && this.insideRoundaboutIds.has(rule.id);
          const otherIsInside = other.isInsideRoundabout && other.insideRoundaboutIds.has(rule.id);

          if (iAmInside && !otherIsInside) continue;
          if (!iAmInside && otherIsInside) {
            if (this.id === "main-car") { // Log solo para el coche principal para no saturar
              console.log(`LOG_AGENT (${this.id}): Cediendo paso a ${other.id} en rotonda ${rule.id}.`);
            }
            this.targetSpeed = 0; shouldSlow = true; break;
          }
        }
      }
      if (shouldSlow) break;

      const distToOther = distance(turfPoint(this.position), turfPoint(other.position), { units: "meters" });
      const inFront = this.isInFront(other);

      if (this.isInsideRoundabout && other.isInsideRoundabout && this.assignedLane === other.assignedLane) {
        if (inFront && distToOther < 10) {
          this.targetSpeed = Math.min(this.targetSpeed, Math.max(0, other.speed - 1));
          shouldSlow = true;
        }
      } else if (!this.isInsideRoundabout && !other.isInsideRoundabout) {
        if (inFront && distToOther < 8 && other.speed < 0.1) {
          this.targetSpeed = 0; shouldSlow = true; break;
        }
        if (inFront && distToOther < 10) {
          this.targetSpeed = Math.min(this.targetSpeed, 1.5); shouldSlow = true;
        } else if (inFront && distToOther < 20) {
          this.targetSpeed = Math.min(this.targetSpeed, 3.0); shouldSlow = true;
        }
      }
    }

    if (!shouldSlow) {
      this.targetSpeed = this.isInsideRoundabout ? ENTRY_LIMIT : this.currentStepSpeed;
    }
    this.targetSpeed = Math.min(this.targetSpeed, this.isInsideRoundabout ? ENTRY_LIMIT : this.currentStepSpeed);
  }




  hasPassedRule(rule: TrafficElement): boolean {
    if (this.route.length < 1) return false;
    const next = this.route[0];

    if (!next || !Array.isArray(next) || next.length !== 2 || isNaN(next[0]) || isNaN(next[1]) ||
      !Array.isArray(this.position) || this.position.length !== 2 || isNaN(this.position[0]) || isNaN(this.position[1]) ||
      !Array.isArray(rule.location) || rule.location.length !== 2 || isNaN(rule.location[0]) || isNaN(rule.location[1]) ||
      (this.position[0] === next[0] && this.position[1] === next[1])) {
      console.warn("⚠️ Segmento inválido en hasPassedRule, se omite.");
      return false;
    }

    const seg = lineString([this.position, next]);
    const rulePt = turfPoint(rule.location);
    const snapped = nearestPointOnLine(seg, rulePt);

    const distToRule = distance(turfPoint(this.position), rulePt, { units: "meters" });
    const distToSnapped = distance(turfPoint(this.position), snapped, { units: "meters" });

    this.targetSpeed = Math.min(this.targetSpeed, this.currentStepSpeed);
    return distToSnapped > distToRule;
  }



  isInFront(other: CarAgent): boolean {
    const [lng1, lat1] = this.position;
    const [lng2, lat2] = other.position;

    const dirToOther = Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
    const myDirection = this.route.length >= 1 ? bearing(turfPoint(this.position), turfPoint(this.route[0])) : this.lastRotation;

    let angleDiff = Math.abs(dirToOther - myDirection);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    return angleDiff < 60;
  }

  private isApproachingSameRoundaboutEntry(other: CarAgent, roundabout: TrafficElement): boolean {
    const myDist = distance(turfPoint(this.position), turfPoint(roundabout.location), { units: "meters" });
    const otherDist = distance(turfPoint(other.position), turfPoint(roundabout.location), { units: "meters" });

    const bothClose = myDist < roundabout.radius + 15 && otherDist < roundabout.radius + 15;

    const iAmEffectivelyInside = this.isInsideRoundabout && this.insideRoundaboutIds.has(roundabout.id);
    const otherIsEffectivelyInside = other.isInsideRoundabout && other.insideRoundaboutIds.has(roundabout.id);

    const oneInsideTheOtherApproaching = (iAmEffectivelyInside && !otherIsEffectivelyInside && otherDist < roundabout.radius + 15) ||
      (!iAmEffectivelyInside && otherIsEffectivelyInside && myDist < roundabout.radius + 15);

    if (!oneInsideTheOtherApproaching) return false;

    const myBearingToCenter = bearing(turfPoint(this.position), turfPoint(roundabout.location));
    const otherBearingToCenter = bearing(turfPoint(other.position), turfPoint(roundabout.location));

    let armAngleDiff = Math.abs(myBearingToCenter - otherBearingToCenter);
    if (armAngleDiff > 180) armAngleDiff = 360 - armAngleDiff;

    return armAngleDiff < 70;
  }


  public maybeLog(car: CarAgent, simTime: number) {
    const row: TelemetryRow = {
      id: car.id, ts: Date.now(), lat: car.position[1], lng: car.position[0],
      speedKmh: car.speed * 3.6, direction: car.lastRotation,
      distance: car.totalDistance, simTime,
    };
    (rawTelemetry[car.id] ??= []).push(row);
  }

} 