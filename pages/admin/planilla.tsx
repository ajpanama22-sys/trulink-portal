// pages/admin/planilla.tsx
//
// Dashboard de periodos de planilla: crear periodo, generar detalle
// desde los empleados activos del modo elegido, aprobar (lo cual deja
// listo el periodo para que un job/función genere el asiento contable
// en tu módulo de contabilidad) y ver totales.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getSupabase } from "../../lib/supabaseClient";
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

// ---------- Estilos locales sin equivalente en lib/ui.tsx (tabla + label) ----------
const labelStyle: CSSProperties = {
  color: theme.textMuted,
  fontSize: "0.78rem",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "6px",
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

const errorBoxStyle: CSSProperties = {
  color: theme.red,
  background: theme.redBg,
  border: `1px solid ${theme.redBorder}`,
  borderRadius: theme.radiusSm,
  padding: "10px 14px",
  fontSize: "0.85rem",
  marginBottom: "20px",
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
    if (!supabase) return;
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Tu sesión expiró, volvé a iniciar sesión.");
        return;
      }

      const res = await fetch("/api/planilla/generar-egreso", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="planilla" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="Planilla — Periodos"
          subtitle="Creación de periodos, cálculo de deducciones y generación del asiento contable de nómina."
        />

        <Card>
          <Heading>Nuevo periodo</Heading>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>Modo</label>
              <select style={inputStyle} value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
                <option value="panama">Panamá</option>
                <option value="us_corp">Corporación Americana</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Inicio</label>
              <input style={inputStyle} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Fin</label>
              <input style={inputStyle} type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <Button onClick={crearPeriodo} disabled={creando}>
              {creando ? "Creando..." : "+ Crear periodo (con empleados activos)"}
            </Button>
          </div>
        </Card>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <Card>
          <Heading>Historial</Heading>
          {cargando ? (
            <p style={{ color: theme.textMuted, fontSize: 13 }}>Cargando...</p>
          ) : periodos.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: 13 }}>Todavía no hay periodos de planilla creados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Periodo</th>
                    <th style={thStyle}>Modo</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Bruto</th>
                    <th style={thStyle}>Deducciones</th>
                    <th style={thStyle}>Neto</th>
                    <th style={thStyle}>Egreso (CxP)</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {periodos.map((p) => (
                    <tr key={p.id}>
                      <td style={tdStyle}>{p.fecha_inicio} → {p.fecha_fin}</td>
                      <td style={tdStyle}>{p.modo === "panama" ? "Panamá" : "US Corp"}</td>
                      <td style={tdStyle}>
                        <Badge tone={estadoToTone(p.estado)}>{p.estado}</Badge>
                      </td>
                      <td style={tdStyle}>{Number(p.total_bruto).toFixed(2)}</td>
                      <td style={tdStyle}>{Number(p.total_deducciones).toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>
                        {Number(p.total_neto).toFixed(2)}
                      </td>
                      <td style={tdStyle}>
                        {p.cuenta_por_pagar_id ? (
                          <span style={{ color: theme.green }}>✔ #{p.cuenta_por_pagar_id}</span>
                        ) : (
                          <span style={{ color: theme.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {p.estado === "borrador" && (
                            <>
                              <Button variant="outline-gold" onClick={() => calcularDeducciones(p.id)}>
                                Calcular deducciones
                              </Button>
                              <Button variant="gold" onClick={() => aprobarPeriodo(p.id)}>
                                Aprobar
                              </Button>
                            </>
                          )}
                          {(p.estado === "aprobado" || p.estado === "pagado") && (
                            <>
                              <Button variant="ghost" onClick={() => generarComprobantes(p.id)}>
                                Comprobantes
                              </Button>
                              {!p.cuenta_por_pagar_id && (
                                <Button variant="gold" onClick={() => generarAsiento(p.id)}>
                                  Generar asiento
                                </Button>
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
        </Card>
      </div>
    </div>
  );
}
