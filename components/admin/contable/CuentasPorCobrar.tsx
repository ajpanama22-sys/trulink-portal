import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../../lib/supabaseClient";

/* ============================================================
   CUENTAS POR COBRAR — MÓDULO CONTABLE
   ------------------------------------------------------------
   El espejo de las cuentas por pagar, pero del lado del cliente.

   La cuenta por cobrar nace de una cotización aprobada. Desde
   la pestaña "Por facturar" se genera con un clic, tomando el
   total, la forma de pago y los días de crédito del cliente.

   Si el cliente ya tenía un abono registrado en la cotización
   (monto_abono), se arrastra como primer cobro para que el
   saldo arranque correcto.
   ============================================================ */

type CuentaCobrar = {
  id: number;
  cliente_id: string | null;
  cliente_nombre: string | null;
  quote_id: string | null;
  quote_referencia: string | null;
  numero_factura: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  moneda: string | null;
  monto_total: number;
  saldo_pendiente: number;
  estado: string;
  forma_pago: string | null;
  porcentaje_inicial: number | null;
  notas: string | null;
};

type Cobro = {
  id: number;
  cuenta_por_cobrar_id: number;
  fecha: string;
  monto: number;
  metodo_pago: string | null;
  referencia: string | null;
  es_anticipo: boolean;
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

export default function CuentasPorCobrar() {
  const supabase = getSupabase();

  const [cuentas, setCuentas] = useState<CuentaCobrar[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [tab, setTab] = useState<"cartera" | "facturar">("cartera");
  const [filtro, setFiltro] = useState("PENDIENTES");
  const [buscar, setBuscar] = useState("");
  const [detalle, setDetalle] = useState<number | null>(null);

  const [modalCobro, setModalCobro] = useState<{ open: boolean; cuenta: CuentaCobrar | null }>({ open: false, cuenta: null });
  const [form, setForm] = useState({ monto: 0, metodo_pago: "Transferencia", referencia: "", fecha: hoyISO(), autor: "" });
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [cRes, coRes, qRes, cliRes] = await Promise.all([
        supabase.from("cuentas_por_cobrar").select("*").order("fecha_vencimiento", { ascending: true }),
        supabase.from("cobros_cliente").select("*").order("fecha", { ascending: false }),
        supabase.from("quotes").select("*").eq("aprobada", true).order("created_at", { ascending: false }),
        supabase.from("clientes").select("*"),
      ]);
      if (cRes.error) console.error("cuentas_por_cobrar (¿corriste el SQL?):", cRes.error.message);
      setCuentas(cRes.data || []);
      setCobros(coRes.data || []);
      setQuotes(qRes.data || []);
      setClientes(cliRes.data || []);
    } catch (err) {
      console.error("Error cargando cuentas por cobrar:", err);
    } finally {
      setCargando(false);
    }
  };

  /* ========================================================
     GENERAR CUENTA DESDE COTIZACIÓN APROBADA
     ======================================================== */

  const generarDesdeQuote = async (q: any) => {
    if (!supabase) return;
    if (!confirm(`¿Generar la cuenta por cobrar de ${q.referencia} por ${fmt(q.total)}?`)) return;

    setGenerando(String(q.id));
    try {
      // Se busca al cliente por email para tomar sus condiciones reales
      const cli = clientes.find(
        (c) => String(c.email || "").toLowerCase() === String(q.email || "").toLowerCase()
      );

      // El vencimiento se ancla a la fecha de despacho, no a días corridos.
      // Tus condiciones son por hitos, no net-30:
      //   100%     -> exigible a la aceptación (hoy)
      //   50%/ESP  -> el saldo vence 3 días antes del despacho estimado
      // Si la cotización no trae fecha estimada, se usa un plazo prudencial
      // de 15 días para no dejar la factura sin vencimiento.
      const forma = String(cli?.forma_pago || "").trim();
      let venc = new Date();

      if (forma === "100%") {
        // Pago anticipado completo: vence de inmediato
      } else if (q.fecha_estimada_entrega) {
        venc = new Date(q.fecha_estimada_entrega);
        venc.setDate(venc.getDate() - 3);
        // Si la entrega ya pasó o está a menos de 3 días, vence hoy
        if (venc.getTime() < Date.now()) venc = new Date();
      } else {
        venc.setDate(venc.getDate() + 15);
      }

      const total = Number(q.total || 0);
      const abono = Number(q.monto_abono || 0);
      const saldo = Math.max(0, total - abono);

      const { data, error } = await supabase.from("cuentas_por_cobrar").insert([{
        cliente_id: cli?.id ? String(cli.id) : null,
        cliente_nombre: q.empresa || cli?.razon_social || null,
        quote_id: String(q.id),
        quote_referencia: q.referencia,
        numero_factura: q.referencia,
        fecha_emision: hoyISO(),
        fecha_vencimiento: venc.toISOString().slice(0, 10),
        moneda: "USD",
        monto_total: total,
        saldo_pendiente: saldo,
        estado: saldo <= 0.009 ? "Cobrada" : abono > 0 ? "Parcial" : "Pendiente",
        forma_pago: cli?.forma_pago || null,
        porcentaje_inicial: cli?.porcentaje_pago ?? null,
        notas: q.fecha_estimada_entrega
          ? `Generada desde ${q.referencia}. Vence 3 días antes del despacho estimado (${new Date(q.fecha_estimada_entrega).toLocaleDateString()}).`
          : `Generada desde ${q.referencia}. Sin fecha de despacho: se aplicó plazo de 15 días.`,
      }]).select().single();

      if (error) throw error;

      // El abono que ya venía en la cotización se arrastra como primer cobro
      if (abono > 0 && data?.id) {
        await supabase.from("cobros_cliente").insert([{
          cuenta_por_cobrar_id: data.id,
          cliente_id: cli?.id ? String(cli.id) : null,
          fecha: hoyISO(), monto: abono,
          metodo_pago: "Anticipo previo", es_anticipo: true,
          notas: "Abono registrado en la cotización antes de facturar",
        }]);
      }

      try {
        await supabase.from("audit_log").insert([{
          accion: "cxc_generada", entidad: "cuenta_por_cobrar", entidad_id: String(data?.id ?? ""),
          detalle: `Cuenta por cobrar de ${fmt(total)} generada desde ${q.referencia}. Saldo inicial ${fmt(saldo)}.`,
        }]);
      } catch { /* no frena */ }

      cargar();
      alert(`Cuenta creada. Saldo ${fmt(saldo)}, vence el ${venc.toLocaleDateString()}.`);
    } catch (err: any) {
      alert("Error al generar la cuenta: " + (err.message || err));
    } finally {
      setGenerando(null);
    }
  };

  /* ========================================================
     COBROS
     ======================================================== */

  const abrirCobro = (c: CuentaCobrar) => {
    setModalCobro({ open: true, cuenta: c });
    setForm({ monto: Number(c.saldo_pendiente), metodo_pago: "Transferencia", referencia: "", fecha: hoyISO(), autor: "" });
  };

  const registrarCobro = async () => {
    const c = modalCobro.cuenta;
    if (!c || !supabase) return;
    const monto = Number(form.monto) || 0;
    if (monto <= 0) return alert("El monto debe ser mayor a cero.");
    if (monto > Number(c.saldo_pendiente) + 0.01) {
      return alert(`El monto supera el saldo pendiente (${fmt(c.saldo_pendiente)}).`);
    }

    setGuardando(true);
    try {
      const { error } = await supabase.from("cobros_cliente").insert([{
        cuenta_por_cobrar_id: c.id, cliente_id: c.cliente_id, fecha: form.fecha,
        monto, metodo_pago: form.metodo_pago, referencia: form.referencia || null,
        es_anticipo: false, autor: form.autor || null,
      }]);
      if (error) throw error;

      const nuevoSaldo = Number((Number(c.saldo_pendiente) - monto).toFixed(2));
      const estado = nuevoSaldo <= 0.009 ? "Cobrada" : "Parcial";

      const { error: e2 } = await supabase.from("cuentas_por_cobrar")
        .update({ saldo_pendiente: Math.max(0, nuevoSaldo), estado }).eq("id", c.id);
      if (e2) throw e2;

      try {
        await supabase.from("audit_log").insert([{
          accion: "cobro_cliente", entidad: "cuenta_por_cobrar", entidad_id: String(c.id),
          detalle: `Cobro de ${fmt(monto)} a ${c.cliente_nombre}. Saldo: ${fmt(Math.max(0, nuevoSaldo))}.`,
          autor: form.autor || null,
        }]);
      } catch { /* no frena */ }

      setModalCobro({ open: false, cuenta: null });
      cargar();
    } catch (err: any) {
      alert("Error al registrar el cobro: " + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  /* ========================================================
     DERIVADOS
     ======================================================== */

  const abiertas = cuentas.filter((c) => c.estado !== "Cobrada" && c.estado !== "Anulada");
  const totalPorCobrar = abiertas.reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);
  const totalVencido = abiertas.filter((c) => diasVencido(c.fecha_vencimiento) > 0)
    .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);
  const clientesConSaldo = new Set(abiertas.map((c) => c.cliente_id || c.cliente_nombre)).size;
  const cobradoMes = cobros.filter((p) => (p.fecha || "").slice(0, 7) === hoyISO().slice(0, 7))
    .reduce((a, p) => a + Number(p.monto || 0), 0);

  const aging = useMemo(() => {
    const b: Record<string, number> = { Corriente: 0, "1-30": 0, "31-60": 0, "61-90": 0, "+90": 0 };
    abiertas.forEach((c) => { b[cubeta(c.fecha_vencimiento)] += Number(c.saldo_pendiente || 0); });
    return b;
  }, [cuentas]);

  const idsFacturados = new Set(cuentas.map((c) => String(c.quote_id)));
  const porFacturar = quotes.filter((q) => !idsFacturados.has(String(q.id)));

  const filtradas = cuentas.filter((c) => {
    if (filtro === "PENDIENTES" && (c.estado === "Cobrada" || c.estado === "Anulada")) return false;
    if (filtro === "VENCIDAS" && !(c.estado !== "Cobrada" && c.estado !== "Anulada" && diasVencido(c.fecha_vencimiento) > 0)) return false;
    if (filtro === "COBRADAS" && c.estado !== "Cobrada") return false;
    const q = buscar.toLowerCase().trim();
    if (!q) return true;
    return [c.numero_factura, c.cliente_nombre, c.quote_referencia].filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const cobrosDe = (id: number) => cobros.filter((p) => p.cuenta_por_cobrar_id === id);

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <div>
      <style jsx global>{`
        .cxc-in { background:#050505; color:#DAA520; border:1px solid rgba(218,165,32,0.4);
                  padding:9px 11px; border-radius:6px; outline:none; font-size:0.82rem;
                  box-sizing:border-box; font-family:inherit; }
        .cxc-lb { display:block; font-size:0.66rem; color:rgba(255,255,255,0.55); margin-bottom:5px;
                  text-transform:uppercase; letter-spacing:0.5px; }
        .cxc-btn { background:#DAA520; color:#000; border:none; padding:9px 16px; border-radius:6px;
                   font-weight:700; font-size:0.76rem; cursor:pointer; }
        .cxc-btn:disabled { opacity:.5; cursor:not-allowed; }
        .cxc-mini { background:transparent; color:#2ecc71; border:1px solid rgba(46,204,113,0.5);
                    padding:5px 11px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; white-space:nowrap; }
        .cxc-mini:hover { background:rgba(46,204,113,0.15); }
        .cxc-ghost { background:transparent; color:#888; border:1px solid #444; padding:5px 11px;
                     border-radius:5px; font-size:0.7rem; cursor:pointer; }
        .cxc-chip { padding:3px 9px; border-radius:10px; font-size:0.66rem; font-weight:600; }
        .cxc-tab { background:transparent; color:#DAA520; border:1px solid rgba(218,165,32,0.5);
                   padding:8px 16px; border-radius:6px; font-weight:600; font-size:0.75rem; cursor:pointer; }
        .cxc-tab.on { background:#DAA520; color:#000; }
      `}</style>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "22px" }}>
        <div style={kpi}>
          <span style={lbl}>Total por Cobrar</span>
          <h2 style={{ color: "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(totalPorCobrar)}</h2>
          <span style={sub}>{abiertas.length} factura(s) abierta(s)</span>
        </div>
        <div style={kpi}>
          <span style={lbl}>Cartera Vencida</span>
          <h2 style={{ color: totalVencido > 0 ? "#e74c3c" : "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(totalVencido)}</h2>
          <span style={sub}>{totalVencido > 0 ? "Requiere gestión de cobro" : "Cartera sana"}</span>
        </div>
        <div style={kpi}>
          <span style={lbl}>Clientes con Saldo</span>
          <h2 style={{ color: "#3498db", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{clientesConSaldo}</h2>
          <span style={sub}>Cuentas activas</span>
        </div>
        <div style={kpi}>
          <span style={lbl}>Cobrado Este Mes</span>
          <h2 style={{ color: "#DAA520", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(cobradoMes)}</h2>
          <span style={sub}>{cobros.filter((p) => (p.fecha || "").slice(0, 7) === hoyISO().slice(0, 7)).length} cobro(s)</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button className={`cxc-tab ${tab === "cartera" ? "on" : ""}`} onClick={() => setTab("cartera")}>
          💰 Cartera ({cuentas.length})
        </button>
        <button className={`cxc-tab ${tab === "facturar" ? "on" : ""}`} onClick={() => setTab("facturar")}>
          📄 Por Facturar ({porFacturar.length})
        </button>
        <button className="cxc-ghost" style={{ marginLeft: "auto" }} onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* ============ CARTERA ============ */}
      {tab === "cartera" && (
        <>
          <div style={{ background: "#111", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "20px", marginBottom: "22px" }}>
            <h3 style={{ color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", margin: "0 0 4px 0", letterSpacing: "0.8px" }}>
              Antigüedad de Cartera
            </h3>
            <p style={{ color: "#777", fontSize: "0.74rem", margin: "0 0 15px 0" }}>
              Cuánto te deben y hace cuánto venció. Mientras más a la derecha, más difícil de cobrar.
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
            <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", margin: 0, textTransform: "uppercase" }}>
              Gestión de Cuentas por Cobrar (CxC)
            </h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <input className="cxc-in" style={{ width: "220px" }} placeholder="Buscar factura o cliente..."
                value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <select className="cxc-in" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="PENDIENTES">Pendientes</option>
                <option value="VENCIDAS">Solo vencidas</option>
                <option value="COBRADAS">Cobradas</option>
                <option value="TODAS">Todas</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218,165,32,0.3)", color: "#DAA520" }}>
                  <th style={th}>Factura / Ref</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Emisión</th>
                  <th style={th}>Vencimiento</th>
                  <th style={{ ...th, textAlign: "right" }}>Monto Total</th>
                  <th style={{ ...th, textAlign: "right" }}>Saldo</th>
                  <th style={{ ...th, textAlign: "center" }}>Estado</th>
                  <th style={{ ...th, textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "#777" }}>Cargando...</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                    No hay cuentas por cobrar que coincidan.
                    <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "6px" }}>
                      Genera las primeras desde la pestaña "Por Facturar".
                    </div>
                  </td></tr>
                ) : (
                  filtradas.map((c) => {
                    const d = diasVencido(c.fecha_vencimiento);
                    const cub = cubeta(c.fecha_vencimiento);
                    const cobrada = c.estado === "Cobrada";
                    const abonos = cobrosDe(c.id);
                    const abierto = detalle === c.id;
                    return (
                      <React.Fragment key={c.id}>
                        <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                          <td style={{ ...td, color: "#DAA520", fontWeight: 600 }}>
                            {c.numero_factura || `CXC-${c.id}`}
                            {c.forma_pago && <div style={{ fontSize: "0.66rem", color: "#666" }}>{c.forma_pago}</div>}
                          </td>
                          <td style={td}>{c.cliente_nombre || "—"}</td>
                          <td style={{ ...td, fontSize: "0.75rem", color: "#aaa" }}>
                            {new Date(c.fecha_emision).toLocaleDateString()}
                          </td>
                          <td style={{ ...td, fontSize: "0.75rem", color: d > 0 && !cobrada ? "#e74c3c" : "#aaa" }}>
                            {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString() : "—"}
                            {!cobrada && c.fecha_vencimiento && (
                              <div style={{ fontSize: "0.66rem", color: d > 0 ? "#c0392b" : "#777" }}>
                                {d > 0 ? `${d} días vencido` : `faltan ${Math.abs(d)} días`}
                              </div>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>{fmt(c.monto_total)}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: cobrada ? "#2ecc71" : "#DAA520" }}>
                            {fmt(c.saldo_pendiente)}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            {cobrada ? (
                              <span className="cxc-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>Cobrada</span>
                            ) : (
                              <span className="cxc-chip" style={{ background: `${COLOR[cub]}22`, color: COLOR[cub], border: `1px solid ${COLOR[cub]}55` }}>
                                {c.estado === "Parcial" ? "Parcial" : cub === "Corriente" ? "Corriente" : `${cub} d`}
                              </span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                            {abonos.length > 0 && (
                              <button className="cxc-ghost" style={{ marginRight: "6px" }}
                                onClick={() => setDetalle(abierto ? null : c.id)}>
                                {abierto ? "▲" : "▼"} {abonos.length}
                              </button>
                            )}
                            {!cobrada && <button className="cxc-mini" onClick={() => abrirCobro(c)}>💵 Cobrar</button>}
                          </td>
                        </tr>
                        {abierto && abonos.map((p) => (
                          <tr key={`c${p.id}`} style={{ background: "#080808", borderBottom: "1px solid #1a1a1a" }}>
                            <td style={{ ...td, fontSize: "0.72rem", color: "#666" }} colSpan={3}>
                              ↳ {new Date(p.fecha).toLocaleDateString()} · {p.metodo_pago || "—"}
                              {p.referencia ? ` · ${p.referencia}` : ""}
                              {p.es_anticipo && <span style={{ color: "#f1c40f" }}> · anticipo</span>}
                            </td>
                            <td style={{ ...td, fontSize: "0.72rem", color: "#666" }} colSpan={2}>
                              {p.autor ? `Registrado por ${p.autor}` : ""}
                            </td>
                            <td style={{ ...td, textAlign: "right", color: "#2ecc71", fontWeight: 600 }}>+{fmt(p.monto)}</td>
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
        </>
      )}

      {/* ============ POR FACTURAR ============ */}
      {tab === "facturar" && (
        <div>
          <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", margin: "0 0 4px 0", textTransform: "uppercase" }}>
            Cotizaciones Aprobadas sin Facturar
          </h3>
          <p style={{ color: "#777", fontSize: "0.76rem", margin: "0 0 16px 0" }}>
            El vencimiento se calcula 3 días antes del despacho estimado, según tus condiciones comerciales.
            Si la forma de pago es 100%, vence de inmediato. Si la cotización ya traía un abono, se arrastra como primer cobro.
          </p>

          <div style={{ overflowX: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218,165,32,0.3)", color: "#DAA520" }}>
                  <th style={th}>Referencia</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Aprobación</th>
                  <th style={th}>Despacho Est.</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                  <th style={{ ...th, textAlign: "right" }}>Abonado</th>
                  <th style={{ ...th, textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {porFacturar.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                    No hay cotizaciones aprobadas pendientes de facturar.
                  </td></tr>
                ) : (
                  porFacturar.map((q) => {
                    const abono = Number(q.monto_abono || 0);
                    return (
                      <tr key={q.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ ...td, color: "#DAA520", fontWeight: 600 }}>{q.referencia}</td>
                        <td style={td}>
                          {q.empresa || "—"}
                          {q.email && <div style={{ fontSize: "0.68rem", color: "#666" }}>{q.email}</div>}
                        </td>
                        <td style={td}>
                          <span className="cxc-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>
                            {q.tipo_aprobacion || "Aprobada"}
                          </span>
                          {q.referencia_aprobacion && (
                            <div style={{ fontSize: "0.66rem", color: "#666", marginTop: "3px" }}>{q.referencia_aprobacion}</div>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: "0.75rem", color: q.fecha_estimada_entrega ? "#aaa" : "#e67e22" }}>
                          {q.fecha_estimada_entrega
                            ? new Date(q.fecha_estimada_entrega).toLocaleDateString()
                            : "sin fecha"}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(q.total)}</td>
                        <td style={{ ...td, textAlign: "right", color: abono > 0 ? "#2ecc71" : "#666" }}>
                          {abono > 0 ? fmt(abono) : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button className="cxc-btn" style={{ padding: "6px 13px", fontSize: "0.72rem" }}
                            disabled={generando === String(q.id)}
                            onClick={() => generarDesdeQuote(q)}>
                            {generando === String(q.id) ? "Generando..." : "→ Facturar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ MODAL COBRO ============ */}
      {modalCobro.open && modalCobro.cuenta && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ color: "#2ecc71", marginTop: 0, fontSize: "1.05rem", textTransform: "uppercase" }}>Registrar Cobro</h3>
            <p style={{ color: "#bbb", fontSize: "0.84rem", marginBottom: "18px" }}>
              {modalCobro.cuenta.cliente_nombre} — factura{" "}
              <strong style={{ color: "#DAA520" }}>{modalCobro.cuenta.numero_factura || `CXC-${modalCobro.cuenta.id}`}</strong>
              <br />
              <span style={{ fontSize: "0.78rem", color: "#888" }}>
                Saldo pendiente: <strong style={{ color: "#DAA520" }}>{fmt(modalCobro.cuenta.saldo_pendiente)}</strong>
              </span>
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div><label className="cxc-lb">Monto recibido</label>
                <input className="cxc-in" style={{ width: "100%" }} type="number" min={0} step="0.01" value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: Number(e.target.value) || 0 })} /></div>
              <div><label className="cxc-lb">Fecha</label>
                <input className="cxc-in" style={{ width: "100%" }} type="date" value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div><label className="cxc-lb">Método</label>
                <select className="cxc-in" style={{ width: "100%" }} value={form.metodo_pago}
                  onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Yappy">Yappy</option>
                  <option value="ACH">ACH</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                </select></div>
              <div><label className="cxc-lb">Referencia</label>
                <input className="cxc-in" style={{ width: "100%" }} value={form.referencia} placeholder="N° de transacción"
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label className="cxc-lb">Registrado por</label>
                <input className="cxc-in" style={{ width: "100%" }} value={form.autor} placeholder="Tu nombre"
                  onChange={(e) => setForm({ ...form, autor: e.target.value })} /></div>
            </div>

            <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)",
              borderRadius: "8px", padding: "13px 16px", marginBottom: "18px", fontSize: "0.82rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Saldo después del cobro</span>
                <strong style={{ color: Number(modalCobro.cuenta.saldo_pendiente) - form.monto <= 0.009 ? "#2ecc71" : "#DAA520" }}>
                  {fmt(Math.max(0, Number(modalCobro.cuenta.saldo_pendiente) - form.monto))}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setModalCobro({ open: false, cuenta: null })}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                Cancelar
              </button>
              <button className="cxc-btn" style={{ background: "#2ecc71" }} disabled={guardando} onClick={registrarCobro}>
                {guardando ? "Guardando..." : "Registrar Cobro"}
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
