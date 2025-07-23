import { TrafficAgent } from "./TrafficAgent";
import { TrafficElement } from "../../utils/types";
import {
  point as turfPoint,
  lineString,
  distance as turfDistance,
  nearestPointOnLine,
  bearing,
  destination
} from "@turf/turf";
import distance from "@turf/distance";
import { CarOption } from "../../utils/types";
import { rawTelemetry, TelemetryRow } from "../../utils/telemetryStore";
import { evalTree, TreeNode } from "../../utils/decisionTree";


// Constantes de configuracion
// ------------------------------------------------
//Velocidad máxima de entrada a la rotonda
const ENTRY_LIMIT = 8.33;       // m/s
// Margen de seguridad entre coches
const EXTRA_MARGIN = 15;         // m

const MIN_STEP_DIST = 0.05; // Definir MIN_STEP_DIST aquí para que esté disponible en la clase


export class CarAgent extends TrafficAgent {
  maxSpeed: number;
  stopped = false;
  stopTimer = 0;
  carType: CarOption;
  lastRotation = 0;
  private processedRuleIds: Set<string> = new Set();
  public totalDistance = 0; // Initialized to 0, needs to be updated.
  public insideRoundaboutIds: Set<string> = new Set();
  targetSpeed = 0;
  currentStepSpeed: number = 0;
  prevPosition: [number, number];
  private decisionTree: TreeNode | null;
  public usingDecisionTree = false;

  public assignedLane: 'inner' | 'outer' | null = null;
  public isInsideRoundabout = false;
  public originalRoute: [number, number][] = [];
  public hasLaneBeenAssigned = false;
  public hasConstantSpeed: boolean;
  private prevIsInsideRoundabout = false;

  private roundaboutManeuverPathLength = 0;
  private postRoundaboutContinuationRoute: [number, number][] = [];

  public readonly initialPosition: [number, number];


  public features: {
    Lz: number;
    Cz: number;
    Rz: number;
    LL: number;
    RL: number;
    [key: string]: number;
  };

  public creationTime: number; // Nuevo


  constructor(
    id: string,
    position: [number, number],
    route: [number, number][],
    marker: mapboxgl.Marker,
    carType: CarOption,
    public stepSpeeds: number[] = [],
    decisionTree: TreeNode | null = null,
    hasConstantSpeed: boolean = false,
    creationTime = 0
  ) {
    super(id, position, route, marker, carType.id);
    this.maxSpeed = 100;
    this.targetSpeed = stepSpeeds[0] ?? this.maxSpeed;
    this.acceleration = 5; // Aceleración ajustada para un frenado más rápido
    this.carType = carType;
    this.prevPosition = [...position];
    this.decisionTree = hasConstantSpeed ? null : decisionTree;
    this.features = { Lz: 0, Cz: 0, Rz: 0, LL: 0, RL: 0 };
    this.originalRoute = [...route];
    this.hasConstantSpeed = hasConstantSpeed;
    this.prevIsInsideRoundabout = this.isInsideRoundabout;

    this.initialPosition = [...position];
    this.creationTime = creationTime;


    console.log(`LOG_AGENT (${this.id}): Constructor - Decision tree received:`, decisionTree ? 'Yes' : 'No', `hasConstantSpeed: ${hasConstantSpeed}`);
  }

  private getCurrentStepSpeed(): number {
    const idx = this.stepSpeeds.length - this.route.length;
    return this.stepSpeeds[Math.min(idx, this.stepSpeeds.length - 1)] ?? this.maxSpeed;
  }


  public assignRoundaboutLane(
    _innerLaneCoords: [number, number][],
    _outerLaneCoords: [number, number][],
    currentRoundaboutRule?: TrafficElement
  ) {
    if (this.hasLaneBeenAssigned || !currentRoundaboutRule?.geometry) {
      return;
    }
    console.log(`LOG_AGENT (${this.id}): Asignando ruta de maniobra de rotonda.`);

    // Simplemente usamos la geometría de la maniobra de la API como la nueva ruta.
    this.route = [...currentRoundaboutRule.geometry];
    this.hasLaneBeenAssigned = true;
  }

  public updatePosition(dt: number) {
    if (this.stopped) {
      this.speed = 0;
      this.targetSpeed = 0;
      return;
    }

    if (this.isInsideRoundabout !== this.prevIsInsideRoundabout) {
      console.log(`LOG_AGENT (${this.id}): isInsideRoundabout CAMBIÓ de ${this.prevIsInsideRoundabout} a ${this.isInsideRoundabout}.`);
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
      this.isInsideRoundabout = false; // If no route, cannot be in roundabout.
      return;
    }

    const next = this.route[0];
    const curPt = turfPoint(this.position);
    const nextPt = turfPoint(next);
    const distToNxt = turfDistance(curPt, nextPt, { units: "meters" });

    if (distToNxt < 0.5) {
      this.position = [...next];
      this.route.shift();

      // If was in maneuver, decrement the counter.
      if (this.roundaboutManeuverPathLength > 0) {
        this.roundaboutManeuverPathLength--;
        // If counter reaches zero, it means roundabout maneuver is complete.
        if (this.roundaboutManeuverPathLength === 0) {
          console.log(`LOG_AGENT (${this.id}): Roundabout maneuver completed. Exiting 'isInsideRoundabout' state.`);
          this.isInsideRoundabout = false;
          this.hasLaneBeenAssigned = false; // Ready for next roundabout.
        }
      }
    } else {
      const ang = bearing(curPt, nextPt);
      const stepLen = Math.max(this.speed * dt, MIN_STEP_DIST);
      const moved = destination(curPt, stepLen, ang, { units: "meters" });
      this.position = moved.geometry.coordinates as [number, number];
      this.totalDistance += stepLen / 1000; // Update total distance in kilometers
    }

    // Marker rotation update
    if (this.route.length > 0) {
      const rawBearingToNext = bearing(turfPoint(this.position), turfPoint(this.route[0]));
      this.marker.setRotation(rawBearingToNext);
    }
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
    const relevantRoundabout = rules.find(r => r.type === "roundabout");

    if (!relevantRoundabout) {
      this.targetSpeed = this.getCurrentStepSpeed();
      this.stopped = false;
      return;
    }

    const distToCenter = turfDistance(this.position, relevantRoundabout.location, { units: 'meters' });
    const entryThreshold = relevantRoundabout.radius + 2;  // Adjusted threshold to enter
    const exitThreshold = relevantRoundabout.radius + 25; // Wider threshold to exit

    const wasInside = this.isInsideRoundabout;

    // Can only enter if was outside and crosses entry threshold.
    if (!wasInside && distToCenter < entryThreshold) {
      this.isInsideRoundabout = true;
    }
    // Can only exit if was inside and crosses exit threshold.
    else if (wasInside && distToCenter > exitThreshold) {
      this.isInsideRoundabout = false;
    }

    if (wasInside !== this.isInsideRoundabout) {
      console.log(`LOG_AGENT (${this.id}): STATE_UPDATE - isInsideRoundabout changed from ${wasInside} to ${this.isInsideRoundabout} (Dist: ${distToCenter.toFixed(1)}m)`);
      if (!this.isInsideRoundabout) {
        this.hasLaneBeenAssigned = false;
      }
    }
    // --- END OF NEW DETECTION LOGIC ---

    // Decision logic remains the same, but now based on a reliable 'isInsideRoundabout' state.
    if (this.isInsideRoundabout) {
      this.targetSpeed = ENTRY_LIMIT;
      this.stopped = false;
      return;
    }

    const brakingDist = (this.speed * this.speed) / (2 * this.acceleration);
    const decisionDistance = brakingDist + relevantRoundabout.radius + EXTRA_MARGIN;

    if (this.decisionTree && distToCenter < decisionDistance) {
      const inputs = { Cz: this.features.Cz, RL: this.features.RL };
      const action = evalTree(this.decisionTree, inputs);

      if (action === "STOP") {
        this.targetSpeed = 0;
        this.stopped = true;
        this.stopTimer = 0.5;
      } else { // GO_AHEAD
        const anyCarInside = others.some(o => o.isInsideRoundabout);
        if (anyCarInside) {
          this.targetSpeed = ENTRY_LIMIT / 2;
          this.stopped = false;
        } else {
          this.targetSpeed = this.getCurrentStepSpeed();
          this.stopped = false;
        }
      }
    } else {
      this.targetSpeed = this.getCurrentStepSpeed();
      this.stopped = false;
    }
  }


  reactToOtherCars(others: CarAgent[]) {
    // If stopped or a "dumb" car (though now all are smart), does nothing.
    if (this.stopped) {
      return;
    }

    // Reset target speed to that calculated by traffic rules.
    this.targetSpeed = this.isInsideRoundabout ? ENTRY_LIMIT : this.getCurrentStepSpeed();

    for (const other of others) {
      if (other.id === this.id) continue;

      // Only reacts to cars in FRONT.
      if (this.isInFront(other)) {
        const distToOther = distance(turfPoint(this.position), turfPoint(other.position), { units: "meters" });

        // Dynamic safety distance: shorter in roundabouts, longer outside.
        const safetyDistance = this.isInsideRoundabout ? 10 : 20;

        if (distToOther < safetyDistance) {
          // Brake to match speed of car in front, never to accelerate.
          this.targetSpeed = Math.min(this.targetSpeed, other.speed);
        }
      }
    }
  }

  hasPassedRule(rule: TrafficElement): boolean {
    if (this.route.length < 1) return false;
    const next = this.route[0];

    if (!next || !Array.isArray(next) || next.length !== 2 || isNaN(next[0]) || isNaN(next[1]) ||
      !Array.isArray(this.position) || this.position.length !== 2 || isNaN(this.position[0]) || isNaN(this.position[1]) ||
      !Array.isArray(rule.location) || rule.location.length !== 2 || isNaN(rule.location[0]) || isNaN(rule.location[1]) ||
      (this.position[0] === next[0] && this.position[1] === next[1])) {
      console.warn("Invalid segment in hasPassedRule, skipping.");
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


  public maybeLog(car: CarAgent, simTime: number) {
    const row: TelemetryRow = {
      id: car.id, ts: Date.now(), lat: car.position[1], lng: car.position[0],
      speedKmh: car.speed * 3.6, direction: car.lastRotation,
      distance: car.totalDistance, simTime,
    };
    (rawTelemetry[car.id] ??= []).push(row);
  }

}