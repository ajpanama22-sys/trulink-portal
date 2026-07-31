// pages/admin/planilla-dispersion.tsx
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";

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
    // marca el periodo como pagado también
    await supabase.from("planilla_periodos").update({ estado: "pagado" }).eq("id", d.periodo_id);
    await cargar();
  }

  const periodosSinDispersion = periodosAprobados.filter(
    (p) => !dispersiones.some((d) => d.periodo_id === p.id)
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Planilla — Dispersión bancaria</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2>Datos del lote (opcional, aplica a la próxima dispersión que crees)</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <label>
            Banco
            <br />
            <input value={banco} onChange={(e) => setBanco(e.target.value)} />
          </label>
          <label>
            Referencia
            <br />
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </label>
        </div>
      </section>

      <h2>Periodos aprobados sin dispersión</h2>
      {cargando ? (
        <p>Cargando...</p>
      ) : periodosSinDispersion.length === 0 ? (
        <p>No hay periodos pendientes de dispersión.</p>
      ) : (
        <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th>Periodo</th>
              <th>Modo</th>
              <th>Neto a dispersar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periodosSinDispersion.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{p.fecha_inicio} → {p.fecha_fin}</td>
                <td>{p.modo === "panama" ? "Panamá" : "US Corp"}</td>
                <td>{Number(p.total_neto).toFixed(2)}</td>
                <td>
                  <button onClick={() => crearDispersion(p)}>Crear dispersión</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Historial de dispersiones</h2>
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th>Fecha</th>
              <th>Banco</th>
              <th>Referencia</th>
              <th>Monto</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dispersiones.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{new Date(d.created_at).toLocaleString()}</td>
                <td>{d.banco}</td>
                <td>{d.referencia}</td>
                <td>{Number(d.monto_total).toFixed(2)}</td>
                <td>{d.estado}</td>
                <td>
                  {d.estado === "pendiente" && (
                    <button onClick={() => marcarEjecutada(d)}>Marcar confirmada</button>
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
