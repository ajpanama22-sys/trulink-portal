import React from "react";

export default function Fabricados() {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", color: "#DAA520", textTransform: "uppercase" }}>
            Inventario de Fabricación (WIP - Work In Progress)
          </h2>
          <p style={{ color: "#777", fontSize: "0.8rem" }}>
            Lotes en proceso de extrusión, conectorización y control de calidad en planta.
          </p>
        </div>
        <button style={btnAccion}>+ NUEVA ORDEN DE FABRICACIÓN</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.4)", backgroundColor: "#000", color: "#DAA520", textAlign: "left" }}>
              <th style={thStyle}>Orden Ensamblado</th>
              <th style={thStyle}>Producto / Lote</th>
              <th style={thStyle}>Cantidad en Proceso</th>
              <th style={thStyle}>Etapa de Planta</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #111" }}>
              <td style={tdStyle}>OF-2026-089</td>
              <td style={tdStyle}>Drop Flat 2 Hilos 1000m (Inyección Nylon)</td>
              <td style={tdStyle}>50 Bobinas</td>
              <td style={tdStyle}>Extrusión de Chaqueta</td>
              <td style={tdStyle}><span style={{ color: "#f39c12", fontWeight: "bold" }}>EN PROCESO</span></td>
              <td style={tdStyle}><button style={btnAccionSmall}>Ver Progreso</button></td>
            </tr>
            <tr style={{ borderBottom: "1px solid #111" }}>
              <td style={tdStyle}>OF-2026-092</td>
              <td style={tdStyle}>Patchcord SC/APC-SC/APC 3m</td>
              <td style={tdStyle}>1,000 Unidades</td>
              <td style={tdStyle}>Pulido y Test Óptico</td>
              <td style={tdStyle}><span style={{ color: "#2ecc71", fontWeight: "bold" }}>CONTROL CALIDAD</span></td>
              <td style={tdStyle}><button style={btnAccionSmall}>Ver Progreso</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cardBox: React.CSSProperties = {
  backgroundColor: "#080808",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "8px",
  padding: "25px"
};

const btnAccion: React.CSSProperties = {
  backgroundColor: "#DAA520",
  color: "#000",
  border: "none",
  borderRadius: "4px",
  padding: "10px 18px",
  fontWeight: "bold",
  fontSize: "0.8rem",
  cursor: "pointer"
};

const btnAccionSmall: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#DAA520",
  border: "1px solid #DAA520",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "0.75rem",
  cursor: "pointer"
};

const thStyle: React.CSSProperties = { padding: "12px 15px", textTransform: "uppercase", fontSize: "0.75rem" };
const tdStyle: React.CSSProperties = { padding: "12px 15px" };