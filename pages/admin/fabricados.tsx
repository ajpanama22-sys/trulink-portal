import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { theme } from "../../lib/theme";
import { Card, Heading, Button, inputStyle } from "../../lib/ui";

const STOCK_INTERNO = "__STOCK_INTERNO__";

interface CotizacionAprobada {
  id: string;
  id_cotizacion?: string;
  referencia?: string | null;
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
  detalle: string;
  detalleAnterior: string;
  detalleNuevo: string;
  motivo: string;
}

// Color del badge de estado — ordenes_produccion solo maneja estos 4 valores.
function colorEstado(estado: string) {
  if (estado === "Completada") return theme.green;
  if (estado === "Cancelada") return theme.red;
  return theme.gold; // Planificada / En producción
}

export default function Fabricados() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModalOF, setMostrarModalOF] = useState(false);

  // Estados de modales adicionales para Ajustes y Bitácora
  const [modalAjusteOpen, setModalAjusteOpen] = useState(false);
  const [modalDetalleAjustesOpen, setModalDetalleAjustesOpen] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState<any | null>(null);
  const [nuevoDetalleWIP, setNuevoDetalleWIP] = useState("");
  const [motivoWIP, setMotivoWIP] = useState("");
  const [bitacoraAjustesWIP, setBitacoraAjustesWIP] = useState<AjusteFabricado[]>([]);

  // Lista de cotizaciones aprobadas para amarrar la nueva orden (opcional: puede ser stock interno)
  const [cotizacionesAprobadas, setCotizacionesAprobadas] = useState<CotizacionAprobada[]>([]);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<CotizacionAprobada | null>(null);
  const [stockInterno, setStockInterno] = useState(false);
  const [porcentajeRequerido, setPorcentajeRequerido] = useState<number>(50); // % mínimo para liberar (solo aplica si hay cliente)
  const [productoLote, setProductoLote] = useState("");
  const [cantidadProceso, setCantidadProceso] = useState("");
  const [errorOF, setErrorOF] = useState<string | null>(null);
  const [guardandoOF, setGuardandoOF] = useState(false);

  useEffect(() => {
    cargarOrdenesFabricacion();
    cargarCotizacionesAprobadas();
  }, []);

  // Solo muestra lo que esta pantalla crea: configuracion_id null la distingue
  // de las órdenes reales de Manufactura (que siempre traen configuracion_id).
  const cargarOrdenesFabricacion = async () => {
    if (!supabase) return;
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("ordenes_produccion")
        .select("*")
        .is("configuracion_id", null)
        .order("created_at", { ascending: false });
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
            referencia: q.referencia || null,
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

  const elegirCotizacion = (valor: string) => {
    if (valor === STOCK_INTERNO) {
      setStockInterno(true);
      setCotizacionSeleccionada(null);
      return;
    }
    setStockInterno(false);
    const sel = cotizacionesAprobadas.find((c) => c.id === valor);
    setCotizacionSeleccionada(sel || null);
    if (sel) setProductoLote(sel.detalles);
  };

  const cerrarModalOF = () => {
    setMostrarModalOF(false);
    setErrorOF(null);
  };

  const abrirModalOF = () => {
    setErrorOF(null);
    setCotizacionSeleccionada(null);
    setStockInterno(false);
    setProductoLote("");
    setCantidadProceso("");
    setPorcentajeRequerido(50);
    setMostrarModalOF(true);
  };

  const handleCrearOrdenFabricacion = async () => {
    setErrorOF(null);

    if (!cotizacionSeleccionada && !stockInterno) {
      alert("Elegí una Cotización Aprobada o \"Stock Interno (sin cliente)\".");
      return;
    }

    if (cotizacionSeleccionada && cotizacionSeleccionada.porcentaje_pago < porcentajeRequerido) {
      alert(`No se puede generar la orden. El pago actual es del ${cotizacionSeleccionada.porcentaje_pago}% y el mínimo requerido es ${porcentajeRequerido}%.`);
      return;
    }

    if (!productoLote.trim() || !cantidadProceso.trim()) {
      alert("Por favor completa los detalles del producto y la cantidad.");
      return;
    }

    if (!supabase) return;

    const notas = [
      `Producto: ${productoLote.trim()}`,
      `Cantidad: ${cantidadProceso.trim()}`,
      cotizacionSeleccionada ? `Pago validado: ${cotizacionSeleccionada.porcentaje_pago}%` : null,
    ].filter(Boolean).join(" | ");

    const nuevaOrden = {
      // Mismo criterio robusto de folio que usa manufactura.tsx (timestamp, no
      // Math.random()), con prefijo "OF-" para distinguir a simple vista que
      // nació en Fabricados/WIP y no en Manufactura.
      numero: `OF-${Date.now().toString().slice(-8)}`,
      quote_id: cotizacionSeleccionada ? String(cotizacionSeleccionada.id) : null,
      quote_referencia: cotizacionSeleccionada ? (cotizacionSeleccionada.referencia || null) : null,
      cliente_nombre: cotizacionSeleccionada ? cotizacionSeleccionada.cliente : null,
      // Nunca se completa: esta pantalla no tiene selector de configuración de
      // cable, y es justamente lo que la distingue de una orden real de
      // Manufactura (ver filtro en cargarOrdenesFabricacion y en despachos.tsx).
      configuracion_id: null,
      sku_destino: null,
      notas,
      // numero_hilos, carretes, km_totales, metros_por_carrete y estado no se
      // mandan: la tabla ya trae defaults (2, 1, 0, 1000, 'Planificada').
    };

    setGuardandoOF(true);
    try {
      const { error } = await supabase.from("ordenes_produccion").insert([nuevaOrden]).select().single();
      if (error) throw error;

      alert("Orden generada correctamente.");
      cerrarModalOF();
      cargarOrdenesFabricacion();
    } catch (err: any) {
      setErrorOF(err?.message || "No se pudo guardar la orden en la base de datos. Intenta nuevamente.");
    } finally {
      setGuardandoOF(false);
    }
  };

  const handleGuardarAjusteWIP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSeleccionado) return;

    const ajusteRegistro: AjusteFabricado = {
      id: `AJ-WIP-${Math.floor(100 + Math.random() * 900)}`,
      fecha: new Date().toISOString().split("T")[0],
      orden: itemSeleccionado.numero,
      detalleAnterior: itemSeleccionado.notas || "",
      detalleNuevo: nuevoDetalleWIP,
      detalle: nuevoDetalleWIP,
      motivo: motivoWIP || "Ajuste de lote en planta"
    };

    setBitacoraAjustesWIP([ajusteRegistro, ...bitacoraAjustesWIP]);

    // Actualizar estado local — igual que antes, este ajuste queda solo en la
    // sesión del navegador, no se persiste en Supabase.
    setOrdenes(ordenes.map((item) => {
      if (item.numero === itemSeleccionado.numero) {
        return { ...item, notas: nuevoDetalleWIP };
      }
      return item;
    }));

    setModalAjusteOpen(false);
    setItemSeleccionado(null);
    setNuevoDetalleWIP("");
    setMotivoWIP("");
    alert("Ajuste de inventario WIP guardado exitosamente (solo en esta sesión).");
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <Heading style={{ textTransform: "uppercase" }}>
            Inventario de Fabricación (WIP - Work in Progress)
          </Heading>
          <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>
            Lotes en proceso de extrusión, conectorización y control de calidad en planta.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Button variant="gold" onClick={abrirModalOF}>
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
            <th style={thStyle}>ORDEN</th>
            <th style={thStyle}>PRODUCTO / CANTIDAD</th>
            <th style={thStyle}>ORIGEN</th>
            <th style={thStyle}>ESTADO</th>
            <th style={thStyle}>ACCIONES / AJUSTES</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: theme.textMuted, padding: "24px 10px" }}>
                {cargando ? "Cargando órdenes..." : "No hay órdenes de fabricación registradas."}
              </td>
            </tr>
          ) : (
            ordenes.map((item, i) => (
              <tr key={item.id ?? i} style={{ borderBottom: "1px solid #111" }}>
                <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>{item.numero}</td>
                <td style={tdStyle}>{item.notas || "—"}</td>
                <td style={tdStyle}>
                  {item.quote_id ? (
                    <span style={{ color: theme.gold, fontSize: "0.75rem", fontWeight: "bold" }}>
                      🔗 Vinculado a cliente{item.cliente_nombre ? ` — ${item.cliente_nombre}` : ""}
                    </span>
                  ) : (
                    <span style={{ color: theme.textMuted, fontSize: "0.75rem", fontWeight: "bold" }}>
                      📦 Stock interno
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, color: colorEstado(item.estado), fontWeight: "bold" }}>
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
                        setNuevoDetalleWIP(item.notas || "");
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

      {/* MODAL NUEVA ORDEN DE FABRICACIÓN — vinculada a cliente o stock interno */}
      {mostrarModalOF && (
        <div style={modalOverlay}>
          <Card style={{ width: "100%", maxWidth: "550px", marginBottom: 0 }}>
            <Heading style={{ textTransform: "uppercase" }}>
              Nueva Orden de Fabricación
            </Heading>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>1. Cliente o Stock Interno *</label>
              <select
                onChange={(e) => elegirCotizacion(e.target.value)}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                defaultValue=""
              >
                <option value="">-- Selecciona una opción --</option>
                <option value={STOCK_INTERNO}>📦 Stock Interno (sin cliente vinculado)</option>
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

            {stockInterno && (
              <div style={{ padding: "10px", backgroundColor: theme.inputBg, borderRadius: theme.radiusSm, marginBottom: "15px", border: `1px solid ${theme.borderGoldLight}` }}>
                <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>
                  📦 Esta orden no queda vinculada a ningún cliente ni cotización — no se valida porcentaje de pago.
                </p>
              </div>
            )}

            {cotizacionSeleccionada && (
              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>2. Mínimo % de Pago Requerido para Liberar</label>
                <input
                  type="number"
                  value={porcentajeRequerido}
                  onChange={(e) => setPorcentajeRequerido(Number(e.target.value))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                />
              </div>
            )}

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

            {errorOF && (
              <p style={{ color: theme.red, fontSize: "0.8rem", marginBottom: "15px", border: `1px solid ${theme.redBorder}`, backgroundColor: theme.redBg, borderRadius: theme.radiusSm, padding: "8px 10px" }}>
                ⚠ No se pudo guardar la orden: {errorOF}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="gold" onClick={handleCrearOrdenFabricacion} disabled={guardandoOF}>
                {guardandoOF ? "GUARDANDO..." : "LIBERAR ORDEN DE FABRICACIÓN"}
              </Button>
              <Button variant="outline-gold" onClick={cerrarModalOF}>CANCELAR</Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL AJUSTE DE LOTE WIP */}
      {modalAjusteOpen && itemSeleccionado && (
        <div style={modalOverlay}>
          <Card style={{ width: "100%", maxWidth: "550px", marginBottom: 0 }}>
            <Heading>Ajustar Lote: {itemSeleccionado.numero}</Heading>
            <p style={{ color: theme.textMuted, fontSize: "0.8rem", marginBottom: "15px" }}>
              Detalle actual: <strong style={{ color: theme.green }}>{itemSeleccionado.notas || "—"}</strong>
            </p>
            <form onSubmit={handleGuardarAjusteWIP}>
              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Nuevo Detalle (Producto / Cantidad):</label>
                <input
                  type="text"
                  value={nuevoDetalleWIP}
                  onChange={e => setNuevoDetalleWIP(e.target.value)}
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
                    <th style={thStyle}>Detalle Anterior</th>
                    <th style={thStyle}>Detalle Nuevo</th>
                    <th style={thStyle}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {bitacoraAjustesWIP.map((adj, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                      <td style={tdStyle}>{adj.fecha}</td>
                      <td style={tdStyle}>{adj.orden}</td>
                      <td style={tdStyle}>{adj.detalleAnterior}</td>
                      <td style={{ ...tdStyle, color: theme.green, fontWeight: "bold" }}>{adj.detalleNuevo}</td>
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
