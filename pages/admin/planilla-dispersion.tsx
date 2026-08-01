// pages/admin/planilla-dispersion.tsx
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

type Periodo = {
  id: string;
  modo: "panama" | "us_corp";
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  total_neto: number;
};

type Dispersion = {
  id: string;
  periodo_id: string;
  banco: string | null;
  referencia: string | null;
  monto_total: number;
  estado: string;
  ejecutado_at: string | null;
  created_at: string;
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
  btnPrimary: {
    background: GOLD,
    color: "#000000",
    fontWeight: "bold" as const,
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    letterSpacing: "0.3px",
    boxShadow: "0 0 10px rgba(218, 165, 32, 0.3)",
    transition: "all 0.2s ease",
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
      pendiente: { bg: "rgba(218, 165, 32, 0.15)", color: GOLD },
      confirmado: { bg: "rgba(80, 200, 120, 0.15)", color: "#5ac87f" },
    };
    const c = map[estado] ?? { bg: "rgba(255,255,255,0.08)", color: "#cccccc" };
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

export default function PlanillaDispersionPage() {
  const supabase = getSupabase();
  const [periodosAprobados, setPeriodosAprobados] = useState<Periodo[]>([]);
  const [dispersiones, setDispersiones] = useState<Dispersion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banco, setBanco] = useState("");
  const [referencia, setReferencia] = useState("");

  async function cargar() {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    setError(null);

    const { data: periodos, error: errP } = await supabase
      .from("planilla_periodos")
      .select("id, modo, fecha_inicio, fecha_fin, estado, total_neto")
      .in("estado", ["aprobado", "pagado"])
      .order("fecha_inicio", { ascending: false });
    if (errP) setError(errP.message);
    else setPeriodosAprobados(periodos as Periodo[]);

    const { data: disp, error: errD } = await supabase
      .from("planilla_dispersion")
      .select("*")
      .order("created_at", { ascending: false });
    if (errD) setError(errD.message);
    else setDispersiones(disp as Dispersion[]);

    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearDispersion(periodo: Periodo) {
    if (!supabase) return;
    const { error } = await supabase.from("planilla_dispersion").insert({
      periodo_id: periodo.id,
      banco: banco || null,
      referencia: referencia || null,
      monto_total: periodo.total_neto,
      estado: "pendiente",
    });
    if (error) setError(error.message);
    else await cargar();
  }

  async function marcarEjecutada(d: Dispersion) {
    if (!supabase) return;
    if (!confirm("¿Marcar esta dispersión como ejecutada/confirmada por el banco?")) return;
    const { error } = await supabase
      .from("planilla_dispersion")
      .update({ estado: "confirmado", ejecutado_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) {
      setError(error.message);
      return;
    }
    await supabase.from("planilla_periodos").update({ estado: "pagado" }).eq("id", d.periodo_id);
    await cargar();
  }

  const periodosSinDispersion = periodosAprobados.filter(
    (p) => !dispersiones.some((d) => d.periodo_id === p.id)
  );

  return (
    <div style={styles.page}>
      <Sidebar currentActive="planilla-dispersion" />

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ marginBottom: "25px" }}>
            <h1 style={styles.h1}>PLANILLA — DISPERSIÓN BANCARIA</h1>
            <p style={styles.subtitle}>Generación y seguimiento de los lotes de pago a empleados.</p>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <section style={styles.section}>
            <h2 style={styles.h2}>Datos del lote (opcional, aplica a la próxima dispersión que crees)</h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <label style={styles.label}>Banco</label>
                <input style={styles.input} value={banco} onChange={(e) => setBanco(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Referencia</label>
                <input style={styles.input} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
              </div>
            </div>
          </section>

          <h2 style={styles.h2}>Periodos aprobados sin dispersión</h2>
          {cargando ? (
            <p style={styles.muted}>Cargando...</p>
          ) : periodosSinDispersion.length === 0 ? (
            <p style={{ ...styles.muted, marginBottom: 24 }}>No hay periodos pendientes de dispersión.</p>
          ) : (
            <div style={{ overflowX: "auto", marginBottom: 32 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Periodo</th>
                    <th style={styles.th}>Modo</th>
                    <th style={styles.th}>Neto a dispersar</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {periodosSinDispersion.map((p) => (
                    <tr key={p.id}>
                      <td style={styles.td}>{p.fecha_inicio} → {p.fecha_fin}</td>
                      <td style={styles.td}>{p.modo === "panama" ? "Panamá" : "US Corp"}</td>
                      <td style={{ ...styles.td, color: GOLD, fontWeight: "bold" as const }}>
                        {Number(p.total_neto).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        <button style={styles.btnPrimary} onClick={() => crearDispersion(p)}>
                          Crear dispersión
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={styles.h2}>Historial de dispersiones</h2>
          {cargando ? (
            <p style={styles.muted}>Cargando...</p>
          ) : dispersiones.length === 0 ? (
            <p style={styles.muted}>Todavía no se registraron dispersiones.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Banco</th>
                    <th style={styles.th}>Referencia</th>
                    <th style={styles.th}>Monto</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {dispersiones.map((d) => (
                    <tr key={d.id}>
                      <td style={styles.td}>{new Date(d.created_at).toLocaleString()}</td>
                      <td style={styles.td}>{d.banco ?? <span style={styles.muted}>—</span>}</td>
                      <td style={styles.td}>{d.referencia ?? <span style={styles.muted}>—</span>}</td>
                      <td style={{ ...styles.td, color: GOLD, fontWeight: "bold" as const }}>
                        {Number(d.monto_total).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge(d.estado)}>{d.estado}</span>
                      </td>
                      <td style={styles.td}>
                        {d.estado === "pendiente" && (
                          <button style={styles.btnSecondary} onClick={() => marcarEjecutada(d)}>
                            Marcar confirmada
                          </button>
                        )}
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