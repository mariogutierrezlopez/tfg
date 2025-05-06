import { TrafficAgent } from "./TrafficAgent";
import { TrafficElement } from "../../utils/types";
import { point as turfPoint, lineString, distance as turfDistance, nearestPointOnLine } from "@turf/turf";
import distance from "@turf/distance";
import { CarOption } from "../../utils/types";

export class CarAgent extends TrafficAgent {
  maxSpeed: number;
  stopped = false;
  stopTimer = 0;
  carType: CarOption;
  lastRotation = 0;
  private processedRuleIds: Set<string> = new Set();
  private insideRoundaboutIds: Set<string> = new Set(); // 🆕 múltiples rotondas
  targetSpeed = 0;

  constructor(
    id: string,
    position: [number, number],
    route: [number, number][],
    marker: mapboxgl.Marker,
    carType: CarOption
  ) {
    super(id, position, route, marker, carType.id);
    this.maxSpeed = 0.1;
    this.acceleration = 0.1;
    this.carType = carType;
    this.targetSpeed = this.maxSpeed;
  }

  reactToTrafficRules(rules: TrafficElement[], others: CarAgent[]) {
    if (this.stopped) return;

    let shouldSlowDown = false;

    for (const rule of rules) {
      if (this.hasPassedRule(rule)) continue;

      const d = distance(turfPoint(this.position), turfPoint(rule.location), { units: "meters" });

      // ✅ RONDAS
      if (rule.type === "roundabout") {
        const isInside = d < rule.radius - 5;
      
        if (isInside) {
          this.insideRoundaboutIds.add(rule.id);
          this.processedRuleIds.add(rule.id);
          continue;
        }
      
        const isApproaching = d < rule.radius + 15;
      
        if (isApproaching && !this.insideRoundaboutIds.has(rule.id)) {
          const carsInside = others.filter(o => o.insideRoundaboutIds.has(rule.id));
        
          if (carsInside.length > 0) {
            if (!this.stopped) {
              this.stopped = true;
              this.stopTimer = 2; // Pausa de 2 segundos
              this.speed = 0;
              this.targetSpeed = 0;
            }
            return;
          } else {
            // Solo ralentizar si no hay nadie
            this.targetSpeed = Math.min(this.targetSpeed, 0.0004);
            shouldSlowDown = true;
          }
        }
        
        
        
      
        continue;
      }
      
      

      // 🚦 OTRAS REGLAS
      if (d < rule.radius + 15) {
        if (rule.priorityRule === "must-stop") {
          if (d < rule.radius && !this.processedRuleIds.has(rule.id)) {
            this.stopped = true;
            this.stopTimer = 2;
            this.speed = 0;
            this.processedRuleIds.add(rule.id);
            return;
          } else {
            this.targetSpeed = Math.min(this.targetSpeed, 0.0003);
            shouldSlowDown = true;
          }
        } else if (rule.priorityRule === "give-way") {
          this.targetSpeed = Math.min(this.targetSpeed, 0.0005);
          shouldSlowDown = true;
        }
      }
    }

    // Limpiar si ha salido de alguna rotonda
    for (const rule of rules) {
      if (rule.type === "roundabout" && this.insideRoundaboutIds.has(rule.id)) {
        const d = distance(turfPoint(this.position), turfPoint(rule.location), { units: "meters" });
        if (d > rule.radius + 10) {
          this.insideRoundaboutIds.delete(rule.id); // ya salió
        }
      }
    }

    if (!shouldSlowDown && this.targetSpeed < this.maxSpeed) {
      this.targetSpeed += this.acceleration * 0.5; // Aceleración progresiva
      this.targetSpeed = Math.min(this.targetSpeed, this.maxSpeed);
    }
    
  }

  hasPassedRule(rule: TrafficElement): boolean {
    if (this.route.length < 1) return false;
    const next = this.route[0];

if (
  !next ||
  !Array.isArray(next) || next.length !== 2 || isNaN(next[0]) || isNaN(next[1]) ||
  !Array.isArray(this.position) || this.position.length !== 2 || isNaN(this.position[0]) || isNaN(this.position[1]) ||
  !Array.isArray(rule.location) || rule.location.length !== 2 || isNaN(rule.location[0]) || isNaN(rule.location[1]) ||
  (this.position[0] === next[0] && this.position[1] === next[1]) // 👈 esta línea evita segmentos vacíos
  ) {
    console.warn("⚠️ Segmento inválido en hasPassedRule, se omite.");
    return false;
  }

  
    const seg = lineString([this.position, next]);
    const rulePt = turfPoint(rule.location);
    const snapped = nearestPointOnLine(seg, rulePt);
  
    const distToRule = turfDistance(turfPoint(this.position), rulePt, { units: "meters" });
    const distToSnapped = turfDistance(turfPoint(this.position), snapped, { units: "meters" });
  
    return distToSnapped > distToRule;
  }
  

  isInFront(other: CarAgent): boolean {
    const [lng1, lat1] = this.position;
    const [lng2, lat2] = other.position;

    const dirToOther = Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
    const myDirection = this.route.length >= 1
      ? Math.atan2(this.route[0][0] - lng1, this.route[0][1] - lat1) * (180 / Math.PI)
      : 0;

    const angleDiff = Math.abs(dirToOther - myDirection);
    return angleDiff < 60;
  }

  private isApproachingSameRoundaboutEntry(other: CarAgent, roundabout: TrafficElement): boolean {
    const myDist = distance(turfPoint(this.position), turfPoint(roundabout.location), { units: "meters" });
    const otherDist = distance(turfPoint(other.position), turfPoint(roundabout.location), { units: "meters" });
  
    // Ambos deben estar cerca, pero uno dentro y otro fuera
    const bothClose = myDist < roundabout.radius + 15 && otherDist < roundabout.radius + 15;
    const oneInside = this.insideRoundaboutIds.has(roundabout.id) !== other.insideRoundaboutIds.has(roundabout.id);
  
    return bothClose && oneInside;
  }
  

  updatePosition(dt: number) {
    if (this.stopped) {
      this.stopTimer -= dt;
      if (this.stopTimer <= 0) this.stopped = false;
      return;
    }

    // Suavizado hacia velocidad objetivo
    if (this.speed < this.targetSpeed) {
      this.speed = Math.min(this.targetSpeed, this.speed + this.acceleration * dt);
    } else if (this.speed > this.targetSpeed) {
      this.speed = Math.max(this.targetSpeed, this.speed - this.acceleration * dt);
    }

    const next = this.route[0];
    if (!next) return;

    const [lng1, lat1] = this.position;
    const [lng2, lat2] = next;
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxStep = this.speed * dt;

    if (dist === 0 && this.route.length > 1) {
      this.route.shift(); // salta al siguiente punto si está clavado
      return;
    }
    

    if (dist <= maxStep) {
      this.position = next;
      this.route.shift();
    } else {
      const ratio = maxStep / dist;
      this.position = [lng1 + dx * ratio, lat1 + dy * ratio];
    }

    const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
    const smoothed = this.lastRotation + (angle - this.lastRotation) * 0.2;
    this.lastRotation = smoothed;
    this.marker.setRotation(smoothed);
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
      const sharedRoundabouts = [...this.insideRoundaboutIds].filter(id => other.insideRoundaboutIds.has(id));
      if (sharedRoundabouts.length === 0 && this.insideRoundaboutIds.size > 0) {
        continue; // yo estoy dentro y el otro no => tengo prioridad
      }
  
      const dist = distance(turfPoint(this.position), turfPoint(other.position), { units: "meters" });
  
      if (dist < 8 && other.speed < 0.00005 && this.isInFront(other)) {
        this.targetSpeed = 0;
        shouldSlow = true;
        break;
      }
  
      if (dist < 10 && this.isInFront(other)) {
        this.targetSpeed = Math.min(this.targetSpeed, 0.0002);
        shouldSlow = true;
      } else if (dist < 20 && this.isInFront(other)) {
        this.targetSpeed = Math.min(this.targetSpeed, 0.0005);
        shouldSlow = true;
      }
    }
  
    if (!shouldSlow) {
      this.targetSpeed = this.maxSpeed;
    }
  }
  
}
