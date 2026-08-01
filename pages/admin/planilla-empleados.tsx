// pages/admin/planilla-empleados.tsx
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import { useRequiereRol } from "../../lib/useRequiereRol";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import {
  Card,
  Heading,
  PageHeader,
  Button,
  Badge,
  estadoToTone,
  inputStyle,
} from "../../lib/ui";

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

// ---------- Estilos locales sin equivalente en lib/ui.tsx ----------
const labelStyle: CSSProperties = {
  color: theme.textMuted,
  fontSize: "0.78rem",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "6px",
};

const fullInputStyle: CSSProperties = {
  ...inputStyle,
  width: "100%",
  boxSizing: "border-box",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.87rem",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  color: theme.gold,
  fontSize: "0.75rem",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  padding: "10px 12px",
  borderBottom: `1px solid ${theme.borderGoldLight}`,
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: theme.textLight,
};

export default function PlanillaEmpleadosPage() {
  // ── Guard de página: solo Super Administrador y Administrador ──
  const { cargando: cargandoAuth, autorizado } = useRequiereRol(["Super Administrador", "Administrador"]);

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
    if (!autorizado) return;
    cargarEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroModo, autorizado]);

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

  // ── Guard de acceso ──
  if (cargandoAuth) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          width: "100%",
          backgroundColor: theme.background,
          color: theme.textLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: theme.gold }}>Verificando acceso...</span>
      </div>
    );
  }
  if (!autorizado) {
    return null; // useRequiereRol ya redirigió
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="planilla-empleados" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="PLANILLA — EMPLEADOS"
          subtitle="Alta, edición y baja de empleados por modo (Panamá / Corporación Americana)."
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Filtrar por modo</label>
            <select
              style={{ ...inputStyle, width: "auto" }}
              value={filtroModo}
              onChange={(e) => setFiltroModo(e.target.value as Modo | "todos")}
            >
              <option value="todos">Todos</option>
              <option value="panama">Panamá</option>
              <option value="us_corp">Corporación Americana</option>
            </select>
          </div>
        </div>

        {error && (
          <div
            style={{
              color: theme.red,
              background: theme.redBg,
              border: `1px solid ${theme.redBorder}`,
              borderRadius: theme.radiusSm,
              padding: "10px 14px",
              fontSize: "0.85rem",
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <Card>
          <Heading>{editando ? "Editar empleado" : "Nuevo empleado"}</Heading>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Modo</label>
              <select
                style={inputStyle}
                value={form.modo}
                onChange={(e) => setForm({ ...form, modo: e.target.value as Modo })}
              >
                <option value="panama">Panamá</option>
                <option value="us_corp">Corporación Americana</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Nombre</label>
              <input
                style={fullInputStyle}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Identificación (cédula / SSN-ITIN)</label>
              <input
                style={fullInputStyle}
                value={form.identificacion}
                onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Puesto</label>
              <input
                style={fullInputStyle}
                value={form.puesto ?? ""}
                onChange={(e) => setForm({ ...form, puesto: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={fullInputStyle}
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Salario base</label>
              <input
                style={fullInputStyle}
                type="number"
                value={form.salario_base}
                onChange={(e) => setForm({ ...form, salario_base: Number(e.target.value) })}
              />
            </div>

            <div>
              <label style={labelStyle}>Fecha de ingreso</label>
              <input
                style={fullInputStyle}
                type="date"
                value={form.fecha_ingreso}
                onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Banco</label>
              <input
                style={fullInputStyle}
                value={form.banco ?? ""}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Cuenta bancaria</label>
              <input
                style={fullInputStyle}
                value={form.cuenta_bancaria ?? ""}
                onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })}
              />
            </div>

            {form.modo === "panama" && (
              <div>
                <label style={labelStyle}>Número de CSS</label>
                <input
                  style={fullInputStyle}
                  value={form.numero_css ?? ""}
                  onChange={(e) => setForm({ ...form, numero_css: e.target.value })}
                />
              </div>
            )}

            {form.modo === "us_corp" && (
              <>
                <div>
                  <label style={labelStyle}>Estado (US) de referencia</label>
                  <input
                    style={fullInputStyle}
                    value={form.estado_us ?? ""}
                    onChange={(e) => setForm({ ...form, estado_us: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Clasificación</label>
                  <select
                    style={inputStyle}
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26 }}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: theme.gold }}
              />
              <label style={{ ...labelStyle, marginBottom: 0 }}>Activo</label>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <Button onClick={guardar} disabled={guardando}>
              {editando ? "Guardar cambios" : "+ Crear empleado"}
            </Button>
            {editando && (
              <Button variant="ghost" onClick={() => iniciarEdicion(undefined)}>
                Cancelar
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <Heading>Listado</Heading>
          {cargando ? (
            <p style={{ color: theme.textMuted }}>Cargando...</p>
          ) : empleados.length === 0 ? (
            <p style={{ color: theme.textMuted }}>No hay empleados registrados para este filtro.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nombre</th>
                    <th style={thStyle}>Modo</th>
                    <th style={thStyle}>Puesto</th>
                    <th style={thStyle}>Salario</th>
                    <th style={thStyle}>Activo</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ ...tdStyle, color: theme.textLight, fontWeight: "bold" }}>{emp.nombre}</td>
                      <td style={tdStyle}>{emp.modo === "panama" ? "Panamá" : "US Corp"}</td>
                      <td style={tdStyle}>{emp.puesto}</td>
                      <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>
                        {emp.moneda} {emp.salario_base.toFixed(2)}
                      </td>
                      <td style={tdStyle}>
                        <Badge tone={estadoToTone(emp.activo ? "activo" : "inactivo")}>
                          {emp.activo ? "Sí" : "No"}
                        </Badge>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button variant="outline-gold" onClick={() => iniciarEdicion(emp)}>
                            Editar
                          </Button>
                          <Button variant="outline-red" onClick={() => eliminar(emp.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
