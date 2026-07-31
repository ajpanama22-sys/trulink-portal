import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../../lib/supabaseClient";

type Movimiento = {
  id: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  tercero: string;
  metodo: string;
  monto: number;
};

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hoyISO = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => hoyISO().slice(0, 7);

export default function ResumenTesoreria() {
  const supabase = getSupabase();

  const [cobros, setCobros] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [cxc, setCxc] = useState<any[]>([]);
  const [cxp, setCxp] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [coRes, paRes, cxcRes, cxpRes] = await Promise.all([
        supabase.from("cobros_cliente").select("*").order("fecha", { ascending: false }).limit(200),
        supabase.from("pagos_proveedor").select("*").order("fecha", { ascending: false }).limit(200),
        supabase.from("cuentas_por_cobrar").select("id, cliente_nombre, numero_factura"),
        supabase.from("cuentas_por_pagar").select("id, proveedor_nombre, numero_factura"),
      ]);
      setCobros(coRes.data || []);
      setPagos(paRes.data || []);
      setCxc(cxcRes.data || []);
      setCxp(cxpRes.data || []);
    } catch (err) {
      console.error("Error cargando resumen de tesorería:", err);
    } finally {
      setCargando(false);
    }
  };

  const cuentaCxC = (id: number) => cxc.find((c) => c.id === id);
  const cuentaCxP = (id: number) => cxp.find((c) => c.id === id);

  const totalIngresos = useMemo(() => cobros.reduce((a, c) => a + Number(c.monto || 0), 0), [cobros]);
  const totalEgresos = useMemo(() => pagos.reduce((a, p) => a + Number(p.monto || 0), 0), [pagos]);
  const utilidadNeta = totalIngresos - totalEgresos;

  const ingresosMes = useMemo(
    () => cobros.filter((c) => (c.fecha || "").slice(0, 7) === inicioMes()).reduce((a, c) => a + Number(c.monto || 0), 0),
    [cobros]
  );
  const egresosMes = useMemo(
    () => pagos.filter((p) => (p.fecha || "").slice(0, 7) === inicioMes()).reduce((a, p) => a + Number(p.monto || 0), 0),
    [pagos]
  );

  const movimientos: Movimiento[] = useMemo(() => {
    const ing: Movimiento[] = cobros.map((c) => ({
      id: `in-${c.id}`,
      fecha: c.fecha,
      tipo: "INGRESO",
      categoria: c.es_anticipo ? "Anticipo" : "Cobro Cliente",
      tercero: cuentaCxC(c.cuenta_por_cobrar_id)?.cliente_nombre || "Cliente",
      metodo: c.metodo_pago || "—",
      monto: Number(c.monto || 0),
    }));
    const egr: Movimiento[] = pagos.map((p) => ({
      id: `out-${p.id}`,
      fecha: p.fecha,
      tipo: "EGRESO",
      categoria: "Pago Proveedor / Gasto",
      tercero: cuentaCxP(p.cuenta_por_pagar_id)?.proveedor_nombre || "Proveedor",
      metodo: p.metodo_pago || "—",
      monto: Number(p.monto || 0),
    }));
    return [...ing, ...egr].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 30);
  }, [cobros, pagos, cxc, cxp]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "30px" }}>
        <div style={kpi}>
          <span style={lbl}>Total Ingresos</span>
          <h2 style={{ color: "#2ecc71", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(totalIngresos)}</h2>
          <span style={sub}>{fmt(ingresosMes)} este mes</span>
        </div>

        <div style={kpi}>
          <span style={lbl}>Total Egresos / Gastos</span>
          <h2 style={{ color: "#e74c3c", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(totalEgresos)}</h2>
          <span style={sub}>{fmt(egresosMes)} este mes</span>
        </div>

        <div style={kpi}>
          <span style={lbl}>Utilidad Neta Operativa</span>
          <h2 style={{ color: utilidadNeta >= 0 ? "#DAA520" : "#e74c3c", margin: "8px 0 4px 0", fontSize: "1.5rem" }}>{fmt(utilidadNeta)}</h2>
          <span style={sub}>Ingresos − Egresos (histórico)</span>
        </div>

        <div style={kpi}>
          <span style={lbl}>Cuentas Bancarias</span>
          <h2 style={{ color: "#3498db", margin: "8px 0 4px 0", fontSize: "1.2rem" }}>Wise / ACH Local</h2>
          <span style={sub}>Cuentas Activas EE.UU. / PA</span>
        </div>
      </div>

      <div>
        <h3 style={{ color: "#DAA520", fontSize: "1.05rem", letterSpacing: "0.8px", marginBottom: "15px", textTransform: "uppercase" }}>
          Últimos Movimientos de Tesorería
        </h3>

        <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520" }}>
                <th style={th}>FECHA</th>
                <th style={th}>TIPO</th>
                <th style={th}>CATEGORÍA</th>
                <th style={th}>TERCERO / CLIENTE</th>
                <th style={th}>MÉTODO / REF.</th>
                <th style={{ ...th, textAlign: "right" }}>MONTO</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#777" }}>Cargando...</td></tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                    No hay registros contables en sistema. Utiliza los botones superiores para registrar ingresos o egresos.
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={td}>{new Date(m.fecha).toLocaleDateString()}</td>
                    <td style={{ ...td, color: m.tipo === "INGRESO" ? "#2ecc71" : "#e74c3c", fontWeight: 600 }}>
                      {m.tipo === "INGRESO" ? "↑ Ingreso" : "↓ Egreso"}
                    </td>
                    <td style={td}>{m.categoria}</td>
                    <td style={td}>{m.tercero}</td>
                    <td style={{ ...td, fontSize: "0.78rem", color: "#aaa" }}>{m.metodo}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: m.tipo === "INGRESO" ? "#2ecc71" : "#e74c3c" }}>
                      {m.tipo === "INGRESO" ? "+" : "−"}{fmt(m.monto)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const kpi: React.CSSProperties = { background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "10px" };
const lbl: React.CSSProperties = { color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" };
const sub: React.CSSProperties = { color: "#666", fontSize: "0.75rem" };
const th: React.CSSProperties = { padding: "12px 15px", textAlign: "left" };
const td: React.CSSProperties = { padding: "12px 15px", textAlign: "left" };
