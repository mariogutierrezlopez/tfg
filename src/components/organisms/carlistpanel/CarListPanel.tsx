import React from "react";
import "./CarListPanel.css";
import { CarAgent } from "../../../logic/agents/CarAgents";

type Props = {
  cars: CarAgent[];
  selectedCarId: string | null;
  onSelect: (carId: string) => void;
};

const CarListPanel: React.FC<Props> = ({ cars, selectedCarId, onSelect }) => {
  return (
    <div className="car-list-panel">
      <h3>Coches en ruta</h3>
      <ul>
        {cars.map((car) => (
          <li
            key={car.id}
            className={car.id === selectedCarId ? "selected" : ""}
            onClick={() => onSelect(car.id)}
          >
            {car.carType.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CarListPanel;
