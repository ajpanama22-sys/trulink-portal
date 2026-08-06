import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../../lib/supabaseClient";

/* ============================================================
   REPORTES FINANCIEROS — MÓDULO CONTABLE
   ------------------------------------------------------------
   No existe una tabla de asientos contables (libro diario) en el
   sistema. Los 3 reportes se calculan a partir de las tablas que
   ya alimentan CxC / CxP / Tesorería:

     - cuentas_por_cobrar + cobros_cliente   → lado ingresos
     - cuentas_por_pagar  + pagos_proveedor  → lado gastos/costos
     - plan_cuentas                          → clasificación de gasto

   SUPUESTOS (léelos antes de confiar en los números):

   1) "Caja" en el Balance General es un acumulado histórico de
      cobros_cliente − pagos_proveedor. NO es un saldo bancario
      real, es un proxy.
   2) saldo_pendiente (en cuentas_por_cobrar / cuentas_por_pagar)
      es un campo VIVO, no historizado. El Balance General "a una
      fecha pasada" usa el saldo actual, no el que existía en esa
      fecha. Por eso el reporte solo es exacto a la fecha de hoy.
   3) Costo de Ventas = cuentas con código 6211 (Proveedor/Fábrica)
      y 6212 (Despacho/Logística). Todo lo demás con tipo GASTO se
      trata como Gasto Operativo.
   4) Patrimonio = Activos − Pasivos (utilidad acumulada estimada).
      No hay capital social ni tabla de patrimonio formal.
   5) Bonificaciones marcadas "PAGADO" en el módulo de Comisiones
      NO se reflejan acá salvo que también se hayan registrado como
      egreso real (vía "Registrar Gasto"). Es un hueco conocido.
   ============================================================ */

type CxC = {
  id: number;
  monto_total: number;
  saldo_pendiente: number;
  fecha_emision: string;
  estado: string;
};

type CxP = {
  id: number;
  monto_total: number;
  saldo_pendiente: number;
  fecha_emision: string;
  estado: string;
  cuenta_codigo: string | null;
  cuenta_nombre: string | null;
};

type Cobro = { id: number; fecha: string; monto: number };
type Pago = { id: number; fecha: string; monto: number };

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hoyISO = () => new Date().toISOString().slice(0, 10);
const inicioAno = () => `${new Date().getFullYear()}-01-01`;

const COSTO_VENTA_CODIGOS = ["6211", "6212"];

type SubTab = "resultados" | "balance" | "flujo";

export default function ReportesFinancieros() {
  const supabase = getSupabase();

  const [subTab, setSubTab] = useState<SubTab>("resultados");
  const [cargando, setCargando] = useState(true);

  const [cxc, setCxc] = useState<CxC[]>([]);
  const [cxp, setCxp] = useState<CxP[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);

  // Período para Estado de Resultados y Flujo de Efectivo
  const [desde, setDesde] = useState(inicioAno());
  const [hasta, setHasta] = useState(hoyISO());

  // Fecha de corte para el Balance General
  const [corte, setCorte] = useState(hoyISO());

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [cxcRes, cxpRes, coRes, paRes] = await Promise.all([
        supabase.from("cuentas_por_cobrar").select("id, monto_total, saldo_pendiente, fecha_emision, estado"),
        supabase.from("cuentas_por_pagar").select("id, monto_total, saldo_pendiente, fecha_emision, estado, cuenta_codigo, cuenta_nombre"),
        supabase.from("cobros_cliente").select("id, fecha, monto"),
        supabase.from("pagos_proveedor").select("id, fecha, monto"),
      ]);
      if (cxcRes.error) console.error("cuentas_por_cobrar:", cxcRes.error.message);
      if (cxpRes.error) console.error("cuentas_por_pagar:", cxpRes.error.message);
      setCxc(cxcRes.data || []);
      setCxp(cxpRes.data || []);
      setCobros(coRes.data || []);
      setPagos(paRes.data || []);
    } catch (err) {
      console.error("Error cargando reportes financieros:", err);
    } finally {
      setCargando(false);
    }
  };

  const enRango = (fecha: string, d: string, h: string) => fecha >= d && fecha <= h;

  /* ========================================================
     ESTADO DE RESULTADOS
     ======================================================== */
  const resultados = useMemo(() => {
    const cxcPeriodo = cxc.filter((c) => c.estado !== "Anulada" && enRango(c.fecha_emision, desde, hasta));
    const cxpPeriodo = cxp.filter((c) => c.estado !== "Anulada" && enRango(c.fecha_emision, desde, hasta));

    const ingresos = cxcPeriodo.reduce((a, c) => a + Number(c.monto_total || 0), 0);

    const costoVenta = cxpPeriodo
      .filter((c) => COSTO_VENTA_CODIGOS.includes(String(c.cuenta_codigo)))
      .reduce((a, c) => a + Number(c.monto_total || 0), 0);

    const gastosOp = cxpPeriodo.filter((c) => !COSTO_VENTA_CODIGOS.includes(String(c.cuenta_codigo)));
    const totalGastosOp = gastosOp.reduce((a, c) => a + Number(c.monto_total || 0), 0);

    const gastosPorCuenta = new Map<string, number>();
    gastosOp.forEach((c) => {
      const key = c.cuenta_nombre || "Sin clasificar";
      gastosPorCuenta.set(key, (gastosPorCuenta.get(key) || 0) + Number(c.monto_total || 0));
    });

    const utilidadBruta = ingresos - costoVenta;
    const utilidadNeta = utilidadBruta - totalGastosOp;

    return {
      ingresos, costoVenta, utilidadBruta, totalGastosOp, utilidadNeta,
      gastosDetalle: Array.from(gastosPorCuenta.entries()).sort((a, b) => b[1] - a[1]),
      margenBruto: ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0,
      margenNeto: ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0,
    };
  }, [cxc, cxp, desde, hasta]);

  /* ========================================================
     FLUJO DE EFECTIVO (base caja)
     ======================================================== */
  const flujo = useMemo(() => {
    const cobrosPeriodo = cobros.filter((c) => enRango(c.fecha, desde, hasta));
    const pagosPeriodo = pagos.filter((p) => enRango(p.fecha, desde, hasta));

    const saldoInicial = cobros.filter((c) => c.fecha < desde).reduce((a, c) => a + Number(c.monto || 0), 0)
      - pagos.filter((p) => p.fecha < desde).reduce((a, p) => a + Number(p.monto || 0), 0);

    const entradas = cobrosPeriodo.reduce((a, c) => a + Number(c.monto || 0), 0);
    const salidas = pagosPeriodo.reduce((a, p) => a + Number(p.monto || 0), 0);
    const flujoNeto = entradas - salidas;
    const saldoFinal = saldoInicial + flujoNeto;

    return { saldoInicial, entradas, salidas, flujoNeto, saldoFinal };
  }, [cobros, pagos, desde, hasta]);

  /* ========================================================
     BALANCE GENERAL (a la fecha de corte)
     ======================================================== */
  const balance = useMemo(() => {
    const caja = cobros.filter((c) => c.fecha <= corte).reduce((a, c) => a + Number(c.monto || 0), 0)
      - pagos.filter((p) => p.fecha <= corte).reduce((a, p) => a + Number(p.monto || 0), 0);

    // saldo_pendiente es un campo vivo — ver nota de supuestos arriba
    const cxcActivo = cxc
      .filter((c) => c.estado !== "Anulada" && c.fecha_emision <= corte)
      .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);

    const cxpPasivo = cxp
      .filter((c) => c.estado !== "Anulada" && c.fecha_emision <= corte)
      .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);

    const totalActivos = caja + cxcActivo;
    const totalPasivos = cxpPasivo;
    const patrimonio = totalActivos - totalPasivos;

    return { caja, cxcActivo, totalActivos, cxpPasivo, totalPasivos, patrimonio };
  }, [cxc, cxp, cobros, pagos, corte]);

  if (cargando) {
    return <p style={{ color: "#888", padding: "20px" }}>Cargando reportes financieros...</p>;
  }

  return (
    <div>
      <style jsx global>{`
        .rf-tab { background: transparent; color: #DAA520; border: 1px solid rgba(218,165,32,0.5);
                  padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer; }
        .rf-tab.on { background: #DAA520; color: #000; }
        .rf-in { background:#050505; color:#DAA520; border:1px solid rgba(218,165,32,0.4);
                 padding:8px 11px; border-radius:6px; outline:none; font-size:0.82rem; }
      `}</style>

      <div style={{ background: "rgba(218,165,32,0.06)", border: "1px dashed rgba(218,165,32,0.35)",
        borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "0.76rem", color: "#aaa" }}>
        ⚠️ Estos reportes se calculan desde CxC/CxP/Tesorería, no desde un libro diario formal.
        El Balance General solo es exacto a la fecha de <strong style={{ color: "#DAA520" }}>hoy</strong>;
        a fechas pasadas usa el saldo pendiente actual como aproximación.
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "22px" }}>
        <button className={`rf-tab ${subTab === "resultados" ? "on" : ""}`} onClick={() => setSubTab("resultados")}>
          📈 Estado de Resultados
        </button>
        <button className={`rf-tab ${subTab === "balance" ? "on" : ""}`} onClick={() => setSubTab("balance")}>
          ⚖️ Balance General
        </button>
        <button className={`rf-tab ${subTab === "flujo" ? "on" : ""}`} onClick={() => setSubTab("flujo")}>
          💧 Flujo de Efectivo
        </button>
        <button className="rf-tab" style={{ marginLeft: "auto" }} onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* ============ ESTADO DE RESULTADOS ============ */}
      {subTab === "resultados" && (
        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
            <label style={{ fontSize: "0.72rem", color: "#888" }}>Desde</label>
            <input className="rf-in" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <label style={{ fontSize: "0.72rem", color: "#888" }}>Hasta</label>
            <input className="rf-in" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>

          <div style={{ background: "#111", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "24px", maxWidth: "620px" }}>
            <Linea label="Ingresos por Ventas" valor={resultados.ingresos} color="#2ecc71" />
            <Linea label="(−) Costo de Ventas (Fábrica + Despacho)" valor={-resultados.costoVenta} color="#e67e22" />
            <hr style={hrSt} />
            <Linea label="= Utilidad Bruta" valor={resultados.utilidadBruta} color="#DAA520" bold
              extra={`${resultados.margenBruto.toFixed(1)}% margen`} />
            <Linea label="(−) Gastos Operativos" valor={-resultados.totalGastosOp} color="#e74c3c" />
            <hr style={hrSt} />
            <Linea label="= Utilidad Neta" valor={resultados.utilidadNeta} color={resultados.utilidadNeta >= 0 ? "#2ecc71" : "#e74c3c"} bold
              extra={`${resultados.margenNeto.toFixed(1)}% margen`} big />
          </div>

          {resultados.gastosDetalle.length > 0 && (
            <div style={{ marginTop: "22px", maxWidth: "620px" }}>
              <h4 style={{ color: "#DAA520", fontSize: "0.85rem", textTransform: "uppercase", marginBottom: "10px" }}>
                Detalle de Gastos Operativos por Cuenta
              </h4>
              <div style={{ border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", overflow: "hidden" }}>
                {resultados.gastosDetalle.map(([nombre, monto], i) => (
                  <div key={nombre} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px",
                    background: i % 2 === 0 ? "#0d0d0d" : "#111", fontSize: "0.82rem" }}>
                    <span style={{ color: "#ccc" }}>{nombre}</span>
                    <span style={{ color: "#DAA520", fontWeight: 600 }}>{fmt(monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ BALANCE GENERAL ============ */}
      {subTab === "balance" && (
        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
            <label style={{ fontSize: "0.72rem", color: "#888" }}>Fecha de corte</label>
            <input className="rf-in" type="date" value={corte} onChange={(e) => setCorte(e.target.value)} />
            {corte !== hoyISO() && (
              <span style={{ color: "#e67e22", fontSize: "0.74rem" }}>
                ⚠️ Fecha pasada: CxC/CxP muestran saldo actual, no histórico.
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", maxWidth: "780px" }}>
            <div style={{ background: "#111", border: "1px solid rgba(46,204,113,0.35)", borderRadius: "10px", padding: "22px" }}>
              <h4 style={{ color: "#2ecc71", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0 }}>Activos</h4>
              <Linea label="Caja (acumulado cobros − pagos)" valor={balance.caja} color="#ccc" />
              <Linea label="Cuentas por Cobrar" valor={balance.cxcActivo} color="#ccc" />
              <hr style={hrSt} />
              <Linea label="Total Activos" valor={balance.totalActivos} color="#2ecc71" bold big />
            </div>

            <div style={{ background: "#111", border: "1px solid rgba(231,76,60,0.35)", borderRadius: "10px", padding: "22px" }}>
              <h4 style={{ color: "#e74c3c", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0 }}>Pasivos</h4>
              <Linea label="Cuentas por Pagar" valor={balance.cxpPasivo} color="#ccc" />
              <hr style={hrSt} />
              <Linea label="Total Pasivos" valor={balance.totalPasivos} color="#e74c3c" bold />

              <h4 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: "22px" }}>Patrimonio</h4>
              <Linea label="Utilidad Acumulada (estimada)" valor={balance.patrimonio} color="#DAA520" bold big />
            </div>
          </div>
        </div>
      )}

      {/* ============ FLUJO DE EFECTIVO ============ */}
      {subTab === "flujo" && (
        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
            <label style={{ fontSize: "0.72rem", color: "#888" }}>Desde</label>
            <input className="rf-in" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <label style={{ fontSize: "0.72rem", color: "#888" }}>Hasta</label>
            <input className="rf-in" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>

          <div style={{ background: "#111", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "24px", maxWidth: "620px" }}>
            <Linea label="Saldo Inicial de Caja" valor={flujo.saldoInicial} color="#888" />
            <hr style={hrSt} />
            <Linea label="(+) Entradas (cobros de clientes)" valor={flujo.entradas} color="#2ecc71" />
            <Linea label="(−) Salidas (pagos a proveedores/gastos)" valor={-flujo.salidas} color="#e74c3c" />
            <hr style={hrSt} />
            <Linea label="= Flujo Neto del Período" valor={flujo.flujoNeto} color={flujo.flujoNeto >= 0 ? "#2ecc71" : "#e74c3c"} bold />
            <hr style={hrSt} />
            <Linea label="= Saldo Final de Caja" valor={flujo.saldoFinal} color="#DAA520" bold big />
          </div>

          <p style={{ color: "#666", fontSize: "0.74rem", marginTop: "16px", maxWidth: "620px" }}>
            Todo el flujo se clasifica como "operativo" — no hay movimientos de inversión o
            financiamiento separados en las tablas actuales.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers de presentación ---------------- */

function Linea({ label, valor, color, bold, big, extra }:
  { label: string; valor: number; color: string; bold?: boolean; big?: boolean; extra?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0" }}>
      <span style={{ color: bold ? "#eee" : "#aaa", fontWeight: bold ? 700 : 400, fontSize: big ? "0.92rem" : "0.85rem" }}>
        {label}
      </span>
      <span style={{ textAlign: "right" }}>
        <span style={{ color, fontWeight: bold ? 700 : 600, fontSize: big ? "1.2rem" : "0.9rem" }}>
          {fmt(valor)}
        </span>
        {extra && <div style={{ color: "#666", fontSize: "0.68rem" }}>{extra}</div>}
      </span>
    </div>
  );
}

const hrSt: React.CSSProperties = { border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "6px 0" };
