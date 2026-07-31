// pages/admin/planilla.tsx
//
// Dashboard de periodos de planilla: crear periodo, generar detalle
// desde los empleados activos del modo elegido, aprobar (lo cual deja
// listo el periodo para que un job/función genere el asiento contable
// en tu módulo de contabilidad) y ver totales.
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

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

  // Crea el periodo y genera automáticamente el detalle a partir de
  // los empleados activos del modo seleccionado, usando su salario base
  // (sin deducciones calculadas todavía; eso lo completas en el detalle
  // o en un paso posterior según tus reglas de CSS / US payroll).
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
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Planilla — Periodos</h1>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2>Nuevo periodo</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label>
            Modo
            <br />
            <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
              <option value="panama">Panamá</option>
              <option value="us_corp">Corporación Americana</option>
            </select>
          </label>
          <label>
            Inicio
            <br />
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </label>
          <label>
            Fin
            <br />
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </label>
          <button onClick={crearPeriodo} disabled={creando}>
            {creando ? "Creando..." : "Crear periodo (con empleados activos)"}
          </button>
        </div>
      </section>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Historial</h2>
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th>Periodo</th>
              <th>Modo</th>
              <th>Estado</th>
              <th>Bruto</th>
              <th>Deducciones</th>
              <th>Neto</th>
              <th>Egreso (CxP)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>
                  {p.fecha_inicio} → {p.fecha_fin}
                </td>
                <td>{p.modo === "panama" ? "Panamá" : "US Corp"}</td>
                <td>{p.estado}</td>
                <td>{Number(p.total_bruto).toFixed(2)}</td>
                <td>{Number(p.total_deducciones).toFixed(2)}</td>
                <td>{Number(p.total_neto).toFixed(2)}</td>
                <td>{p.cuenta_por_pagar_id ? `✔ #${p.cuenta_por_pagar_id}` : "—"}</td>
                <td>
                  {p.estado === "borrador" && (
                    <>
                      <button onClick={() => calcularDeducciones(p.id)}>Calcular deducciones</button>{" "}
                      <button onClick={() => aprobarPeriodo(p.id)}>Aprobar</button>
                    </>
                  )}
                  {(p.estado === "aprobado" || p.estado === "pagado") && (
                    <>
                      <button onClick={() => generarComprobantes(p.id)}>Comprobantes</button>{" "}
                      {!p.cuenta_por_pagar_id && (
                        <button onClick={() => generarAsiento(p.id)}>Generar asiento</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
