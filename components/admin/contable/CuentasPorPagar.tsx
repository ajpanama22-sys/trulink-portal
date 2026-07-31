import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../../lib/supabaseClient";

/* ============================================================
   CUENTAS POR PAGAR — MÓDULO CONTABLE
   ------------------------------------------------------------
   Antes era una maqueta: los montos estaban escritos en cero
   dentro del código y la tabla siempre decía que no había nada.

   Ahora lee de cuentas_por_pagar y pagos_proveedor, las mismas
   tablas que alimenta el módulo de Proveedores. Las dos vistas
   muestran siempre lo mismo y no pueden contradecirse.

   Recordatorio contable: la deuda no nace al crear el proveedor,
   sino al recibir la mercancía. Por eso las cuentas aparecen
   solas cuando se recibe una orden de compra.
   ============================================================ */

type CuentaPagar = {
  id: number;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  orden_id: number | null;
  numero_factura: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  moneda: string | null;
  monto_total: number;
  saldo_pendiente: number;
  estado: string;
  notas: string | null;
};

type Pago = {
  id: number;
  cuenta_por_pagar_id: number;
  fecha: string;
  monto: number;
  metodo_pago: string | null;
  referencia: string | null;
  autor: string | null;
};

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hoyISO = () => new Date().toISOString().slice(0, 10);

const diasVencido = (f?: string | null): number => {
  if (!f) return 0;
  return Math.floor((new Date(hoyISO()).getTime() - new Date(f).getTime()) / 86400000);
};

const cubeta = (f?: string | null): string => {
  const d = diasVencido(f);
  if (d <= 0) return "Corriente";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "+90";
};

const COLOR: Record<string, string> = {
  Corriente: "#2ecc71", "1-30": "#f1c40f", "31-60": "#e67e22",
  "61-90": "#e74c3c", "+90": "#c0392b",
};

export default function CuentasPorPagar() {
  const supabase = getSupabase();

  const [cuentas, setCuentas] = useState<CuentaPagar[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("PENDIENTES");
  const [buscar, setBuscar] = useState("");

  const [modalPago, setModalPago] = useState<{ open: boolean; cuenta: CuentaPagar | null }>({ open: false, cuenta: null });
  const [form, setForm] = useState({ monto: 0, metodo_pago: "Transferencia", referencia: "", fecha: hoyISO(), autor: "" });
  const [guardando, setGuardando] = useState(false);

  const [detalle, setDetalle] = useState<number | null>(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [cRes, pRes] = await Promise.all([
        supabase.from("cuentas_por_pagar").select("*").order("fecha_vencimiento", { ascending: true }),
        supabase.from("pagos_proveedor").select("*").order("fecha", { ascending: false }),
      ]);
      if (cRes.error) console.error("cuentas_por_pagar (¿corriste el SQL?):", cRes.error.message);
      setCuentas(cRes.data || []);
      setPagos(pRes.data || []);
    } catch (err) {
      console.error("Error cargando cuentas por pagar:", err);
    } finally {
      setCargando(false);
    }
  };

  const abrirPago = (c: CuentaPagar) => {
    setModalPago({ open: true, cuenta: c });
    setForm({ monto: Number(c.saldo_pendiente), metodo_pago: "Transferencia", referencia: "", fecha: hoyISO(), autor: "" });
  };

  const registrarPago = async () => {
    const c = modalPago.cuenta;
    if (!c || !supabase) return;
    const monto = Number(form.monto) || 0;
    if (monto <= 0) return alert("El monto debe ser mayor a cero.");
    if (monto > Number(c.saldo_pendiente) + 0.01) {
      return alert(`El monto supera el saldo pendiente (${fmt(c.saldo_pendiente)}).`);
    }

    setGuardando(true);
    try {
      const { error } = await supabase.from("pagos_proveedor").insert([{
        cuenta_por_pagar_id: c.id, proveedor_id: c.proveedor_id, fecha: form.fecha,
        monto, metodo_pago: form.metodo_pago, referencia: form.referencia || null,
        autor: form.autor || null,
      }]);
      if (error) throw error;

      const nuevoSaldo = Number((Number(c.saldo_pendiente) - monto).toFixed(2));
      const estado = nuevoSaldo <= 0.009 ? "Pagada" : "Parcial";

      const { error: e2 } = await supabase.from("cuentas_por_pagar")
        .update({ saldo_pendiente: Math.max(0, nuevoSaldo), estado }).eq("id", c.id);
      if (e2) throw e2;

      try {
        await supabase.from("audit_log").insert([{
          accion: "pago_proveedor", entidad: "cuenta_por_pagar", entidad_id: String(c.id),
          detalle: `Pago de ${fmt(monto)} a ${c.proveedor_nombre}. Saldo: ${fmt(Math.max(0, nuevoSaldo))}.`,
          autor: form.autor || null,
        }]);
      } catch { /* la auditoría no frena el pago */ }

      setModalPago({ open: false, cuenta: null });
      cargar();
    } catch (err: any) {
      alert("Error al registrar el pago: " + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  /* ------------------ derivados ------------------ */

  const abiertas = cuentas.filter((c) => c.estado !== "Pagada" && c.estado !== "Anulada");
  const totalPendiente = abiertas.reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);
  const totalVencido = abiertas.filter((c) => diasVencido(c.fecha_vencimiento) > 0)
    .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);
  const proveedoresActivos = new Set(abiertas.map((c) => c.proveedor_id || c.proveedor_nombre)).size;
  const pagadoMes = pagos.filter((p) => (p.fecha || "").slice(0, 7) === hoyISO().slice(0, 7))
    .reduce((a, p) => a + Number(p.monto || 0), 0);

  const aging = useMemo(() => {
    const b: Record<string, number> = { Corriente: 0, "1-30": 0, "31-60": 0, "61-90": 0, "+90": 0 };
    abiertas.forEach((c) => { b[cubeta(c.fecha_vencimiento)] += Number(c.saldo_pendiente || 0); });
    return b;
  }, [cuentas]);

  /** Próximos 7 días: lo que hay que tener listo para pagar. */
  const porVencer = abiertas.filter((c) => {
    const d = diasVencido(c.fecha_vencimiento);
    return d <= 0 && d >= -7;
  });

  const filtradas = cuentas.filter((c) => {
    if (filtro === "PENDIENTES" && (c.estado === "Pagada" || c.estado === "Anulada")) return false;
    if (filtro === "VENCIDAS" && !(c.estado !== "Pagada" && c.estado !== "Anulada" && diasVencido(c.fecha_vencimiento) > 0)) return false;
    if (filtro === "PAGADAS" && c.estado !== "Pagada") return false;
    const q = buscar.toLowerCase().trim();
    if (!q) return true;
    return [c.numero_factura, c.proveedor_nombre].filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const pagosDe = (id: number) => pagos.filter((p) => p.cuenta_por_pagar_id === id);

  /* ------------------ render ------------------ */

  return (
    <div>
      <style jsx global>{`
        .cxp-in { background:#050505; color:#DAA520; border:1px solid rgba(218,165,32,0.4);
                  padding:9px 11px; border-radius:6px; outline:none; font-size:0.82rem;
                  box-sizing:border-box; font-family:inherit; }
        .cxp-lb { display:block; font-size:0.66rem; color:rgba(255,255,255,0.55); margin-bottom:5px;
                  text-transform:uppercase; letter-spacing:0.5px; }
        .cxp-btn { background:#DAA520; color:#000; border:none; padding:9px 16px; border-radius:6px;
                   font-weight:700; font-size:0.76rem; cursor:pointer; }
        .cxp-btn:disabled { opacity:.5; cursor:not-allowed; }
        .cxp-mini { background:transparent; color:#2ecc71; border:1px solid rgba(46,204,113,0.5);
                    padding:5px 11px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; white-space:nowrap; }
        .cxp-mini:hover { background:rgba(46,204,113,0.15); }
        .cxp-ghost { background:transparent; color:#888; border:1px solid #444; padding:5px 11px;
                     border-radius:5px; font-size:0.7rem; cursor:pointer; }
        .cxp-chip { padding:3px 9px; border-radius:10px; font-size:0.66rem; font-weight:600; }
      `}</style>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div style={kpi}>
          <span style={lbl}>Pendiente por Pagar</span>
          <h2 style={{ color: "#e74c3c", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(totalPendiente)}</h2>
          <span style={sub}>{abiertas.length} factura(s) abierta(s)</span>
        </div>
        <div style={kpi}>
          <span style={lbl}>Saldo Vencido</span>
          <h2 style={{ color: totalVencido > 0 ? "#c0392b" : "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(totalVencido)}</h2>
          <span style={sub}>{totalVencido > 0 ? "Requiere atención inmediata" : "Todo al día"}</span>
        </div>
        <div style={kpi}>
          <span style={lbl}>Proveedores con Saldo</span>
          <h2 style={{ color: "#3498db", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{proveedoresActivos}</h2>
          <span style={sub}>Cuentas de fábrica vinculadas</span>
        </div>
        <div style={kpi}>
          <span style={lbl}>Pagado Este Mes</span>
          <h2 style={{ color: "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(pagadoMes)}</h2>
          <span style={sub}>{pagos.filter((p) => (p.fecha || "").slice(0, 7) === hoyISO().slice(0, 7)).length} pago(s)</span>
        </div>
      </div>

      {/* Antigüedad de saldos */}
      <div style={{ background: "#111", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "20px", marginBottom: "22px" }}>
        <h3 style={{ color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", margin: "0 0 4px 0", letterSpacing: "0.8px" }}>
          Antigüedad de Saldos
        </h3>
        <p style={{ color: "#777", fontSize: "0.74rem", margin: "0 0 15px 0" }}>
          Cuánto debes y hace cuánto venció. Corriente todavía no vence; el resto son días de atraso.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
          {Object.entries(aging).map(([k, v]) => (
            <div key={k} style={{ background: "#080808", border: `1px solid ${COLOR[k]}44`, borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontSize: "0.64rem", color: "#888", textTransform: "uppercase", marginBottom: "5px" }}>
                {k === "Corriente" ? "Corriente" : `${k} días`}
              </div>
              <div style={{ color: COLOR[k], fontSize: "1.05rem", fontWeight: 700 }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerta de vencimientos próximos */}
      {porVencer.length > 0 && (
        <div style={{ background: "rgba(241,196,15,0.06)", border: "1px dashed rgba(241,196,15,0.4)",
          borderRadius: "10px", padding: "15px 20px", marginBottom: "22px" }}>
          <p style={{ color: "#f1c40f", fontSize: "0.8rem", margin: "0 0 8px 0", fontWeight: 600 }}>
            ⏰ Vencen en los próximos 7 días — {fmt(porVencer.reduce((a, c) => a + Number(c.saldo_pendiente), 0))}
          </p>
          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "0.75rem", color: "#bbb" }}>
            {porVencer.map((c) => (
              <span key={c.id}>
                {c.proveedor_nombre} · {fmt(c.saldo_pendiente)} ·{" "}
                <span style={{ color: "#f1c40f" }}>
                  {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString() : "—"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
        <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", margin: 0, textTransform: "uppercase" }}>
          Gestión de Cuentas por Pagar (CxP)
        </h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input className="cxp-in" style={{ width: "220px" }} placeholder="Buscar factura o proveedor..."
            value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <select className="cxp-in" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="PENDIENTES">Pendientes</option>
            <option value="VENCIDAS">Solo vencidas</option>
            <option value="PAGADAS">Pagadas</option>
            <option value="TODAS">Todas</option>
          </select>
          <button className="cxp-ghost" onClick={cargar}>↻</button>
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218,165,32,0.3)", color: "#DAA520" }}>
              <th style={th}>Orden / Ref</th>
              <th style={th}>Proveedor / Fábrica</th>
              <th style={th}>Fecha</th>
              <th style={th}>Vencimiento</th>
              <th style={{ ...th, textAlign: "right" }}>Monto Total</th>
              <th style={{ ...th, textAlign: "right" }}>Saldo Pendiente</th>
              <th style={{ ...th, textAlign: "center" }}>Estado</th>
              <th style={{ ...th, textAlign: "right" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "#777" }}>Cargando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                No hay cuentas de proveedores que coincidan con el filtro.
                <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "6px" }}>
                  Las cuentas por pagar se crean solas al recibir una orden de compra en Proveedores.
                </div>
              </td></tr>
            ) : (
              filtradas.map((c) => {
                const d = diasVencido(c.fecha_vencimiento);
                const cub = cubeta(c.fecha_vencimiento);
                const pagada = c.estado === "Pagada";
                const abonos = pagosDe(c.id);
                const abierto = detalle === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{ ...td, color: "#DAA520", fontWeight: 600 }}>
                        {c.numero_factura || `CXP-${c.id}`}
                        {c.orden_id && <div style={{ fontSize: "0.68rem", color: "#666" }}>OC #{c.orden_id}</div>}
                      </td>
                      <td style={td}>{c.proveedor_nombre || "—"}</td>
                      <td style={{ ...td, fontSize: "0.75rem", color: "#aaa" }}>
                        {new Date(c.fecha_emision).toLocaleDateString()}
                      </td>
                      <td style={{ ...td, fontSize: "0.75rem", color: d > 0 && !pagada ? "#e74c3c" : "#aaa" }}>
                        {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString() : "—"}
                        {!pagada && c.fecha_vencimiento && (
                          <div style={{ fontSize: "0.66rem", color: d > 0 ? "#c0392b" : "#777" }}>
                            {d > 0 ? `${d} días vencido` : `faltan ${Math.abs(d)} días`}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{fmt(c.monto_total)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: pagada ? "#2ecc71" : "#e74c3c" }}>
                        {fmt(c.saldo_pendiente)}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {pagada ? (
                          <span className="cxp-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>Pagada</span>
                        ) : (
                          <span className="cxp-chip" style={{ background: `${COLOR[cub]}22`, color: COLOR[cub], border: `1px solid ${COLOR[cub]}55` }}>
                            {c.estado === "Parcial" ? "Parcial" : cub === "Corriente" ? "Corriente" : `${cub} d`}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        {abonos.length > 0 && (
                          <button className="cxp-ghost" style={{ marginRight: "6px" }}
                            onClick={() => setDetalle(abierto ? null : c.id)}>
                            {abierto ? "▲" : "▼"} {abonos.length}
                          </button>
                        )}
                        {!pagada && <button className="cxp-mini" onClick={() => abrirPago(c)}>💵 Pagar</button>}
                      </td>
                    </tr>
                    {abierto && abonos.map((p) => (
                      <tr key={`p${p.id}`} style={{ background: "#080808", borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ ...td, fontSize: "0.72rem", color: "#666" }} colSpan={3}>
                          ↳ {new Date(p.fecha).toLocaleDateString()} · {p.metodo_pago || "—"}
                          {p.referencia ? ` · ${p.referencia}` : ""}
                        </td>
                        <td style={{ ...td, fontSize: "0.72rem", color: "#666" }} colSpan={2}>
                          {p.autor ? `Registrado por ${p.autor}` : ""}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: "#2ecc71", fontWeight: 600 }}>−{fmt(p.monto)}</td>
                        <td style={td} colSpan={2}></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ============ MODAL PAGO ============ */}
      {modalPago.open && modalPago.cuenta && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ color: "#2ecc71", marginTop: 0, fontSize: "1.05rem", textTransform: "uppercase" }}>Registrar Pago</h3>
            <p style={{ color: "#bbb", fontSize: "0.84rem", marginBottom: "18px" }}>
              {modalPago.cuenta.proveedor_nombre} — factura{" "}
              <strong style={{ color: "#DAA520" }}>{modalPago.cuenta.numero_factura || `CXP-${modalPago.cuenta.id}`}</strong>
              <br />
              <span style={{ fontSize: "0.78rem", color: "#888" }}>
                Saldo pendiente: <strong style={{ color: "#e74c3c" }}>{fmt(modalPago.cuenta.saldo_pendiente)}</strong>
              </span>
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div><label className="cxp-lb">Monto a pagar</label>
                <input className="cxp-in" style={{ width: "100%" }} type="number" min={0} step="0.01" value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: Number(e.target.value) || 0 })} /></div>
              <div><label className="cxp-lb">Fecha</label>
                <input className="cxp-in" style={{ width: "100%" }} type="date" value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div><label className="cxp-lb">Método</label>
                <select className="cxp-in" style={{ width: "100%" }} value={form.metodo_pago}
                  onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Carta de Crédito">Carta de Crédito</option>
                  <option value="Yappy">Yappy</option>
                </select></div>
              <div><label className="cxp-lb">Referencia</label>
                <input className="cxp-in" style={{ width: "100%" }} value={form.referencia} placeholder="N° de transferencia"
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label className="cxp-lb">Registrado por</label>
                <input className="cxp-in" style={{ width: "100%" }} value={form.autor} placeholder="Tu nombre"
                  onChange={(e) => setForm({ ...form, autor: e.target.value })} /></div>
            </div>

            <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)",
              borderRadius: "8px", padding: "13px 16px", marginBottom: "18px", fontSize: "0.82rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Saldo después del pago</span>
                <strong style={{ color: Number(modalPago.cuenta.saldo_pendiente) - form.monto <= 0.009 ? "#2ecc71" : "#e74c3c" }}>
                  {fmt(Math.max(0, Number(modalPago.cuenta.saldo_pendiente) - form.monto))}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setModalPago({ open: false, cuenta: null })}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                Cancelar
              </button>
              <button className="cxp-btn" style={{ background: "#2ecc71" }} disabled={guardando} onClick={registrarPago}>
                {guardando ? "Guardando..." : "Registrar Pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const kpi: React.CSSProperties = {
  background: "#111111", border: "1px solid rgba(218,165,32,0.3)",
  padding: "18px", borderRadius: "10px",
};
const lbl: React.CSSProperties = { color: "#aaa", fontSize: "0.72rem", textTransform: "uppercase" };
const sub: React.CSSProperties = { color: "#666", fontSize: "0.72rem" };
const th: React.CSSProperties = { padding: "12px 15px", textAlign: "left", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.8px" };
const td: React.CSSProperties = { padding: "12px 15px", textAlign: "left" };
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px",
};
const modal: React.CSSProperties = {
  background: "#111", border: "1px solid rgba(46,204,113,0.5)", borderRadius: "12px",
  padding: "26px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto",
};
