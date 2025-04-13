import React from "react";
import { SearchBox } from "@mapbox/search-js-react";

interface InputFieldProps {
  value: string;
  onChange: (value: string) => void; // onChange es ahora una función que toma el texto como un argumento
  onRetrieve: (feature: GeoJSON.Feature) => void;
  placeholder: string;
}

const mapboxToken = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN;

const InputField: React.FC<InputFieldProps> = ({
  value,
  onChange,
  onRetrieve,
  placeholder,
}) => {
  return (
    <SearchBox
      accessToken={mapboxToken}
      options={{ language: "es", country: "ES" }}
      placeholder={placeholder}
      value={value}  // Usamos el valor recibido desde el estado
      onChange={(e) => onChange(e.target.value)}  // Llamamos onChange cuando el valor cambia
      onRetrieve={(result) => {
        if (result?.features?.[0]) {
          onRetrieve(result.features[0]);
        }
      }}
    />
  );
};

export default InputField;
