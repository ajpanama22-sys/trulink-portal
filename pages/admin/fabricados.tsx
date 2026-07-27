import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CotizacionAprobada {
  id: string;
  id_cotizacion?: string;
  cliente: string;
  monto_total: number;
  monto_pagado: number;
  porcentaje_pago: number;
  detalles: string;
}

export default function Fabricados() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModalModalOF, setMostrarModalOF] = useState(false);

  // Lista de cotizaciones aprobadas para amarrar la nueva OF
  const [cotizacionesAprobadas, setCotizacionesAprobadas] = useState<CotizacionAprobada[]>([]);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<CotizacionAprobada | null>(null);
  const [porcentajeRequerido, setPorcentajeRequerido] = useState<number>(50); // % mínimo para liberar
  const [productoLote, setProductoLote] = useState("");
  const [cantidadProceso, setCantidadProceso] = useState("");

  useEffect(() => {
    cargarOrdenesFabricacion();
    cargarCotizacionesAprobadas();
  }, []);

  const cargarOrdenesFabricacion = async () => {
    if (!supabase) return;
    setCargando(true);
    try {
      const { data, error } = await supabase.from("ordenes_fabricacion").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        setOrdenes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const cargarCotizacionesAprobadas = async () => {
    if (!supabase) return;
    try {
      // Filtrar cotizaciones/órdenes de compra con estado aprobado y % pago
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .or("estado.eq.Aprobada,estado.eq.Aprobado,estado.eq.Pagado");

      if (!error && data) {
        const mapeadas: CotizacionAprobada[] = data.map((q) => {
          const total = q.monto_total || q.total || 1000;
          const pagado = q.monto_pagado || (q.estado === "Pagado" ? total : total * 0.5);
          const pct = Math.round((pagado / total) * 100);
          return {
            id: q.id,
            id_cotizacion: q.id_cotizacion || q.sku || `COT-${q.id.substring(0, 5)}`,
            cliente: q.cliente || "Cliente General",
            monto_total: total,
            monto_pagado: pagado,
            porcentaje_pago: pct,
            detalles: q.descripcion || q.detalles || "Fabricación de Cable Óptico"
          };
        });
        setCotizacionesAprobadas(mapeadas);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCrearOrdenFabricacion = async () => {
    if (!cotizacionSeleccionada) {
      alert("Debes seleccionar una Cotización Aprobada.");
      return;
    }

    if (cotizacionSeleccionada.porcentaje_pago < porcentajeRequerido) {
      alert(`No se puede generar la Orden de Fabricación. El pago actual es del ${cotizacionSeleccionada.porcentaje_pago}% y el mínimo requerido es ${porcentajeRequerido}%.`);
      return;
    }

    if (!productoLote.trim() || !cantidadProceso.trim()) {
      alert("Por favor completa los detalles del producto y la cantidad.");
      return;
    }

    const nuevaOF = {
      orden_ensamblado: `OF-2026-${Math.floor(100 + Math.random() * 900)}`,
      cotizacion_id: cotizacionSeleccionada.id,
      producto_lote: productoLote,
      cantidad_en_proceso: cantidadProceso,
      etapa_planta: "Extrusión y Preparación",
      estado: "EN PROCESO",
      porcentaje_pago_validado: cotizacionSeleccionada.porcentaje_pago
    };

    if (supabase) {
      try {
        const { error } = await supabase.from("ordenes_fabricacion").insert([nuevaOF]);
        if (error) throw error;
        alert("Orden de Fabricación generada correctamente.");
        setMostrarModalOF(false);
        cargarOrdenesFabricacion();
      } catch (err: any) {
        // Fallback local si la tabla aún no existe
        setOrdenes([nuevaOF, ...ordenes]);
        alert("Orden registrada localmente.");
        setMostrarModalOF(false);
      }
    }
  };

  return (
    <div style={cardBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", textTransform: "uppercase" }}>
            INVENTARIO DE FABRICACIÓN (WIP - WORK IN PROGRESS)
          </h2>
          <p style={{ color: "#aaa", fontSize: "0.8rem" }}>
            Lotes en proceso de extrusión, aconectorización y control de calidad en planta.
          </p>
        </div>
        <button onClick={() => setMostrarModalOF(true)} style={btnAccion}>
          + NUEVA ORDEN DE FABRICACIÓN
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.4)", backgroundColor: "#000", color: "#DAA520" }}>
            <th style={thStyle}>ORDEN ENSAMBLADO</th>
            <th style={thStyle}>PRODUCTO / LOTE</th>
            <th style={thStyle}>CANTIDAD EN PROCESO</th>
            <th style={thStyle}>ETAPA DE PLANTA</th>
            <th style={thStyle}>ESTADO</th>
            <th style={thStyle}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.length === 0 ? (
            <>
              <tr style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: "#DAA520" }}>OF-2026-089</td>
                <td style={tdStyle}>Drop Flat 2 Hilos 1000m (Inyección Nylon)</td>
                <td style={tdStyle}>50 Bobinas</td>
                <td style={tdStyle}>Extrusión de Chaqueta</td>
                <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "bold" }}>EN PROCESO</td>
                <td style={tdStyle}><button style={btnAccionSmall}>Ver Progreso</button></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: "#DAA520" }}>OF-2026-092</td>
                <td style={tdStyle}>Patchcord SC/APC-SC/APC 3m</td>
                <td style={tdStyle}>1,000 Unidades</td>
                <td style={tdStyle}>Pulido y Test Óptico</td>
                <td style={{ ...tdStyle, color: "#2ecc71", fontWeight: "bold" }}>CONTROL CALIDAD</td>
                <td style={tdStyle}><button style={btnAccionSmall}>Ver Progreso</button></td>
              </tr>
            </>
          ) : (
            ordenes.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: "#DAA520" }}>{item.orden_ensamblado}</td>
                <td style={tdStyle}>{item.producto_lote}</td>
                <td style={tdStyle}>{item.cantidad_en_proceso}</td>
                <td style={tdStyle}>{item.etapa_planta}</td>
                <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "bold" }}>{item.estado}</td>
                <td style={tdStyle}><button style={btnAccionSmall}>Ver Progreso</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* MODAL NUEVA ORDEN DE FABRICACIÓN VINCULADA A COTIZACIÓN Y % PAGO */}
      {mostrarModalModalOF && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px", textTransform: "uppercase" }}>
              Nueva Orden de Fabricación
            </h3>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>1. Seleccionar Cotización / Orden de Compra *</label>
              <select
                onChange={(e) => {
                  const sel = cotizacionesAprobadas.find(c => c.id === e.target.value);
                  setCotizacionSeleccionada(sel || null);
                  if (sel) setProductoLote(sel.detalles);
                }}
                style={inputStyleFull}
              >
                <option value="">-- Selecciona Cotización Aprobada --</option>
                {cotizacionesAprobadas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id_cotizacion} - {c.cliente} (Pago: {c.porcentaje_pago}%)
                  </option>
                ))}
              </select>
            </div>

            {cotizacionSeleccionada && (
              <div style={{ padding: "10px", backgroundColor: "#111", borderRadius: "4px", marginBottom: "15px", border: "1px solid #333" }}>
                <p style={{ color: "#fff", fontSize: "0.8rem" }}><b>Cliente:</b> {cotizacionSeleccionada.cliente}</p>
                <p style={{ color: "#fff", fontSize: "0.8rem" }}><b>Total:</b> ${cotizacionSeleccionada.monto_total}</p>
                <p style={{ color: cotizacionSeleccionada.porcentaje_pago >= porcentajeRequerido ? "#2ecc71" : "#e74c3c", fontSize: "0.85rem", fontWeight: "bold" }}>
                  <b>Estado Pago:</b> {cotizacionSeleccionada.porcentaje_pago}% Pagado {cotizacionSeleccionada.porcentaje_pago < porcentajeRequerido ? "(Insumiciente para liberar)" : "(Aprobado para producción)"}
                </p>
              </div>
            )}

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>2. Mínimo % de Pago Requerido para Liberar</label>
              <input
                type="number"
                value={porcentajeRequerido}
                onChange={(e) => setPorcentajeRequerido(Number(e.target.value))}
                style={inputStyleFull}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>3. Producto / Lote a Fabricar</label>
              <input
                type="text"
                value={productoLote}
                onChange={(e) => setProductoLote(e.target.value)}
                placeholder="Ej. Cable ADSS 24 hilos Spool 4km"
                style={inputStyleFull}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>4. Cantidad Requerida</label>
              <input
                type="text"
                value={cantidadProceso}
                onChange={(e) => setCantidadProceso(e.target.value)}
                placeholder="Ej. 10 Bobinas de 4000m"
                style={inputStyleFull}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleCrearOrdenFabricacion} style={btnAccion}>LIBERAR ORDEN DE FABRICACIÓN</button>
              <button onClick={() => setMostrarModalOF(false)} style={btnSecundario}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardBox: React.CSSProperties = { backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "20px" };
const btnAccion: React.CSSProperties = { backgroundColor: "#DAA520", color: "#000", border: "none", borderRadius: "4px", padding: "8px 16px", fontWeight: "bold", cursor: "pointer", fontSize: "0.75rem" };
const btnSecundario: React.CSSProperties = { backgroundColor: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "4px", padding: "8px 16px", cursor: "pointer", fontSize: "0.75rem" };
const btnAccionSmall: React.CSSProperties = { backgroundColor: "transparent", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "3px", padding: "3px 6px", fontSize: "0.7rem", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "10px" };
const inputStyleFull: React.CSSProperties = { width: "100%", backgroundColor: "#000", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "4px", padding: "8px 12px", color: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "#DAA520", display: "block", marginBottom: "4px", textTransform: "uppercase" };
const modalOverlay: React.CSSProperties = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContent: React.CSSProperties = { backgroundColor: "#0a0a0a", border: "1px solid #DAA520", borderRadius: "8px", padding: "25px", width: "100%", maxWidth: "550px" };