import { useCallback } from "react";


export const useSearchSelection = (
  setOriginCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>,
  setDestinationCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>
) => {
  return useCallback((feature: GeoJSON.Feature, isOrigin: boolean) => {
    if (
      feature.geometry?.type !== "Point" ||
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length !== 2 ||
      typeof feature.geometry.coordinates[0] !== "number" ||
      typeof feature.geometry.coordinates[1] !== "number"
    ) {
      console.warn("❌ Coordenadas inválidas en feature:", feature);
      return;
    }

    const coords = feature.geometry.coordinates as [number, number];

    if (isOrigin) {
      console.log("✔️ Origen seleccionado:", coords);
      setOriginCoords(coords);
    } else {
      console.log("✔️ Destino seleccionado:", coords);
      setDestinationCoords(coords);
    }
  }, [setOriginCoords, setDestinationCoords]);
};
