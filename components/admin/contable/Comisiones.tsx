import React, { useState } from 'react';

interface ReglaComision {
  rol: string;
  porcentaje: number;
  base: 'UTILIDAD_NETA' | 'VENTA_BRUTA' | 'MONTO_FIJO';
}

interface Bonificacion {
  id: string;
  colaborador: string;
  rol: string;
  tipoBono: 'NAVIDAD_FIN_ANO' | 'META_TRIMESTRAL' | 'PROYECTO_ESPECIAL' | 'EFICIENCIA_BODEGA';
  monto: number;
  fechaProgramada: string;
  estado: 'PROGRAMADO' | 'APROBADO' | 'PAGADO';
  notas: string;
}

export default function Comisiones() {
  const [subTab, setSubTab] = useState<'comisiones' | 'bonificaciones'>('comisiones');

  // Reglas de comisiones sobre utilidad
  const [reglas] = useState<ReglaComision[]>([
    { rol: 'Vendedores Directos', porcentaje: 10.0, base: 'UTILIDAD_NETA' },
    { rol: 'Equipo Administrativo', porcentaje: 2.5, base: 'UTILIDAD_NETA' },
    { rol: 'Planta & Bodega', porcentaje: 1.5, base: 'UTILIDAD_NETA' },
    { rol: 'Asociados / Partners', porcentaje: 5.0, base: 'UTILIDAD_NETA' },
    { rol: 'Dueños (Dividendos)', porcentaje: 25.0, base: 'UTILIDAD_NETA' },
  ]);

  // Registro de bonificaciones programadas
  const [bonificaciones] = useState<Bonificacion[]>([
    {
      id: 'BONO-001',
      colaborador: 'Equipo Operativo & Bodega',
      rol: 'Bodega / Logística',
      tipoBono: 'EFICIENCIA_BODEGA',
      monto: 500.00,
      fechaProgramada: '2026-09-30',
      estado: 'PROGRAMADO',
      notas: 'Bono por despacho 100% a tiempo y 0% reclamos Q3'
    },
    {
      id: 'BONO-002',
      colaborador: 'Personal General',
      rol: 'Toda la Plantilla',
      tipoBono: 'NAVIDAD_FIN_ANO',
      monto: 1500.00,
      fechaProgramada: '2026-12-18',
      estado: 'PROGRAMADO',
      notas: 'Bono Navideño y Cierre de Año (Bolsa de Reparto de Utilidad)'
    }
  ]);

  return (
    <div>
      {/* NAVEGACIÓN INTERNA DEL SUBMÓDULO */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setSubTab('comisiones')}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: subTab === 'comisiones' ? "1px solid #DAA520" : "1px solid #333",
            background: subTab === 'comisiones' ? "#DAA520" : "#111",
            color: subTab === 'comisiones' ? "#000" : "#DAA520",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "0.82rem"
          }}
        >
          📈 Comisiones por Utilidad de Venta
        </button>

        <button
          onClick={() => setSubTab('bonificaciones')}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: subTab === 'bonificaciones' ? "1px solid #DAA520" : "1px solid #333",
            background: subTab === 'bonificaciones' ? "#DAA520" : "#111",
            color: subTab === 'bonificaciones' ? "#000" : "#DAA520",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "0.82rem"
          }}
        >
          🎁 Bonificaciones, Metas & Feriados
        </button>
      </div>

      {/* MÉTRICAS CABECERA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Comisiones Liquidadas</span>
          <h2 style={{ color: "#DAA520", margin: "6px 0 2px 0", fontSize: "1.4rem" }}>$0.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.72rem" }}>Basado en margen real de ventas</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Bonos Programados (Año)</span>
          <h2 style={{ color: "#2ecc71", margin: "6px 0 2px 0", fontSize: "1.4rem" }}>$2,000.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.72rem" }}>Incluye Navidad y Metas Q3/Q4</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Reserva Fondo Navideño</span>
          <h2 style={{ color: "#e67e22", margin: "6px 0 2px 0", fontSize: "1.4rem" }}>$1,500.00 USD</h2>
          <span style={{ color: "#666", fontSize: "0.72rem" }}>Para pago en Diciembre</span>
        </div>
      </div>

      {/* VISTA 1: COMISIONES POR VENTA */}
      {subTab === 'comisiones' && (
        <>
          <div style={{ background: "#111", border: "1px solid rgba(218, 165, 32, 0.25)", borderRadius: "10px", padding: "20px", marginBottom: "25px" }}>
            <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              ⚙️ Porcentajes de Comisión sobre Utilidad Real (Ganancia Neta)
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>GRUPO / ROL</th>
                    <th style={{ padding: "10px" }}>PORCENTAJE ASIGNADO</th>
                    <th style={{ padding: "10px" }}>BASE DE CÁLCULO</th>
                    <th style={{ padding: "10px", textAlign: "center" }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {reglas.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px", fontWeight: "bold" }}>{r.rol}</td>
                      <td style={{ padding: "10px", color: "#DAA520", fontWeight: "bold" }}>{r.porcentaje}%</td>
                      <td style={{ padding: "10px", color: "#aaa" }}>Utilidad Real (Precio Venta − Costo Producto)</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <span style={{ background: "rgba(46, 204, 113, 0.15)", color: "#2ecc71", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold" }}>Activa</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VISTA 2: BONIFICACIONES & FERIADOS */}
      {subTab === 'bonificaciones' && (
        <div style={{ background: "#111", border: "1px solid rgba(218, 165, 32, 0.25)", borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ color: "#DAA520", margin: 0, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              🎄 Programación de Bonificaciones Estacionales & Desempeño
            </h3>
            <button style={{ background: "#DAA520", color: "#000", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
              + Programar Nuevo Bono
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>CÓDIGO</th>
                  <th style={{ padding: "10px" }}>BENEFICIARIO / GRUPO</th>
                  <th style={{ padding: "10px" }}>TIPO DE BONO</th>
                  <th style={{ padding: "10px" }}>FECHA PAGO</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>MONTO ($)</th>
                  <th style={{ padding: "10px", textAlign: "center" }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {bonificaciones.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px 10px", color: "#aaa" }}>{b.id}</td>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ fontWeight: "bold" }}>{b.colaborador}</div>
                      <div style={{ fontSize: "0.75rem", color: "#666" }}>{b.notas}</div>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        background: b.tipoBono === 'NAVIDAD_FIN_ANO' ? "rgba(231, 76, 60, 0.2)" : "rgba(52, 152, 219, 0.2)",
                        color: b.tipoBono === 'NAVIDAD_FIN_ANO' ? "#e74c3c" : "#3498db"
                      }}>
                        {b.tipoBono === 'NAVIDAD_FIN_ANO' ? '🎄 Navidad / Fin de Año' : '🎯 Eficiencia / KPI'}
                      </span>
                    </td>
                    <td style={{ padding: "12px 10px", color: "#aaa" }}>{b.fechaProgramada}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", color: "#DAA520", fontWeight: "bold" }}>
                      ${b.monto.toFixed(2)} USD
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "center" }}>
                      <span style={{ background: "rgba(241, 196, 15, 0.15)", color: "#f1c40f", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold" }}>
                        {b.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}