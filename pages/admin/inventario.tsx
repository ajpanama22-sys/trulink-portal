import React, { useState } from "react";
import Sidebar from "../../components/Sidebar"; // Asegúrate de ajustar la ruta si tu Sidebar está en otra carpeta
import MateriaPrima from "./materiaprima";
import Fabricados from "./fabricados";
import Bodega from "./bodega";

type SubModuloInventario = "materiaprima" | "fabricados" | "bodega";

export default function Inventario() {
  const [subModuloActivo, setSubModuloActivo] = useState<SubModuloInventario>("bodega");

  return (
    <div style={{ display: "flex", backgroundColor: "#000000", minHeight: "100vh" }}>
      {/* SIDEBAR FIJO A LA IZQUIERDA */}
      <Sidebar currentActive="inventario" />

      {/* CONTENEDOR PRINCIPAL A LA DERECHA */}
      <main style={{ flex: 1, padding: "30px", boxSizing: "border-box", overflowX: "auto", color: "#fff" }}>
        
        {/* ENCABEZADO Y NAVEGACIÓN INTERNA */}
        <div style={{ marginBottom: "25px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "20px" }}>
          <h1 style={{ fontSize: "1.8rem", color: "#DAA520", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
            Módulo de Inventarios
          </h1>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "20px" }}>
            Gestión centralizada de materia prima, procesos de ensamble en planta y catálogo de bodega.
          </p>

          {/* NAVEGACIÓN DE SUBPÁGINAS */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => setSubModuloActivo("materiaprima")}
              style={tabStyle(subModuloActivo === "materiaprima")}
            >
              📦 MATERIA PRIMA
            </button>

            <button
              onClick={() => setSubModuloActivo("fabricados")}
              style={tabStyle(subModuloActivo === "fabricados")}
            >
              ⚙️ FABRICADOS (WIP)
            </button>

            <button
              onClick={() => setSubModuloActivo("bodega")}
              style={tabStyle(subModuloActivo === "bodega")}
            >
              🏢 BODEGA / PRODUCTOS
            </button>
          </div>
        </div>

        {/* RENDERIZADO DINÁMICO DE SUBPÁGINAS */}
        <div>
          {subModuloActivo === "materiaprima" && <MateriaPrima />}
          {subModuloActivo === "fabricados" && <Fabricados />}
          {subModuloActivo === "bodega" && <Bodega />}
        </div>
      </main>
    </div>
  );
}

const tabStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? "#DAA520" : "#080808",
  color: isActive ? "#000" : "#DAA520",
  border: isActive ? "1px solid #DAA520" : "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "4px",
  padding: "10px 18px",
  fontWeight: "bold",
  fontSize: "0.8rem",
  cursor: "pointer",
  letterSpacing: "0.8px",
  transition: "all 0.2s ease"
});