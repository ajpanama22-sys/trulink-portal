import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión directa a Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function CuentasPorCobrar() {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  // Cargar registros de la tabla 'cxc'
  useEffect(() => {
    async function cargarCxC() {
      setCargando(true);
      const { data, error } = await supabase
        .from('cxc')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar CxC:', error.message);
      } else if (data) {
        setCuentas(data);
      }
      setCargando(false);
    }

    cargarCxC();
  }, []);

  // Cálculos automáticos para los cuadros superiores
  const pendienteTotal = cuentas.reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0);
  
  const saldosPorRegularizar = cuentas
    .filter(item => item.estado === 'CLIENTE_ESPECIAL_PENDIENTE' || item.estado === 'PENDIENTE')
    .reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0);

  return (
    <div>
      {/* CUADROS SUPERIORES DE RESUMEN */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Pendiente por Cobrar</span>
          <h2 style={{ color: "#DAA520", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>
            ${pendienteTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Cotizaciones y Facturas Pendientes</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Saldos por Regularizar</span>
          <h2 style={{ color: "#e74c3c", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>
            ${saldosPorRegularizar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </h2>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Abonos pendientes y Clientes Especiales</span>
        </div>
      </div>

      <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", marginBottom: "15px", textTransform: "uppercase" }}>
        Gestión de Cuentas por Cobrar (CxC)
      </h3>

      {/* TABLA DE CUENTAS POR COBRAR */}
      <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520" }}>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>FACTURA / REF</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>CLIENTE</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>EMISIÓN</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>VENCIMIENTO / DESPACHO</th>
              <th style={{ padding: "12px 15px", textAlign: "right" }}>MONTO TOTAL</th>
              <th style={{ padding: "12px 15px", textAlign: "right" }}>SALDO PENDIENTE</th>
              <th style={{ padding: "12px 15px", textAlign: "center" }}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "#DAA520" }}>
                  Cargando información desde la base de datos...
                </td>
              </tr>
            ) : cuentas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                  No existen facturas por cobrar registradas.
                </td>
              </tr>
            ) : (
              cuentas.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", background: "#111111" }}>
                  {/* Ref */}
                  <td style={{ padding: "12px 15px", fontWeight: "bold", color: "#DAA520" }}>
                    {item.num_factura_ref}
                  </td>

                  {/* Cliente */}
                  <td style={{ padding: "12px 15px" }}>
                    <div>{item.cliente_nombre}</div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>{item.cliente_email}</div>
                  </td>

                  {/* Emisión */}
                  <td style={{ padding: "12px 15px", color: "#ccc" }}>
                    {item.fecha_emision ? new Date(item.fecha_emision).toLocaleDateString('es-PA') : '-'}
                  </td>

                  {/* Vencimiento / Despacho */}
                  <td style={{ padding: "12px 15px", color: "#ccc" }}>
                    {item.fecha_limite_segundo_pago 
                      ? new Date(item.fecha_limite_segundo_pago).toLocaleDateString('es-PA') 
                      : (item.fecha_estimada_despacho ? new Date(item.fecha_estimada_despacho).toLocaleDateString('es-PA') : 'Por definir')}
                  </td>

                  {/* Monto Total */}
                  <td style={{ padding: "12px 15px", textAlign: "right", fontWeight: "bold" }}>
                    ${Number(item.monto_total || 0).toFixed(2)}
                  </td>

                  {/* Saldo Pendiente */}
                  <td style={{ padding: "12px 15px", textAlign: "right", fontWeight: "bold", color: "#DAA520" }}>
                    ${Number(item.saldo_pendiente || 0).toFixed(2)}
                  </td>

                  {/* Estado Badge */}
                  <td style={{ padding: "12px 15px", textAlign: "center" }}>
                    {item.estado === 'PAGADO_TOTAL' && (
                      <span style={{ background: "rgba(46, 204, 113, 0.15)", color: "#2ecc71", border: "1px solid #2ecc71", padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
                        PAGADO 100%
                      </span>
                    )}
                    {item.estado === 'ABONADO_PARCIAL' && (
                      <span style={{ background: "rgba(218, 165, 32, 0.15)", color: "#DAA520", border: "1px solid #DAA520", padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
                        ABONO PARCIAL
                      </span>
                    )}
                    {item.estado === 'CLIENTE_ESPECIAL_PENDIENTE' && (
                      <span style={{ background: "rgba(52, 152, 219, 0.15)", color: "#3498db", border: "1px solid #3498db", padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
                        ESPECIAL (&lt;50%)
                      </span>
                    )}
                    {item.estado === 'PENDIENTE' && (
                      <span style={{ background: "rgba(231, 76, 60, 0.15)", color: "#e74c3c", border: "1px solid #e74c3c", padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
                        PENDIENTE
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}