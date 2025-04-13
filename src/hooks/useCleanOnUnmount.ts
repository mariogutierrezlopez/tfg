import { useEffect } from "react";

export const useCleanOnUnmount = (mapInstance: mapboxgl.Map | null) => {
  useEffect(() => {
    return () => {
      mapInstance?.remove();
    };
  }, [mapInstance]);
};
