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


const CarSelectorPanel: React.FC<Props> = ({ carOptions, onSelectCar, selectedCar }) => {
    return (
        <div className="car-selector-panel">
            {carOptions.map((car) => (
                <div
                    key={car.id}
                    className={`car-option ${selectedCar?.id === car.id ? "selected" : ""}`}
                    onClick={() => onSelectCar(car)}
                >
                    <img
                        src={car.image}
                        alt={car.name}
                        className={`car-icon car-icon--${car.id}`}
                    />

                    <span>{car.name}</span>
                </div>

            ))}
        </div>
    );
};

export default CarSelectorPanel;
