import React from "react";
import { SearchBox } from "@mapbox/search-js-react";

interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onRetrieve={(result) => {
        if (result?.features?.[0]) {
          onRetrieve(result.features[0]);
        }
      }}
    />
  );
};

export default InputField;
