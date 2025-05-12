import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SimulatorPage from "./pages/SimulatorPage";
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulador" element={<SimulatorPage />} />
      </Routes>
    </Router>
  );
};

export default App;
