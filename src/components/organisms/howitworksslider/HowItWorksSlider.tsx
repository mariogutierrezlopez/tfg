import React, { useState, useEffect, useRef } from "react";
import paso1 from "../../../assets/funciones1.png";
import paso2 from "../../../assets/funciones2.png";
import paso3 from "../../../assets/funciones3.png";
import paso4 from "../../../assets/funciones4.png";
import paso5 from "../../../assets/funciones1.png";

import "./HowItWorksSlider.css";


const pasos = [
  {
    img: paso1,
    title: "1. Crear la ruta",
    desc: "Busca origen y destino, haz clic en el mapa o importa un CSV con el escenario.",
  },
  {
    img: paso2,
    title: "2. Seleccionar área",
    desc: "Delimita el área de simulación con un polígono para restringir rutas.",
  },
  {
    img: paso3,
    title: "3. Configurar vehículos",
    desc: "Asigna parámetros como velocidad máxima, aceleración o tipo de coche.",
  },
  {
    img: paso4,
    title: "4. Reproducir y analizar",
    desc: "Lanza la simulación, consulta estadísticas y modifica rutas en tiempo real.",
  },
  {
    img: paso5,
    title: "5. Exportar escenario",
    desc: "Guarda el escenario en CSV si cumple tus expectativas.",
  },
];

const HowItWorksSlider: React.FC = () => {
    const [current, setCurrent] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
    const nextSlide = () => {
      setCurrent((prev) => (prev + 1) % pasos.length);
    };
  
    const prevSlide = () => {
      setCurrent((prev) => (prev - 1 + pasos.length) % pasos.length);
    };
  
    useEffect(() => {
      intervalRef.current = setInterval(() => {
        nextSlide();
      }, 5000); // cambia de slide cada 5 segundos
  
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, []);
  
    return (
      <section className="como-funciona">
        <h3 className="section-title">¿Cómo funciona?</h3>
    
        <div className="slider-container">
          {/* Flecha izquierda */}
          <button className="arrow arrow-left" onClick={prevSlide}>
            ‹
          </button>
    
          {/* Imagen */}
          <img
            src={pasos[current].img}
            alt={pasos[current].title}
            className="slider-img"
          />
    
          {/* Flecha derecha */}
          <button className="arrow arrow-right" onClick={nextSlide}>
            ›
          </button>
    
          {/* Texto */}
          <div className="slider-text">
            <h4>{pasos[current].title}</h4>
            <p>{pasos[current].desc}</p>
          </div>
    
          {/* Dots */}
          <div className="slider-dots">
            {pasos.map((_, idx) => (
              <span
                key={idx}
                className={`dot ${idx === current ? "active" : ""}`}
                onClick={() => setCurrent(idx)}
              />
            ))}
          </div>
        </div>
      </section>
    );
    
  };
  
  export default HowItWorksSlider;
