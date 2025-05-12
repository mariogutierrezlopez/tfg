import React from "react";
import "./CarSelectorPanel.css";

type CarOption = {
  id: string;
  name: string;
  image: string;
};

type Props = {
  carOptions: CarOption[];
  onSelectCar: (car: CarOption) => void;
  selectedCar?: CarOption | null;
};

const CarSelectorPanel: React.FC<Props> = ({
  carOptions,
  onSelectCar,
  selectedCar,
}) => (
  <div className="car-selector-panel">
    {carOptions.map((car) => (
      <div
        key={car.id}
        className={`car-option ${
          selectedCar?.id === car.id ? "selected" : ""
        }`}
        onClick={() => onSelectCar(car)}
      >
        {/* círculo con la imagen */}
        <div className="car-icon-wrapper">
          <img
            src={car.image}
            alt={car.name}
            className="car-icon"
          />
        </div>

        {/* nombre */}
        <span>{car.name}</span>
      </div>
    ))}
  </div>
);

export default CarSelectorPanel;
