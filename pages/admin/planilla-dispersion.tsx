// pages/admin/planilla-dispersion.tsx
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

// ---------- Estilos locales (tabla no tiene componente equivalente en lib/ui) ----------
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

export default function PlanillaDispersionPage() {
  // ── Guard de página: solo Super Administrador y Administrador ──
  const { cargando: cargandoAuth, autorizado } = useRequiereRol(["Super Administrador", "Administrador"]);

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
    if (!autorizado) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado]);

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

  // ── Guard de acceso ──
  if (cargandoAuth) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar currentActive="planilla-dispersion" />
        <div style={pageWrapStyle()}>
          <p style={{ color: theme.gold }}>Verificando acceso...</p>
        </div>
      </div>
    );
  }
  if (!autorizado) {
    return null;
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="planilla-dispersion" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="PLANILLA — DISPERSIÓN BANCARIA"
          subtitle="Generación y seguimiento de los lotes de pago a empleados."
        />

        {error && <div style={errorBoxStyle}>{error}</div>}

        <Card>
          <Heading>Datos del lote (opcional, aplica a la próxima dispersión que crees)</Heading>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>Banco</label>
              <input style={inputStyle} value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Referencia</label>
              <input style={inputStyle} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <Heading>Periodos aprobados sin dispersión</Heading>
          {cargando ? (
            <p style={{ color: theme.textMuted }}>Cargando...</p>
          ) : periodosSinDispersion.length === 0 ? (
            <p style={{ color: theme.textMuted }}>No hay periodos pendientes de dispersión.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Periodo</th>
                    <th style={thStyle}>Modo</th>
                    <th style={thStyle}>Neto a dispersar</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {periodosSinDispersion.map((p) => (
                    <tr key={p.id}>
                      <td style={tdStyle}>{p.fecha_inicio} → {p.fecha_fin}</td>
                      <td style={tdStyle}>{p.modo === "panama" ? "Panamá" : "US Corp"}</td>
                      <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>
                        {Number(p.total_neto).toFixed(2)}
                      </td>
                      <td style={tdStyle}>
                        <Button onClick={() => crearDispersion(p)}>Crear dispersión</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <Heading>Historial de dispersiones</Heading>
          {cargando ? (
            <p style={{ color: theme.textMuted }}>Cargando...</p>
          ) : dispersiones.length === 0 ? (
            <p style={{ color: theme.textMuted }}>Todavía no se registraron dispersiones.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Banco</th>
                    <th style={thStyle}>Referencia</th>
                    <th style={thStyle}>Monto</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {dispersiones.map((d) => (
                    <tr key={d.id}>
                      <td style={tdStyle}>{new Date(d.created_at).toLocaleString()}</td>
                      <td style={tdStyle}>{d.banco ?? <span style={{ color: theme.textMuted }}>—</span>}</td>
                      <td style={tdStyle}>{d.referencia ?? <span style={{ color: theme.textMuted }}>—</span>}</td>
                      <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>
                        {Number(d.monto_total).toFixed(2)}
                      </td>
                      <td style={tdStyle}>
                        <Badge tone={estadoToTone(d.estado)}>{d.estado}</Badge>
                      </td>
                      <td style={tdStyle}>
                        {d.estado === "pendiente" && (
                          <Button variant="outline-green" onClick={() => marcarEjecutada(d)}>
                            Marcar confirmada
                          </Button>
                        )}
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
