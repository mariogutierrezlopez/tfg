import { useCallback } from "react";

export const useSearchSelection = (
  setOriginCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>,
  setDestinationCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>
) => {
  return useCallback((feature: GeoJSON.Feature, isOrigin: boolean) => {
    const coords =
      feature.geometry?.type === "Point"
        ? feature.geometry.coordinates
        : null;
    if (!coords) return;

    if (isOrigin) {
      setOriginCoords(coords as [number, number]);
    } else {
      setDestinationCoords(coords as [number, number]);
    }
  }, [setOriginCoords, setDestinationCoords]);
};
