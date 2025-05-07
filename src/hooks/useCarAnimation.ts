// hooks/useCarAnimator.ts
import { useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { point as turfPoint } from "@turf/helpers";
import distance from "@turf/distance";

const useCarAnimator = (map: mapboxgl.Map | null, carSpeedMps: number = 10) => {
  const [lastBearing, setLastBearing] = useState<number | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const createCarIcon = () => {
    const el = document.createElement("div");
    el.style.width = "36px";
    el.style.height = "60px";
    el.style.backgroundImage = `url(/car-top-view.png)`; // ✅ asegúrate de que esté accesible
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.zIndex = "1000";
    el.style.transformOrigin = "center center";
    return el;
  };

  const getBearing = (from: [number, number], to: [number, number]) =>
    Math.atan2(to[0] - from[0], to[1] - from[1]) * (180 / Math.PI);

  const animateCar = (
    coords: [number, number][],
    index: number = 0,
    marker: mapboxgl.Marker,
    stepSpeeds: number[] = []
  ) => {
    if (!map || index >= coords.length - 1) return;
  
    const start = coords[index];
    const end = coords[index + 1];
    const dist = distance(turfPoint(start), turfPoint(end), { units: "meters" });
  
    const speed = stepSpeeds[index] ?? carSpeedMps; // usa la del tramo o fallback
    const duration = (dist / speed) * 1000;
  
    const startTime = performance.now();
    const angle = getBearing(start, end);
    const smoothed = lastBearing !== null ? lastBearing + (angle - lastBearing) * 0.2 : angle;
  
    marker.setRotation(smoothed);
    setLastBearing(smoothed);
  
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const lng = start[0] + (end[0] - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;
  
      marker.setLngLat([lng, lat]);
  
      if (t < 1) requestAnimationFrame(step);
      else animateCar(coords, index + 1, marker, stepSpeeds);
    };
  
    requestAnimationFrame(step);
  };
  

  const start = (coords: [number, number][], stepSpeeds: number[] = []) => {
    setLastBearing(null);
    markerRef.current?.remove();
  
    const marker = new mapboxgl.Marker({
      element: createCarIcon(),
      rotationAlignment: "map",
      pitchAlignment: "map",
    })
      .setLngLat(coords[0])
      .addTo(map!);
  
    markerRef.current = marker;
    animateCar(coords, 0, marker, stepSpeeds);
  };
  

  return { start };
};

export default useCarAnimator;
