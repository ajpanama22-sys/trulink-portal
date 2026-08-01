import { useState } from "react";
import Sidebar from "./Sidebar";
import MateriaPrima from "./materiaprima";
import Fabricados from "./fabricados";
import Bodega from "./bodega";
import { pageWrapStyle } from "../../lib/theme";
import { PageHeader, Button } from "../../lib/ui";

type SubModuloInventario = "materiaprima" | "fabricados" | "bodega";

export default function Inventario() {
  const [subModuloActivo, setSubModuloActivo] = useState<SubModuloInventario>("bodega");

  return (
    <div style={{ display: "flex" }}>
      {/* SIDEBAR FIJO A LA IZQUIERDA */}
      <Sidebar currentActive="inventario" />

      {/* CONTENEDOR PRINCIPAL A LA DERECHA */}
      <div style={pageWrapStyle()}>
        <PageHeader
          title="Módulo de Inventarios"
          subtitle="Gestión centralizada de materia prima, procesos de ensamble en planta y catálogo de bodega."
        />

        {/* NAVEGACIÓN DE SUBPÁGINAS */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          <Button
            variant={subModuloActivo === "materiaprima" ? "gold" : "outline-gold"}
            onClick={() => setSubModuloActivo("materiaprima")}
          >
            📦 MATERIA PRIMA
          </Button>

          <Button
            variant={subModuloActivo === "fabricados" ? "gold" : "outline-gold"}
            onClick={() => setSubModuloActivo("fabricados")}
          >
            ⚙️ FABRICADOS (WIP)
          </Button>

          <Button
            variant={subModuloActivo === "bodega" ? "gold" : "outline-gold"}
            onClick={() => setSubModuloActivo("bodega")}
          >
            🏢 BODEGA / PRODUCTOS
          </Button>
        </div>

        {/* RENDERIZADO DINÁMICO DE SUBPÁGINAS */}
        <div>
          {subModuloActivo === "materiaprima" && <MateriaPrima />}
          {subModuloActivo === "fabricados" && <Fabricados />}
          {subModuloActivo === "bodega" && <Bodega />}
        </div>
      </div>
    </div>
  );
}
