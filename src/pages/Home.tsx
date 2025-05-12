import React, {useEffect} from "react";
import imagenLanding from "../assets/landing1.png";
import funciones1 from "../assets/funciones1.png";
import funciones2 from "../assets/funciones2.png";
import funciones3 from "../assets/funciones3.png";
import funciones4 from "../assets/funciones4.png";

import "./Home.css";
import HowItWorksSlider from "../components/organisms/howitworksslider/HowItWorksSlider";
import useFadeIn from "../hooks/useFadeIn";

const Home: React.FC = () => {
  const hero = useFadeIn();
  const funciones = useFadeIn();
  const slider = useFadeIn();

  //Declaración de los hooks para las funcionalidades
  // En react no se puede usar un array de hooks, por lo que se declaran uno a uno
  const fade1 = useFadeIn();
  const fade2 = useFadeIn();
  const fade3 = useFadeIn();
  const fade4 = useFadeIn();


  useEffect(() => {
    // bloquea scroll
    document.body.classList.add("noscroll");

    const timeout = setTimeout(() => {
      // lo libera tras animaciones (600ms aprox)
      document.body.classList.remove("noscroll");
      window.scrollTo(0, 0); // asegura que sigues en el top
    }, 800); // espera un poco más que la animación

    return () => clearTimeout(timeout);
  }, []);
  



  return (
    <div className="home-container">
      {/* ——— Navbar ——— */}
      <nav className="navbar-custom">
        <span className="navbar-title">Simulador</span>
        <a href="/simulador" className="btn-primary">
          Empezar
        </a>
      </nav>
  
      {/* ——— Hero ——— */}
      <section
        ref={hero.ref}
        className={`hero-section fade-in ${hero.isVisible ? "visible" : ""}`}
      >
        <h2 className="hero-title">
          Simula tus viajes de una manera sencilla
        </h2>
        <p className="hero-subtitle">
          Lorem ipsum describing the simplicity and accessibility of the
          platform, inspired by how travel was easier before the 1950s.
        </p>
        <img
          src={imagenLanding}
          alt="Mapa del simulador"
          className="hero-image"
        />
      </section>
  
      {/* ——— Funcionalidades ——— */}
      <section
        ref={funciones.ref}
        className={`funciones-section fade-in ${
          funciones.isVisible ? "visible" : ""
        }`}
      >
        <h3 className="section-title">Funciones</h3>
  
        <div className="funciones-scroll">
          {[funciones1, funciones2, funciones3, funciones4].map((img, idx) => {
            const titles = [
              "Simulación de ruta",
              "Configurador de escenarios",
              "Importar / Exportar rutas",
              "Presets de vehículos",
            ];
            const desc = "Lorem ipsum dolor sit amet.";
            const fades = [fade1, fade2, fade3, fade4];
            const fade = fades[idx];
  
            return (
              <div
                key={idx}
                ref={fade.ref}
                className={`card-funcion fade-in ${
                  fade.isVisible ? "visible" : ""
                }`}
                style={{ transitionDelay: `${idx * 0.2}s` }}
              >
                <img src={img} alt={titles[idx]} className="card-img" />
                <h4 className="card-title">{titles[idx]}</h4>
                <p className="card-desc">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>
  
      {/* ——— Cómo funciona (slider) ——— */}
      <div
        ref={slider.ref}
        className={`fade-in ${slider.isVisible ? "visible" : ""}`}
      >
        <HowItWorksSlider />
      </div>
    </div>
  );
  
};

export default Home;
