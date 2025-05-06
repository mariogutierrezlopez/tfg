import carIcon from "../assets/car-top-view.png";
import truckIcon from "../assets/truck-top-view.png";
import motorcycleIcon from "../assets/motorbike-top-view.png";
import { CarOption } from "../utils/types";

export const carOptions: CarOption[] = [
  { id: "car", name: "Coche", image: carIcon },
  { id: "truck", name: "Camión", image: truckIcon },
  { id: "motorcycle", name: "Moto", image: motorcycleIcon },
];
