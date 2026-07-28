import React from 'react';

export default function ResumenTesoreria() {
  return (
    <div>
      {/* TARJETAS RESUMEN DE TESORERÍA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "30px" }}>
        
        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Total Ingresos</span>
          <h2 style={{ color: "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Facturación y NDs</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Total Egresos / Gastos</span>
          <h2 style={{ color: "#e74c3c", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Proveedores, Operación y NCs</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Utilidad Neta Operativa</span>
          <h2 style={{ color: "#DAA520", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Balance P&L Real</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Cuentas Bancarias</span>
          <h2 style={{ color: "#3498db", margin: "8px 0 4px 0", fontSize: "1.2rem" }}>Wise / ACH Local</h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Cuentas Activas EE.UU. / PA</span>
        </div>

      </div>

      {/* TABLA DE MOVIMIENTOS */}
      <div>
        <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", marginBottom: "15px", textTransform: "uppercase" }}>
          Últimos Movimientos de Tesorería
        </h3>

        <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520" }}>
                <th style={{ padding: "12px 15px", textAlign: "left" }}>FECHA</th>
                <th style={{ padding: "12px 15px", textAlign: "left" }}>TIPO</th>
                <th style={{ padding: "12px 15px", textAlign: "left" }}>CATEGORÍA</th>
                <th style={{ padding: "12px 15px", textAlign: "left" }}>TERCERO / CLIENTE</th>
                <th style={{ padding: "12px 15px", textAlign: "left" }}>MÉTODO / REF.</th>
                <th style={{ padding: "12px 15px", textAlign: "right" }}>MONTO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                  No hay registros contables en sistema. Utiliza los botones superiores para registrar ingresos o egresos.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}