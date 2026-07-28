import React from 'react';

export default function CuentasPorCobrar() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Pendiente por Cobrar</span>
          <h2 style={{ color: "#DAA520", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Cotizaciones y Facturas Pendientes</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Facturas Vencidas</span>
          <h2 style={{ color: "#e74c3c", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Mora superior a 30 días</span>
        </div>
      </div>

      <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", marginBottom: "15px", textTransform: "uppercase" }}>
        Gestión de Cuentas por Cobrar (CxC)
      </h3>

      <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520" }}>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>FACTURA / REF</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>CLIENTE</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>EMISIÓN</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>VENCIMIENTO</th>
              <th style={{ padding: "12px 15px", textAlign: "right" }}>MONTO TOTAL</th>
              <th style={{ padding: "12px 15px", textAlign: "right" }}>SALDO PENDIENTE</th>
              <th style={{ padding: "12px 15px", textAlign: "center" }}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                No existen facturas por cobrar registradas.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}