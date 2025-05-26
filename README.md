# Simulador 2D de Conducción Autónoma para TFG

Este repositorio contiene el código fuente del Trabajo de Fin de Grado (TFG) enfocado en el desarrollo de un simulador 2D de conducción autónoma. El proyecto está construido con tecnologías web modernas y tiene como objetivo principal proporcionar un entorno accesible y escalable para la prueba y validación de algoritmos de navegación y toma de decisiones para vehículos.

## Descripción

El simulador permite a los usuarios definir rutas, configurar escenarios básicos y observar el comportamiento de agentes vehiculares que navegan por un mapa interactivo. Se ha puesto especial énfasis en la creación de una arquitectura modular que permita la fácil integración y prueba de diferentes lógicas de conducción, representadas actualmente mediante un sistema de árbol de decisiones cargado desde un fichero JSON.

La plataforma se integra con la API de Mapbox para la visualización de mapas y el cálculo de rutas, y ofrece herramientas para la visualización de estadísticas y la exportación de telemetría.

## Características Principales

* **Planificación y Visualización de Rutas:** Integración con Mapbox Directions API para calcular y dibujar rutas entre un origen y un destino.
* **Simulación de Agentes Vehiculares:** Implementación de agentes (`CarAgent.ts`) capaces de seguir rutas, gestionar su velocidad y orientación.
* **Lógica de Decisión Dinámica:** Sistema de toma de decisiones basado en un árbol de reglas (fichero JSON) que puede ser modificado y cargado dinámicamente para probar diferentes algoritMOS.
* **Control de Simulación:** Funcionalidades de Play/Pause y ajuste de la velocidad de simulación (1x, 2x, 4x).
* **Interfaz Gráfica Intuitiva:** Interfaz desarrollada con React, incluyendo componentes para la búsqueda de localizaciones, visualización del mapa y un panel de estadísticas.
* **Gestión de Escenarios:** Capacidad de importar escenarios y exportar la configuración actual de agentes a formato CSV.
* **Exportación de Telemetría:** Funcionalidad para registrar y exportar los datos de telemetría de los vehículos (posición, velocidad, etc.) en formato CSV.
* **Interacción Básica entre Vehículos:** Lógica inicial para la reacción entre dos vehículos, especialmente en aproximaciones a rotondas.

## Tecnologías Utilizadas

* **Frontend:** React, TypeScript
* **Mapas y Rutas:** Mapbox GL JS, Mapbox Directions API
* **Geoprocesamiento (cliente):** Turf.js (para cálculos de distancia, bearing, etc.)
* **Estilo:** CSS3 (con una estructura modular)
* **Control de Versiones:** Git y GitHub

## Estructura del Proyecto (Simplificada)

El proyecto sigue una estructura modular típica de aplicaciones React:

* `src/components/`: Contiene los componentes de React, organizados posiblemente siguiendo una metodología como Atomic Design (átomos, moléculas, organismos).
    * `organisms/`: Componentes más complejos que agrupan otros más pequeños.
* `src/hooks/`: Custom Hooks de React que encapsulan lógica reutilizable (ej. `useRouteCalculation.tsx`, `useCarManager.tsx`, `useSimulationLoop.tsx`).
* `src/logic/`: Clases y lógica de negocio principal.
    * `agents/`: Definición de los agentes de tráfico (ej. `CarAgent.ts`).
    * `roundaboutsDecisions/`: Lógica específica para la toma de decisiones (ej. `evalTree` para el árbol JSON).
* `src/utils/`: Funciones de utilidad (ej. `routeUtils.ts`, `csvUtils.ts`, `mapUtils.ts`, `telemetryStore.ts`).
* `src/constants/`: Constantes de la aplicación (ej. `carOptions.ts`).
* `src/context/`: (Si aplica) Contextos de React para la gestión de estado global (ej. `RulesContext.tsx`).

## Configuración y Puesta en Marcha

### Prerrequisitos

* Node.js (versión recomendada: LTS)
* npm o yarn

### Instalación

1.  Clona el repositorio:
    ```bash
    git clone [https://github.com/mariogutierrezlopez/tfg.git](https://github.com/mariogutierrezlopez/tfg.git)
    ```
2.  Navega al directorio del proyecto:
    ```bash
    cd tfg
    ```
3.  Instala las dependencias:
    ```bash
    npm install
    # o si usas yarn
    # yarn install
    ```
4.  **Configuración de Mapbox:**
    * Necesitarás una clave de acceso (Access Token) de Mapbox.
    * Crea un archivo `.env` en la raíz del proyecto.
    * Añade tu clave al archivo `.env` de la siguiente forma:
        ```env
        VITE_MAPBOXGL_ACCESS_TOKEN=tu_access_token_aqui
        ```
        (Nota: El prefijo `VITE_` es común si el proyecto usa Vite.js. Si usa Create React App, sería `REACT_APP_MAPBOXGL_ACCESS_TOKEN`).

### Ejecución

Para iniciar el simulador en modo de desarrollo:

```bash
npm run dev
# o si usas yarn
# yarn dev