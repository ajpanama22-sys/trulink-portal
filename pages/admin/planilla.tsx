// pages/admin/planilla.tsx
//
// Dashboard de periodos de planilla: crear periodo, generar detalle
// desde los empleados activos del modo elegido, aprobar (lo cual deja
// listo el periodo para que un job/función genere el asiento contable
// en tu módulo de contabilidad) y ver totales.
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

type Modo = "panama" | "us_corp";
type EstadoPeriodo = "borrador" | "aprobado" | "pagado" | "anulado";

type Periodo = {
  id: string;
  modo: Modo;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPeriodo;
  total_bruto: number;
  total_deducciones: number;
  total_neto: number;
  cuenta_por_pagar_id: number | null;
};

// ---------- Estilos compartidos (estándar negro / dorado del sitio) ----------
const GOLD = "#DAA520";
const GOLD_BORDER = "rgba(218, 165, 32, 0.4)";
const GOLD_BORDER_SOFT = "rgba(218, 165, 32, 0.25)";

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#000000",
    color: "#ffffff",
  } as const,
  main: {
    flex: 1,
    minHeight: "100vh",
    backgroundColor: "#000000",
    padding: "30px",
    boxSizing: "border-box" as const,
    overflowY: "auto" as const,
  },
  card: {
    backgroundColor: "#0d0d0d",
    border: `1px solid ${GOLD_BORDER}`,
    borderRadius: "14px",
    padding: "25px",
    boxShadow: "0 0 25px rgba(218, 165, 32, 0.1)",
  },
  h1: {
    color: GOLD,
    margin: 0,
    fontSize: "1.6rem",
    letterSpacing: "1px",
    fontWeight: "bold" as const,
  },
  subtitle: {
    color: "#888888",
    margin: "6px 0 0 0",
    fontSize: "0.85rem",
  },
  section: {
    backgroundColor: "rgba(20, 20, 20, 0.8)",
    border: `1px solid ${GOLD_BORDER_SOFT}`,
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
  },
  h2: {
    color: GOLD,
    margin: "0 0 16px 0",
    fontSize: "1.05rem",
    letterSpacing: "0.5px",
    fontWeight: "bold" as const,
  },
  label: {
    color: "#aaaaaa",
    fontSize: "0.78rem",
    letterSpacing: "0.5px",
    textTransform: "uppercase" as const,
    display: "block",
    marginBottom: "6px",
  },
  input: {
    background: "#000000",
    border: `1px solid ${GOLD_BORDER_SOFT}`,
    borderRadius: "8px",
    color: "#ffffff",
    padding: "9px 12px",
    fontSize: "0.9rem",
    outline: "none",
  } as const,
  select: {
    background: "#000000",
    border: `1px solid ${GOLD_BORDER_SOFT}`,
    borderRadius: "8px",
    color: "#ffffff",
    padding: "9px 12px",
    fontSize: "0.9rem",
    outline: "none",
  } as const,
  btnPrimary: {
    background: GOLD,
    color: "#000000",
    fontWeight: "bold" as const,
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem",
    letterSpacing: "0.5px",
    boxShadow: "0 0 10px rgba(218, 165, 32, 0.3)",
    transition: "all 0.2s ease",
  },
  btnPrimaryDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  btnSecondary: {
    background: "transparent",
    color: GOLD,
    border: `1px solid ${GOLD}`,
    fontWeight: "bold" as const,
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    letterSpacing: "0.3px",
    transition: "all 0.2s ease",
  },
  btnGhost: {
    background: "transparent",
    color: "#999999",
    border: "1px solid rgba(255,255,255,0.15)",
    fontWeight: "bold" as const,
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    letterSpacing: "0.3px",
  },
  error: {
    color: "#ff6b6b",
    background: "rgba(255, 107, 107, 0.08)",
    border: "1px solid rgba(255, 107, 107, 0.3)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "0.85rem",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.87rem",
  },
  th: {
    textAlign: "left" as const,
    color: GOLD,
    fontSize: "0.75rem",
    letterSpacing: "0.5px",
    textTransform: "uppercase" as const,
    padding: "10px 12px",
    borderBottom: `1px solid ${GOLD_BORDER_SOFT}`,
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    color: "#e5e5e5",
  },
  badge: (estado: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      borrador: { bg: "rgba(255,255,255,0.08)", color: "#cccccc" },
      aprobado: { bg: "rgba(218, 165, 32, 0.15)", color: GOLD },
      pagado: { bg: "rgba(80, 200, 120, 0.15)", color: "#5ac87f" },
      anulado: { bg: "rgba(255, 107, 107, 0.15)", color: "#ff6b6b" },
    };
    const c = map[estado] ?? map.borrador;
    return {
      background: c.bg,
      color: c.color,
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "0.75rem",
      fontWeight: "bold" as const,
      letterSpacing: "0.3px",
      textTransform: "capitalize" as const,
      display: "inline-block",
    };
  },
  muted: { color: "#666666" },
};

export default function PlanillaPeriodosPage() {
  const supabase = getSupabase();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>("panama");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [creando, setCreando] = useState(false);

  async function cargarPeriodos() {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from("planilla_periodos")
      .select("*")
      .order("fecha_inicio", { ascending: false });
    if (error) setError(error.message);
    else setPeriodos(data as Periodo[]);
    setCargando(false);
  }

  useEffect(() => {
    cargarPeriodos();
  }, []);

  async function crearPeriodo() {
    if (!supabase) return;
    setCreando(true);
    setError(null);
    try {
      const { data: periodo, error: errPeriodo } = await supabase
        .from("planilla_periodos")
        .insert({
          modo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: "borrador",
        })
        .select()
        .single();
      if (errPeriodo) throw errPeriodo;

      const { data: empleados, error: errEmp } = await supabase
        .from("planilla_empleados")
        .select("id, salario_base")
        .eq("modo", modo)
        .eq("activo", true);
      if (errEmp) throw errEmp;

      if (empleados && empleados.length > 0) {
        const detalle = empleados.map((e: any) => ({
          periodo_id: periodo.id,
          empleado_id: e.id,
          salario_base: e.salario_base,
          neto: e.salario_base,
        }));
        const { error: errDetalle } = await supabase.from("planilla_detalle").insert(detalle);
        if (errDetalle) throw errDetalle;

        const totalBruto = empleados.reduce((acc: number, e: any) => acc + Number(e.salario_base), 0);
        await supabase
          .from("planilla_periodos")
          .update({ total_bruto: totalBruto, total_neto: totalBruto })
          .eq("id", periodo.id);
      }

      await cargarPeriodos();
    } catch (e: any) {
      setError(e.message ?? "Error al crear el periodo");
    } finally {
      setCreando(false);
    }
  }

  async function calcularDeducciones(id: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("planilla_calcular_periodo", { p_periodo_id: id });
    if (error) setError(error.message);
    else await cargarPeriodos();
  }

  async function generarComprobantes(id: string) {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("planilla_generar_comprobantes", { p_periodo_id: id });
    if (error) setError(error.message);
    else alert(`Comprobantes generados: ${data}`);
  }

  async function generarAsiento(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/planilla/generar-egreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al generar el egreso");
        return;
      }
      await cargarPeriodos();
    } catch (e: any) {
      setError(e.message ?? "Error al generar el egreso");
    }
  }

  async function aprobarPeriodo(id: string) {
    if (!supabase) return;
    if (!confirm("¿Aprobar este periodo? Esto lo deja listo para generar el asiento contable y la dispersión.")) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("planilla_periodos")
      .update({
        estado: "aprobado",
        aprobado_por: user?.id ?? null,
        aprobado_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) setError(error.message);
    else await cargarPeriodos();
  }

  return (
    <div style={styles.page}>
      <Sidebar currentActive="planilla" />

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ marginBottom: "25px" }}>
            <h1 style={styles.h1}>PLANILLA — PERIODOS</h1>
            <p style={styles.subtitle}>
              Creación de periodos, cálculo de deducciones y generación del asiento contable de nómina.
            </p>
          </div>

          <section style={styles.section}>
            <h2 style={styles.h2}>Nuevo periodo</h2>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={styles.label}>Modo</label>
                <select style={styles.select} value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
                  <option value="panama">Panamá</option>
                  <option value="us_corp">Corporación Americana</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Inicio</label>
                <input style={styles.input} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Fin</label>
                <input style={styles.input} type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              <button
                onClick={crearPeriodo}
                disabled={creando}
                style={{ ...styles.btnPrimary, ...(creando ? styles.btnPrimaryDisabled : {}) }}
              >
                {creando ? "Creando..." : "+ Crear periodo (con empleados activos)"}
              </button>
            </div>
          </section>

          {error && <div style={styles.error}>{error}</div>}

          <h2 style={styles.h2}>Historial</h2>
          {cargando ? (
            <p style={styles.muted}>Cargando...</p>
          ) : periodos.length === 0 ? (
            <p style={styles.muted}>Todavía no hay periodos de planilla creados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Periodo</th>
                    <th style={styles.th}>Modo</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Bruto</th>
                    <th style={styles.th}>Deducciones</th>
                    <th style={styles.th}>Neto</th>
                    <th style={styles.th}>Egreso (CxP)</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {periodos.map((p) => (
                    <tr key={p.id}>
                      <td style={styles.td}>{p.fecha_inicio} → {p.fecha_fin}</td>
                      <td style={styles.td}>{p.modo === "panama" ? "Panamá" : "US Corp"}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(p.estado)}>{p.estado}</span>
                      </td>
                      <td style={styles.td}>{Number(p.total_bruto).toFixed(2)}</td>
                      <td style={styles.td}>{Number(p.total_deducciones).toFixed(2)}</td>
                      <td style={{ ...styles.td, color: GOLD, fontWeight: "bold" as const }}>
                        {Number(p.total_neto).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        {p.cuenta_por_pagar_id ? (
                          <span style={{ color: "#5ac87f" }}>✔ #{p.cuenta_por_pagar_id}</span>
                        ) : (
                          <span style={styles.muted}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {p.estado === "borrador" && (
                            <>
                              <button style={styles.btnSecondary} onClick={() => calcularDeducciones(p.id)}>
                                Calcular deducciones
                              </button>
                              <button style={styles.btnPrimary} onClick={() => aprobarPeriodo(p.id)}>
                                Aprobar
                              </button>
                            </>
                          )}
                          {(p.estado === "aprobado" || p.estado === "pagado") && (
                            <>
                              <button style={styles.btnGhost} onClick={() => generarComprobantes(p.id)}>
                                Comprobantes
                              </button>
                              {!p.cuenta_por_pagar_id && (
                                <button style={styles.btnPrimary} onClick={() => generarAsiento(p.id)}>
                                  Generar asiento
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
