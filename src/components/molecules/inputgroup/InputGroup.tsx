import React from "react";
import { Feature, Geometry } from "geojson";
import InputField from "../../atoms/inputfield/InputField";

interface InputGroupProps {
  originText: string;
  destinationText: string;
  setOriginText: (text: string) => void;
  setDestinationText: (text: string) => void;
  handleSearchSelection: (feature: Feature<Geometry>, isOrigin: boolean) => void;
}

const InputGroup: React.FC<InputGroupProps> = ({
  originText,
  destinationText,
  setOriginText,
  setDestinationText,
  handleSearchSelection,
}) => {
  return (
    <>
      <InputField
        placeholder="Dirección de origen"
        value={originText}
        onChange={(value) => setOriginText(value)}  // Actualizamos el estado con el nuevo valor
        onRetrieve={(feature) => handleSearchSelection(feature, true)}
      />
      <InputField
        placeholder="Dirección de destino"
        value={destinationText}
        onChange={(value) => setDestinationText(value)}  // Actualizamos el estado con el nuevo valor
        onRetrieve={(feature) => handleSearchSelection(feature, false)}
      />
    </>
  );
};

export default InputGroup;
