// pages/admin/planilla-empleados.tsx
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

type Modo = "panama" | "us_corp";

type Empleado = {
  id: string;
  modo: Modo;
  nombre: string;
  identificacion: string;
  puesto: string | null;
  email: string | null;
  salario_base: number;
  moneda: string;
  fecha_ingreso: string;
  activo: boolean;
  banco: string | null;
  cuenta_bancaria: string | null;
  tipo_cuenta: string | null;
  numero_css: string | null;
  estado_us: string | null;
  clasificacion_us: string | null;
  notas: string | null;
};

const empleadoVacio: Omit<Empleado, "id"> = {
  modo: "panama",
  nombre: "",
  identificacion: "",
  puesto: "",
  email: "",
  salario_base: 0,
  moneda: "USD",
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  activo: true,
  banco: "",
  cuenta_bancaria: "",
  tipo_cuenta: "",
  numero_css: "",
  estado_us: "",
  clasificacion_us: "",
  notas: "",
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
    width: "100%",
    boxSizing: "border-box" as const,
  },
  select: {
    background: "#000000",
    border: `1px solid ${GOLD_BORDER_SOFT}`,
    borderRadius: "8px",
    color: "#ffffff",
    padding: "9px 12px",
    fontSize: "0.9rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "26px",
  },
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
  btnDanger: {
    background: "transparent",
    color: "#ff6b6b",
    border: "1px solid rgba(255, 107, 107, 0.5)",
    fontWeight: "bold" as const,
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    letterSpacing: "0.3px",
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
  badgeActivo: (activo: boolean) => ({
    background: activo ? "rgba(80, 200, 120, 0.15)" : "rgba(255,255,255,0.08)",
    color: activo ? "#5ac87f" : "#999999",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: "bold" as const,
    letterSpacing: "0.3px",
    display: "inline-block",
  }),
  muted: { color: "#666666" },
};

export default function PlanillaEmpleadosPage() {
  const supabase = getSupabase();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [filtroModo, setFiltroModo] = useState<Modo | "todos">("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [form, setForm] = useState<Omit<Empleado, "id">>(empleadoVacio);
  const [guardando, setGuardando] = useState(false);

  async function cargarEmpleados() {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    setError(null);
    let query = supabase
      .from("planilla_empleados")
      .select("*")
      .order("nombre", { ascending: true });

    if (filtroModo !== "todos") {
      query = query.eq("modo", filtroModo);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setEmpleados(data as Empleado[]);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroModo]);

  function iniciarEdicion(emp?: Empleado) {
    if (emp) {
      setEditando(emp);
      const { id, ...resto } = emp;
      setForm(resto);
    } else {
      setEditando(null);
      setForm(empleadoVacio);
    }
  }

  async function guardar() {
    if (!supabase) return;
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        const { error } = await supabase
          .from("planilla_empleados")
          .update(form)
          .eq("id", editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planilla_empleados").insert(form);
        if (error) throw error;
      }
      setEditando(null);
      setForm(empleadoVacio);
      await cargarEmpleados();
    } catch (e: any) {
      setError(e.message ?? "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    if (!supabase) return;
    if (!confirm("¿Eliminar este empleado de planilla?")) return;
    const { error } = await supabase.from("planilla_empleados").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      await cargarEmpleados();
    }
  }

  return (
    <div style={styles.page}>
      <Sidebar currentActive="planilla-empleados" />

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "25px", flexWrap: "wrap", gap: "15px" }}>
            <div>
              <h1 style={styles.h1}>PLANILLA — EMPLEADOS</h1>
              <p style={styles.subtitle}>Alta, edición y baja de empleados por modo (Panamá / Corporación Americana).</p>
            </div>
            <div>
              <label style={styles.label}>Filtrar por modo</label>
              <select
                style={{ ...styles.select, width: "auto" }}
                value={filtroModo}
                onChange={(e) => setFiltroModo(e.target.value as Modo | "todos")}
              >
                <option value="todos">Todos</option>
                <option value="panama">Panamá</option>
                <option value="us_corp">Corporación Americana</option>
              </select>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <section style={styles.section}>
            <h2 style={styles.h2}>{editando ? "Editar empleado" : "Nuevo empleado"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={styles.label}>Modo</label>
                <select
                  style={styles.select}
                  value={form.modo}
                  onChange={(e) => setForm({ ...form, modo: e.target.value as Modo })}
                >
                  <option value="panama">Panamá</option>
                  <option value="us_corp">Corporación Americana</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Nombre</label>
                <input
                  style={styles.input}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>

              <div>
                <label style={styles.label}>Identificación (cédula / SSN-ITIN)</label>
                <input
                  style={styles.input}
                  value={form.identificacion}
                  onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                />
              </div>

              <div>
                <label style={styles.label}>Puesto</label>
                <input
                  style={styles.input}
                  value={form.puesto ?? ""}
                  onChange={(e) => setForm({ ...form, puesto: e.target.value })}
                />
              </div>

              <div>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label style={styles.label}>Salario base</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.salario_base}
                  onChange={(e) => setForm({ ...form, salario_base: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={styles.label}>Fecha de ingreso</label>
                <input
                  style={styles.input}
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
                />
              </div>

              <div>
                <label style={styles.label}>Banco</label>
                <input
                  style={styles.input}
                  value={form.banco ?? ""}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                />
              </div>

              <div>
                <label style={styles.label}>Cuenta bancaria</label>
                <input
                  style={styles.input}
                  value={form.cuenta_bancaria ?? ""}
                  onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })}
                />
              </div>

              {form.modo === "panama" && (
                <div>
                  <label style={styles.label}>Número de CSS</label>
                  <input
                    style={styles.input}
                    value={form.numero_css ?? ""}
                    onChange={(e) => setForm({ ...form, numero_css: e.target.value })}
                  />
                </div>
              )}

              {form.modo === "us_corp" && (
                <>
                  <div>
                    <label style={styles.label}>Estado (US) de referencia</label>
                    <input
                      style={styles.input}
                      value={form.estado_us ?? ""}
                      onChange={(e) => setForm({ ...form, estado_us: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Clasificación</label>
                    <select
                      style={styles.select}
                      value={form.clasificacion_us ?? ""}
                      onChange={(e) => setForm({ ...form, clasificacion_us: e.target.value })}
                    >
                      <option value="">—</option>
                      <option value="w2">W-2</option>
                      <option value="1099">1099</option>
                    </select>
                  </div>
                </>
              )}

              <div style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: GOLD }}
                />
                <label style={{ ...styles.label, marginBottom: 0 }}>Activo</label>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{ ...styles.btnPrimary, ...(guardando ? styles.btnPrimaryDisabled : {}) }}
              >
                {editando ? "Guardar cambios" : "+ Crear empleado"}
              </button>
              {editando && (
                <button style={styles.btnGhost} onClick={() => iniciarEdicion(undefined)}>
                  Cancelar
                </button>
              )}
            </div>
          </section>

          <h2 style={styles.h2}>Listado</h2>
          {cargando ? (
            <p style={styles.muted}>Cargando...</p>
          ) : empleados.length === 0 ? (
            <p style={styles.muted}>No hay empleados registrados para este filtro.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Modo</th>
                    <th style={styles.th}>Puesto</th>
                    <th style={styles.th}>Salario</th>
                    <th style={styles.th}>Activo</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ ...styles.td, color: "#ffffff", fontWeight: "bold" as const }}>{emp.nombre}</td>
                      <td style={styles.td}>{emp.modo === "panama" ? "Panamá" : "US Corp"}</td>
                      <td style={styles.td}>{emp.puesto}</td>
                      <td style={{ ...styles.td, color: GOLD, fontWeight: "bold" as const }}>
                        {emp.moneda} {emp.salario_base.toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badgeActivo(emp.activo)}>{emp.activo ? "Sí" : "No"}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={styles.btnSecondary} onClick={() => iniciarEdicion(emp)}>
                            Editar
                          </button>
                          <button style={styles.btnDanger} onClick={() => eliminar(emp.id)}>
                            Eliminar
                          </button>
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