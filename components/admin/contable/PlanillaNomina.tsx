import React from 'react';

export default function PlanillaNomina() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Nómina Internacional Total</span>
          <h2 style={{ color: "#DAA520", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Honorarios y Dividendos de Equipo</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Colaboradores Activos</span>
          <h2 style={{ color: "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>0</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Personal y Contratistas</span>
        </div>
      </div>

      <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", marginBottom: "15px", textTransform: "uppercase" }}>
        Control de Planilla & Dividendos
      </h3>

      <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520" }}>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>COLABORADOR</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>CARGO / ROL</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>TIPO DE CONTRATO</th>
              <th style={{ padding: "12px 15px", textAlign: "right" }}>HONORARIOS / SALARIO</th>
              <th style={{ padding: "12px 15px", textAlign: "center" }}>ESTADO DE PAGO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                No hay registros de nómina activa.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}