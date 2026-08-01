import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { theme } from "../../lib/theme";
import { Card, Heading, Button, inputStyle } from "../../lib/ui";

interface CotizacionAprobada {
  id: string;
  id_cotizacion?: string;
  cliente: string;
  monto_total: number;
  monto_pagado: number;
  porcentaje_pago: number;
  detalles: string;
}

interface AjusteFabricado {
  id: string;
  fecha: string;
  orden: string;
  producto: string;
  cantidadAnterior: string;
  cantidadNueva: string;
  motivo: string;
}

export default function Fabricados() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModalOF, setMostrarModalOF] = useState(false);

  // Estados de modales adicionales para Ajustes y Bitácora
  const [modalAjusteOpen, setModalAjusteOpen] = useState(false);
  const [modalDetalleAjustesOpen, setModalDetalleAjustesOpen] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState<any | null>(null);
  const [nuevaCantidadWIP, setNuevaCantidadWIP] = useState("");
  const [motivoWIP, setMotivoWIP] = useState("");
  const [bitacoraAjustesWIP, setBitacoraAjustesWIP] = useState<AjusteFabricado[]>([]);

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
            id_cotizacion: q.id_cotizacion || q.sku || `COT-${String(q.id).substring(0, 5)}`,
            cliente: q.cliente || "Cliente General",
            monto_total: total,
            monto_pagado: pagado,
            porcentaje_pago: pct,
            detalles: q.Descripción || q.descripcion || q.detalles || "Fabricación de Cable Óptico"
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

  const handleGuardarAjusteWIP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSeleccionado) return;

    const ajusteRegistro: AjusteFabricado = {
      id: `AJ-WIP-${Math.floor(100 + Math.random() * 900)}`,
      fecha: new Date().toISOString().split("T")[0],
      orden: itemSeleccionado.orden_ensamblado || itemSeleccionado.ordenEnsamblado,
      producto: itemSeleccionado.producto_lote || itemSeleccionado.productoLote,
      cantidadAnterior: itemSeleccionado.cantidad_en_proceso || itemSeleccionado.cantidadEnProceso,
      cantidadNueva: nuevaCantidadWIP,
      motivo: motivoWIP || "Ajuste de lote en planta"
    };

    setBitacoraAjustesWIP([ajusteRegistro, ...bitacoraAjustesWIP]);

    // Actualizar estado local
    setOrdenes(ordenes.map(item => {
      const idOrden = item.orden_ensamblado || item.ordenEnsamblado;
      const targetId = itemSeleccionado.orden_ensamblado || itemSeleccionado.ordenEnsamblado;
      if (idOrden === targetId) {
        return { ...item, cantidad_en_proceso: nuevaCantidadWIP, cantidadEnProceso: nuevaCantidadWIP };
      }
      return item;
    }));

    setModalAjusteOpen(false);
    setItemSeleccionado(null);
    setNuevaCantidadWIP("");
    setMotivoWIP("");
    alert("Ajuste de inventario WIP guardado exitosamente.");
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <Heading style={{ textTransform: "uppercase" }}>
            Inventario de Fabricación (WIP - Work in Progress)
          </Heading>
          <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>
            Lotes en proceso de extrusión, aconectorización y control de calidad en planta.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Button variant="gold" onClick={() => setMostrarModalOF(true)}>
            + NUEVA ORDEN DE FABRICACIÓN
          </Button>
          <Button variant="outline-gold" onClick={() => setModalDetalleAjustesOpen(true)}>
            Bitácora de Ajustes ({bitacoraAjustesWIP.length})
          </Button>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", color: theme.textLight, fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}`, backgroundColor: theme.background, color: theme.gold }}>
            <th style={thStyle}>ORDEN ENSAMBLADO</th>
            <th style={thStyle}>PRODUCTO / LOTE</th>
            <th style={thStyle}>CANTIDAD EN PROCESO</th>
            <th style={thStyle}>ETAPA DE PLANTA</th>
            <th style={thStyle}>ESTADO</th>
            <th style={thStyle}>ACCIONES / AJUSTES</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.length === 0 ? (
            <>
              <tr style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>OF-2026-089</td>
                <td style={tdStyle}>Drop Flat 2 Hilos 1000m (Inyección Nylon)</td>
                <td style={tdStyle}>50 Bobinas</td>
                <td style={tdStyle}>Extrusión de Chaqueta</td>
                <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>EN PROCESO</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <Button variant="outline-gold" style={smallBtnStyle}>Ver Progreso</Button>
                    <Button
                      variant="outline-gold"
                      style={smallBtnStyle}
                      onClick={() => {
                        const defaultItem = { orden_ensamblado: "OF-2026-089", producto_lote: "Drop Flat 2 Hilos 1000m (Inyección Nylon)", cantidad_en_proceso: "50 Bobinas" };
                        setItemSeleccionado(defaultItem);
                        setNuevaCantidadWIP("50 Bobinas");
                        setModalAjusteOpen(true);
                      }}
                    >
                      ⚙️ Ajustar
                    </Button>
                  </div>
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>OF-2026-092</td>
                <td style={tdStyle}>Patchcord SC/APC-SC/APC 3m</td>
                <td style={tdStyle}>1,000 Unidades</td>
                <td style={tdStyle}>Pulido y Test Óptico</td>
                <td style={{ ...tdStyle, color: theme.green, fontWeight: "bold" }}>CONTROL CALIDAD</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <Button variant="outline-gold" style={smallBtnStyle}>Ver Progreso</Button>
                    <Button
                      variant="outline-gold"
                      style={smallBtnStyle}
                      onClick={() => {
                        const defaultItem = { orden_ensamblado: "OF-2026-092", producto_lote: "Patchcord SC/APC-SC/APC 3m", cantidad_en_proceso: "1,000 Unidades" };
                        setItemSeleccionado(defaultItem);
                        setNuevaCantidadWIP("1,000 Unidades");
                        setModalAjusteOpen(true);
                      }}
                    >
                      ⚙️ Ajustar
                    </Button>
                  </div>
                </td>
              </tr>
            </>
          ) : (
            ordenes.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>{item.orden_ensamblado || item.ordenEnsamblado}</td>
                <td style={tdStyle}>{item.producto_lote || item.productoLote}</td>
                <td style={tdStyle}>{item.cantidad_en_proceso || item.cantidadEnProceso}</td>
                <td style={tdStyle}>{item.etapa_planta || item.etapaPlanta || "Extrusión y Preparación"}</td>
                <td style={{ ...tdStyle, color: item.estado === "CONTROL CALIDAD" ? "#f1c40f" : theme.green, fontWeight: "bold" }}>
                  {item.estado}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <Button variant="outline-gold" style={smallBtnStyle}>Ver Progreso</Button>
                    <Button
                      variant="outline-gold"
                      style={smallBtnStyle}
                      onClick={() => {
                        setItemSeleccionado(item);
                        setNuevaCantidadWIP(item.cantidad_en_proceso || item.cantidadEnProceso || "");
                        setModalAjusteOpen(true);
                      }}
                    >
                      ⚙️ Ajustar
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* MODAL NUEVA ORDEN DE FABRICACIÓN VINCULADA A COTIZACIÓN Y % PAGO */}
      {mostrarModalOF && (
        <div style={modalOverlay}>
          <Card style={{ width: "100%", maxWidth: "550px", marginBottom: 0 }}>
            <Heading style={{ textTransform: "uppercase" }}>
              Nueva Orden de Fabricación
            </Heading>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>1. Seleccionar Cotización / Orden de Compra *</label>
              <select
                onChange={(e) => {
                  const sel = cotizacionesAprobadas.find(c => c.id === e.target.value);
                  setCotizacionSeleccionada(sel || null);
                  if (sel) setProductoLote(sel.detalles);
                }}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
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
              <div style={{ padding: "10px", backgroundColor: theme.inputBg, borderRadius: theme.radiusSm, marginBottom: "15px", border: `1px solid ${theme.borderGoldLight}` }}>
                <p style={{ color: theme.textLight, fontSize: "0.8rem" }}><b>Cliente:</b> {cotizacionSeleccionada.cliente}</p>
                <p style={{ color: theme.textLight, fontSize: "0.8rem" }}><b>Total:</b> ${cotizacionSeleccionada.monto_total}</p>
                <p style={{ color: cotizacionSeleccionada.porcentaje_pago >= porcentajeRequerido ? theme.green : theme.red, fontSize: "0.85rem", fontWeight: "bold" }}>
                  <b>Estado Pago:</b> {cotizacionSeleccionada.porcentaje_pago}% Pagado {cotizacionSeleccionada.porcentaje_pago < porcentajeRequerido ? "(Insuficiente para liberar)" : "(Aprobado para producción)"}
                </p>
              </div>
            )}

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>2. Mínimo % de Pago Requerido para Liberar</label>
              <input
                type="number"
                value={porcentajeRequerido}
                onChange={(e) => setPorcentajeRequerido(Number(e.target.value))}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>3. Producto / Lote a Fabricar</label>
              <input
                type="text"
                value={productoLote}
                onChange={(e) => setProductoLote(e.target.value)}
                placeholder="Ej. Cable ADSS 24 hilos Spool 4km"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>4. Cantidad Requerida</label>
              <input
                type="text"
                value={cantidadProceso}
                onChange={(e) => setCantidadProceso(e.target.value)}
                placeholder="Ej. 10 Bobinas de 4000m"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="gold" onClick={handleCrearOrdenFabricacion}>LIBERAR ORDEN DE FABRICACIÓN</Button>
              <Button variant="outline-gold" onClick={() => setMostrarModalOF(false)}>CANCELAR</Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL AJUSTE DE LOTE WIP */}
      {modalAjusteOpen && itemSeleccionado && (
        <div style={modalOverlay}>
          <Card style={{ width: "100%", maxWidth: "550px", marginBottom: 0 }}>
            <Heading>Ajustar Lote: {itemSeleccionado.orden_ensamblado || itemSeleccionado.ordenEnsamblado}</Heading>
            <p style={{ color: theme.textMuted, fontSize: "0.8rem", marginBottom: "15px" }}>
              Producto: {itemSeleccionado.producto_lote || itemSeleccionado.productoLote} <br />
              Cantidad Actual: <strong style={{ color: theme.green }}>{itemSeleccionado.cantidad_en_proceso || itemSeleccionado.cantidadEnProceso}</strong>
            </p>
            <form onSubmit={handleGuardarAjusteWIP}>
              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Nueva Cantidad / Unidades:</label>
                <input
                  type="text"
                  value={nuevaCantidadWIP}
                  onChange={e => setNuevaCantidadWIP(e.target.value)}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Motivo del Ajuste (Bitácora):</label>
                <input
                  type="text"
                  placeholder="Ej. Merma por corte de prueba / Reasignación de lote"
                  value={motivoWIP}
                  onChange={e => setMotivoWIP(e.target.value)}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <Button type="button" variant="outline-gold" onClick={() => setModalAjusteOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="gold">Guardar Ajuste</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL BITÁCORA DE AJUSTES WIP */}
      {modalDetalleAjustesOpen && (
        <div style={modalOverlay}>
          <Card style={{ width: "750px", maxWidth: "90%", marginBottom: 0 }}>
            <Heading>Detalle de Ajustes de Fabricación (WIP)</Heading>
            {bitacoraAjustesWIP.length === 0 ? (
              <p style={{ color: theme.textMuted, fontSize: "0.85rem", padding: "10px 0" }}>No hay registros de ajustes en lotes WIP en esta sesión.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: theme.textLight, fontSize: "0.8rem", marginBottom: "20px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}`, color: theme.gold }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Orden</th>
                    <th style={thStyle}>Producto</th>
                    <th style={thStyle}>Cant. Anterior</th>
                    <th style={thStyle}>Cant. Nueva</th>
                    <th style={thStyle}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {bitacoraAjustesWIP.map((adj, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                      <td style={tdStyle}>{adj.fecha}</td>
                      <td style={tdStyle}>{adj.orden}</td>
                      <td style={tdStyle}>{adj.producto}</td>
                      <td style={tdStyle}>{adj.cantidadAnterior}</td>
                      <td style={{ ...tdStyle, color: theme.green, fontWeight: "bold" }}>{adj.cantidadNueva}</td>
                      <td style={tdStyle}>{adj.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="outline-gold" onClick={() => setModalDetalleAjustesOpen(false)}>Cerrar</Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "10px", textAlign: "left" };
const smallBtnStyle: React.CSSProperties = { padding: "3px 6px", fontSize: "0.7rem" };
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: theme.gold, display: "block", marginBottom: "4px", textTransform: "uppercase" };
const modalOverlay: React.CSSProperties = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
