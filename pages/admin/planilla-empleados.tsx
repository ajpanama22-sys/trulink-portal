// pages/admin/planilla-empleados.tsx
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

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
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Planilla — Empleados</h1>

      <div style={{ margin: "12px 0" }}>
        <label>
          Filtrar por modo:{" "}
          <select value={filtroModo} onChange={(e) => setFiltroModo(e.target.value as Modo | "todos")}>
            <option value="todos">Todos</option>
            <option value="panama">Panamá</option>
            <option value="us_corp">Corporación Americana</option>
          </select>
        </label>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h2>{editando ? "Editar empleado" : "Nuevo empleado"}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Modo
            <select
              value={form.modo}
              onChange={(e) => setForm({ ...form, modo: e.target.value as Modo })}
            >
              <option value="panama">Panamá</option>
              <option value="us_corp">Corporación Americana</option>
            </select>
          </label>

          <label>
            Nombre
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </label>

          <label>
            Identificación (cédula / SSN-ITIN)
            <input
              value={form.identificacion}
              onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
            />
          </label>

          <label>
            Puesto
            <input
              value={form.puesto ?? ""}
              onChange={(e) => setForm({ ...form, puesto: e.target.value })}
            />
          </label>

          <label>
            Email
            <input
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <label>
            Salario base
            <input
              type="number"
              value={form.salario_base}
              onChange={(e) => setForm({ ...form, salario_base: Number(e.target.value) })}
            />
          </label>

          <label>
            Fecha de ingreso
            <input
              type="date"
              value={form.fecha_ingreso}
              onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
            />
          </label>

          <label>
            Banco
            <input
              value={form.banco ?? ""}
              onChange={(e) => setForm({ ...form, banco: e.target.value })}
            />
          </label>

          <label>
            Cuenta bancaria
            <input
              value={form.cuenta_bancaria ?? ""}
              onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })}
            />
          </label>

          {form.modo === "panama" && (
            <label>
              Número de CSS
              <input
                value={form.numero_css ?? ""}
                onChange={(e) => setForm({ ...form, numero_css: e.target.value })}
              />
            </label>
          )}

          {form.modo === "us_corp" && (
            <>
              <label>
                Estado (US) de referencia
                <input
                  value={form.estado_us ?? ""}
                  onChange={(e) => setForm({ ...form, estado_us: e.target.value })}
                />
              </label>
              <label>
                Clasificación
                <select
                  value={form.clasificacion_us ?? ""}
                  onChange={(e) => setForm({ ...form, clasificacion_us: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="w2">W-2</option>
                  <option value="1099">1099</option>
                </select>
              </label>
            </>
          )}

          <label>
            Activo
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={guardar} disabled={guardando}>
            {editando ? "Guardar cambios" : "Crear empleado"}
          </button>
          {editando && (
            <button style={{ marginLeft: 8 }} onClick={() => iniciarEdicion(undefined)}>
              Cancelar
            </button>
          )}
        </div>
      </section>

      <h2>Listado</h2>
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th>Nombre</th>
              <th>Modo</th>
              <th>Puesto</th>
              <th>Salario</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp) => (
              <tr key={emp.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{emp.nombre}</td>
                <td>{emp.modo === "panama" ? "Panamá" : "US Corp"}</td>
                <td>{emp.puesto}</td>
                <td>
                  {emp.moneda} {emp.salario_base.toFixed(2)}
                </td>
                <td>{emp.activo ? "Sí" : "No"}</td>
                <td>
                  <button onClick={() => iniciarEdicion(emp)}>Editar</button>{" "}
                  <button onClick={() => eliminar(emp.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
