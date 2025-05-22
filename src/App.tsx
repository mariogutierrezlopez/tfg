import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SimulatorPage from "./pages/SimulatorPage";
import './App.css';
import { RulesProvider } from "./context/rulesContext";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulador" element={
          <RulesProvider>
            <SimulatorPage />
          </RulesProvider>
        } />
      </Routes>
    </Router>
  );
};

export default App;
