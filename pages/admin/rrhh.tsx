import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient"; // ajusta esta ruta si tu cliente vive en otro lado
import Sidebar from "./Sidebar";
import jsPDF from "jspdf";

// ============================================================
// Tema visual — navy + circuitos + dorado metálico (portal Trulink)
// ============================================================
const theme = {
  navyDark: "#0a1526",
  navyMid: "#0f1f3d",
  navyCard: "rgba(13, 27, 51, 0.88)",
  navyCardHover: "rgba(18, 35, 64, 0.95)",
  gold: "#DAA520",
  goldBright: "#FFD700",
  goldGlow: "rgba(218, 165, 32, 0.35)",
  textLight: "#E8ECF5",
  textMuted: "#9FB0C9",
  green: "#2ecc71",
  red: "#e74c3c",
};

const circuitPatternSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'><g fill='none' stroke='rgba(218,165,32,0.10)' stroke-width='1'><path d='M30 0 L60 17.3 L60 51.9 L30 69.2 L0 51.9 L0 17.3 Z'/><path d='M90 0 L120 17.3 L120 51.9 L90 69.2 L60 51.9 L60 17.3 Z'/><path d='M30 69.2 L60 86.5 L60 121 L30 138 L0 121 L0 86.5 Z'/></g></svg>`;
const circuitBg = `url("data:image/svg+xml,${encodeURIComponent(circuitPatternSVG)}")`;

function pageWrapStyle(): React.CSSProperties {
  return {
    flex: 1,
    minHeight: "100vh",
    background: `linear-gradient(160deg, ${theme.navyDark} 0%, ${theme.navyMid} 100%)`,
    backgroundImage: `${circuitBg}, linear-gradient(160deg, ${theme.navyDark} 0%, ${theme.navyMid} 100%)`,
    backgroundRepeat: "repeat, no-repeat",
    color: theme.textLight,
    padding: "36px 40px",
    boxSizing: "border-box",
  };
}

const cardStyle: React.CSSProperties = {
  background: theme.navyCard,
  border: `1.5px solid ${theme.gold}`,
  borderRadius: 14,
  padding: "22px 24px",
  boxShadow: `0 0 18px ${theme.goldGlow}`,
};

const inputStyle: React.CSSProperties = {
  background: "rgba(6, 14, 28, 0.8)",
  border: `1px solid ${theme.gold}`,
  borderRadius: 8,
  padding: "9px 12px",
  color: theme.textLight,
  fontSize: 13,
  outline: "none",
};

function goldButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    background: disabled
      ? "linear-gradient(180deg, #8a752f, #5f4f1f)"
      : `linear-gradient(180deg, ${theme.goldBright}, ${theme.gold})`,
    color: "#1a1200",
    border: `1px solid ${theme.gold}`,
    borderRadius: 10,
    padding: "11px 18px",
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: "0.4px",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `0 0 14px ${theme.goldGlow}`,
    textTransform: "uppercase",
  };
}

function outlineButtonStyle(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1.5px solid ${color}`,
    color,
    borderRadius: 10,
    padding: "10px 18px",
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: "0.4px",
    cursor: "pointer",
    textTransform: "uppercase",
  };
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    border: `1px solid ${color}`,
    color,
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  };
}

const goldHeading: React.CSSProperties = {
  color: theme.goldBright,
  textShadow: `0 0 12px ${theme.goldGlow}`,
  fontWeight: 900,
  letterSpacing: "0.5px",
};

// ============================================================
// Tipos
// ============================================================
type Colaborador = {
  id: string;
  nombre: string;
  email: string;
  rol?: string;
  departamento?: string;
  cedula?: string;
  auth_id: string;
};

type Planilla = {
  email: string;
  identificacion?: string;
  puesto?: string;
  salario_base?: number;
  moneda?: string;
  fecha_ingreso?: string; // date
};

type Documento = {
  id: string;
  tipo: string;
  nombre_archivo: string;
  generado_en: string;
};

type Solicitud = {
  id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string;
  estado: string;
  created_at: string;
};

type Marcaje = {
  id: string;
  tipo: string;
  marcado_en: string;
};

type Evaluacion = {
  id: string;
  periodo: string;
  autoevaluacion?: string;
  created_at: string;
};

type Capacitacion = {
  id: string;
  curso_nombre: string;
  estado: string;
  fecha_completado?: string;
};

const TABS = [
  "Perfil",
  "Documentos",
  "Vacaciones/Permisos",
  "Marcaje",
  "Desempeño",
  "Capacitación",
] as const;
type Tab = (typeof TABS)[number];

// ============================================================
// Página principal
// ============================================================
export default function RRHH() {
  const [tab, setTab] = useState<Tab>("Perfil");
  const [loading, setLoading] = useState(true);
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [planilla, setPlanilla] = useState<Planilla | null>(null);

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [marcajes, setMarcajes] = useState<Marcaje[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const authId = authData?.user?.id;
    if (!authId) {
      setLoading(false);
      setMsg("No hay sesión activa.");
      return;
    }

    const { data: colab, error: colabErr } = await supabase
      .from("colaboradores")
      .select("id, nombre, email, rol, departamento, cedula, auth_id")
      .eq("auth_id", authId)
      .single();

    if (colabErr || !colab) {
      setLoading(false);
      setMsg(
        "No se encontró tu colaborador vinculado a este usuario (auth_id). Contacta a RRHH."
      );
      return;
    }
    setColaborador(colab);

    // Traer puesto / salario / fecha de ingreso real desde planilla_empleados, vinculado por email
    const { data: plan } = await supabase
      .from("planilla_empleados")
      .select("email, identificacion, puesto, salario_base, moneda, fecha_ingreso")
      .eq("email", colab.email)
      .single();
    setPlanilla(plan ?? null);

    const [{ data: docs }, { data: sols }, { data: marcs }, { data: evals }, { data: caps }] =
      await Promise.all([
        supabase
          .from("documentos_colaborador")
          .select("id, tipo, nombre_archivo, generado_en")
          .eq("colaborador_id", colab.id)
          .order("generado_en", { ascending: false }),
        supabase
          .from("solicitudes_ausencia")
          .select("id, tipo, fecha_inicio, fecha_fin, motivo, estado, created_at")
          .eq("colaborador_id", colab.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("marcajes")
          .select("id, tipo, marcado_en")
          .eq("colaborador_id", colab.id)
          .order("marcado_en", { ascending: false })
          .limit(30),
        supabase
          .from("evaluaciones_desempeno")
          .select("id, periodo, autoevaluacion, created_at")
          .eq("colaborador_id", colab.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("capacitaciones")
          .select("id, curso_nombre, estado, fecha_completado")
          .eq("colaborador_id", colab.id)
          .order("created_at", { ascending: false }),
      ]);

    setDocumentos(docs ?? []);
    setSolicitudes(sols ?? []);
    setMarcajes(marcs ?? []);
    setEvaluaciones(evals ?? []);
    setCapacitaciones(caps ?? []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar currentActive="rrhh" />
        <div style={pageWrapStyle()}>
          <p style={{ color: theme.textMuted }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar currentActive="rrhh" />
        <div style={pageWrapStyle()}>
          <p style={{ color: theme.red }}>{msg ?? "No se pudo cargar tu información."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="rrhh" />
      <div style={pageWrapStyle()}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ ...goldHeading, fontSize: 30, marginBottom: 4 }}>MI RRHH</h1>
          <p style={{ color: theme.textMuted, marginBottom: 28 }}>
            {colaborador.nombre} — {colaborador.rol ?? "Colaborador"}
          </p>

          {/* Navegación de pestañas */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={active ? goldButtonStyle() : outlineButtonStyle(theme.gold)}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {msg && (
            <p style={{ color: theme.goldBright, marginBottom: 16, fontSize: 13 }}>{msg}</p>
          )}

          {tab === "Perfil" && <PerfilTab colaborador={colaborador} planilla={planilla} />}
          {tab === "Documentos" && (
            <DocumentosTab
              colaborador={colaborador}
              planilla={planilla}
              documentos={documentos}
              onGenerado={cargarTodo}
            />
          )}
          {tab === "Vacaciones/Permisos" && (
            <VacacionesTab
              colaborador={colaborador}
              solicitudes={solicitudes}
              onCreado={cargarTodo}
            />
          )}
          {tab === "Marcaje" && (
            <MarcajeTab colaborador={colaborador} marcajes={marcajes} onMarcado={cargarTodo} />
          )}
          {tab === "Desempeño" && (
            <DesempenoTab
              colaborador={colaborador}
              evaluaciones={evaluaciones}
              onCreado={cargarTodo}
            />
          )}
          {tab === "Capacitación" && (
            <CapacitacionTab capacitaciones={capacitaciones} onCambio={cargarTodo} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Perfil
// ============================================================
function PerfilTab({
  colaborador,
  planilla,
}: {
  colaborador: Colaborador;
  planilla: Planilla | null;
}) {
  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
      <Campo label="Nombre" valor={colaborador.nombre} />
      <Campo label="Email" valor={colaborador.email} />
      <Campo label="Rol (sistema)" valor={colaborador.rol ?? "—"} />
      <Campo label="Departamento" valor={colaborador.departamento ?? "—"} />
      <Campo label="Puesto" valor={planilla?.puesto ?? "No disponible en planilla"} />
      <Campo label="Cédula" valor={colaborador.cedula ?? "No disponible"} />
      <Campo
        label="Fecha de ingreso"
        valor={planilla?.fecha_ingreso ?? "No disponible en planilla"}
      />
      <Campo
        label="Salario"
        valor={
          planilla?.salario_base != null
            ? `${planilla.moneda ?? "USD"} ${planilla.salario_base.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}`
            : "No disponible en planilla"
        }
      />
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(218,165,32,0.2)",
        paddingBottom: 10,
      }}
    >
      <span style={{ color: theme.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: theme.textLight, fontWeight: 700, fontSize: 13 }}>{valor}</span>
    </div>
  );
}

// ============================================================
// Documentos + Carta de Trabajo (PDF con logo y sello)
// ============================================================
function DocumentosTab({
  colaborador,
  planilla,
  documentos,
  onGenerado,
}: {
  colaborador: Colaborador;
  planilla: Planilla | null;
  documentos: Documento[];
  onGenerado: () => void;
}) {
  const [generando, setGenerando] = useState(false);

  async function generarCartaTrabajo() {
    setGenerando(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });

      // Logo — esquina superior izquierda
      try {
        const logoResp = await fetch("/images/logo.png");
        const logoBlob = await logoResp.blob();
        const logoDataUrl = await blobToDataURL(logoBlob);
        doc.addImage(logoDataUrl, "PNG", 40, 30, 100, 50);
      } catch {
        // si el logo no carga, seguimos sin bloquear la generación del PDF
      }

      const hoy = new Date().toLocaleDateString("es-PA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      doc.setFontSize(16);
      doc.text("CARTA DE TRABAJO", 300, 110, { align: "center" });

      doc.setFontSize(11);
      const fechaIngreso = planilla?.fecha_ingreso
        ? new Date(planilla.fecha_ingreso).toLocaleDateString("es-PA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "________________";

      const salario =
        planilla?.salario_base != null
          ? `${planilla.moneda ?? "USD"} ${planilla.salario_base.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}`
          : "________________";

      const cedula = colaborador.cedula ?? planilla?.identificacion ?? "______________________";
      const puesto = planilla?.puesto ?? colaborador.rol ?? "________________";

      const cuerpo = `Por medio de la presente se hace constar que ${colaborador.nombre}, portador(a) de la cédula de identidad personal N° ${cedula}, labora en esta empresa desde el ${fechaIngreso}, desempeñando el cargo de ${puesto}, con un salario mensual de ${salario}.

Se extiende la presente carta a solicitud del interesado(a) para los fines que estime conveniente.`;

      const lineas = doc.splitTextToSize(cuerpo, 500);
      doc.text(lineas, 60, 160);

      doc.text(`Panamá, ${hoy}.`, 60, 340);

      doc.text("_______________________________", 60, 420);
      doc.text("Recursos Humanos", 60, 435);

      // Sello — esquina inferior derecha, tamaño normal y sin deformar
      try {
        const selloResp = await fetch("/images/firmaco.png");
        const selloBlob = await selloResp.blob();
        const selloDataUrl = await blobToDataURL(selloBlob);
        const { width: naturalW, height: naturalH } = await getImageDimensions(selloDataUrl);

        const anchoDeseado = 70; // pt — tamaño "normal" de un sello
        const alto = (naturalH / naturalW) * anchoDeseado;

        const margenDerecho = 60;
        const margenInferior = 60;
        const x = 612 - margenDerecho - anchoDeseado;
        const y = 792 - margenInferior - alto;

        doc.addImage(selloDataUrl, "PNG", x, y, anchoDeseado, alto);
      } catch {
        // si el sello no carga, seguimos sin bloquear la generación del PDF
      }

      const nombreArchivo = `carta_trabajo_${colaborador.nombre.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      doc.save(nombreArchivo);

      await supabase.from("documentos_colaborador").insert({
        colaborador_id: colaborador.id,
        tipo: "carta_trabajo",
        nombre_archivo: nombreArchivo,
        generado_por: colaborador.id,
      });

      onGenerado();
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 6 }}>CARTA DE TRABAJO</h2>
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
          Genera tu carta de trabajo en PDF con tu puesto, fecha de ingreso y salario
          actual según planilla.
        </p>
        <button
          onClick={generarCartaTrabajo}
          disabled={generando}
          style={goldButtonStyle(generando)}
        >
          {generando ? "Generando..." : "Generar Carta de Trabajo (PDF)"}
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>DOCUMENTOS GENERADOS</h2>
        {documentos.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 13 }}>Aún no has generado documentos.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {documentos.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(218,165,32,0.15)",
                  paddingBottom: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: theme.textLight }}>{d.nombre_archivo}</span>
                <span style={{ color: theme.textMuted }}>
                  {new Date(d.generado_en).toLocaleString("es-PA")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// Vacaciones / Permisos
// ============================================================
function VacacionesTab({
  colaborador,
  solicitudes,
  onCreado,
}: {
  colaborador: Colaborador;
  solicitudes: Solicitud[];
  onCreado: () => void;
}) {
  const [tipo, setTipo] = useState("vacaciones");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!inicio || !fin) return;
    setEnviando(true);
    await supabase.from("solicitudes_ausencia").insert({
      colaborador_id: colaborador.id,
      tipo,
      fecha_inicio: inicio,
      fecha_fin: fin,
      motivo,
    });
    setInicio("");
    setFin("");
    setMotivo("");
    setEnviando(false);
    onCreado();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>NUEVA SOLICITUD</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={inputStyle}
          >
            <option value="vacaciones">Vacaciones</option>
            <option value="permiso">Permiso</option>
            <option value="incapacidad">Incapacidad</option>
          </select>
          <div />
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            style={inputStyle}
          />
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Motivo (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{ ...inputStyle, gridColumn: "1 / -1", minHeight: 60, resize: "vertical" }}
          />
        </div>
        <button
          onClick={enviar}
          disabled={enviando || !inicio || !fin}
          style={{ ...goldButtonStyle(enviando || !inicio || !fin), marginTop: 14 }}
        >
          {enviando ? "Enviando..." : "Enviar solicitud"}
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>MIS SOLICITUDES</h2>
        {solicitudes.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 13 }}>No tienes solicitudes registradas.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {solicitudes.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(218,165,32,0.15)",
                  paddingBottom: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: theme.textLight }}>
                  {s.tipo} — {s.fecha_inicio} a {s.fecha_fin}
                </span>
                <EstadoBadge estado={s.estado} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const colores: Record<string, string> = {
    pendiente: theme.gold,
    aprobado: theme.green,
    rechazado: theme.red,
    completado: theme.green,
    en_progreso: theme.gold,
  };
  const color = colores[estado] ?? theme.textMuted;
  return <span style={pillStyle(color)}>{estado}</span>;
}

// ============================================================
// Marcaje
// ============================================================
function MarcajeTab({
  colaborador,
  marcajes,
  onMarcado,
}: {
  colaborador: Colaborador;
  marcajes: Marcaje[];
  onMarcado: () => void;
}) {
  const [marcando, setMarcando] = useState(false);
  const ultimo = marcajes[0];
  const siguienteTipo = ultimo?.tipo === "entrada" ? "salida" : "entrada";

  async function marcar() {
    setMarcando(true);
    await supabase.from("marcajes").insert({
      colaborador_id: colaborador.id,
      tipo: siguienteTipo,
    });
    setMarcando(false);
    onMarcado();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 4 }}>
            MARCAR {siguienteTipo.toUpperCase()}
          </h2>
          <p style={{ color: theme.textMuted, fontSize: 13 }}>
            Último marcaje:{" "}
            {ultimo
              ? `${ultimo.tipo} — ${new Date(ultimo.marcado_en).toLocaleString("es-PA")}`
              : "sin registros"}
          </p>
        </div>
        <button
          onClick={marcar}
          disabled={marcando}
          style={outlineButtonStyle(siguienteTipo === "entrada" ? theme.green : theme.red)}
        >
          {marcando ? "Marcando..." : `Marcar ${siguienteTipo}`}
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>HISTORIAL RECIENTE</h2>
        {marcajes.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 13 }}>Sin marcajes registrados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {marcajes.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(218,165,32,0.15)",
                  paddingBottom: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: theme.textLight, textTransform: "capitalize" }}>
                  {m.tipo}
                </span>
                <span style={{ color: theme.textMuted }}>
                  {new Date(m.marcado_en).toLocaleString("es-PA")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Desempeño
// ============================================================
function DesempenoTab({
  colaborador,
  evaluaciones,
  onCreado,
}: {
  colaborador: Colaborador;
  evaluaciones: Evaluacion[];
  onCreado: () => void;
}) {
  const [periodo, setPeriodo] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!periodo || !texto) return;
    setEnviando(true);
    await supabase.from("evaluaciones_desempeno").insert({
      colaborador_id: colaborador.id,
      periodo,
      autoevaluacion: texto,
    });
    setPeriodo("");
    setTexto("");
    setEnviando(false);
    onCreado();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>NUEVA AUTOEVALUACIÓN</h2>
        <input
          placeholder="Periodo (ej. 2026-Q3)"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginBottom: 12, boxSizing: "border-box" }}
        />
        <textarea
          placeholder="Tu autoevaluación..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          style={{ ...inputStyle, width: "100%", marginBottom: 14, boxSizing: "border-box", resize: "vertical" }}
        />
        <button
          onClick={enviar}
          disabled={enviando || !periodo || !texto}
          style={goldButtonStyle(enviando || !periodo || !texto)}
        >
          {enviando ? "Guardando..." : "Guardar autoevaluación"}
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>HISTORIAL</h2>
        {evaluaciones.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 13 }}>Sin autoevaluaciones registradas.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {evaluaciones.map((e) => (
              <div
                key={e.id}
                style={{ borderBottom: "1px solid rgba(218,165,32,0.15)", paddingBottom: 10 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: theme.goldBright, fontWeight: 700 }}>{e.periodo}</span>
                  <span style={{ color: theme.textMuted }}>
                    {new Date(e.created_at).toLocaleDateString("es-PA")}
                  </span>
                </div>
                {e.autoevaluacion && (
                  <p style={{ color: theme.textLight, marginTop: 6, fontSize: 13 }}>
                    {e.autoevaluacion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Capacitación
// ============================================================
function CapacitacionTab({
  capacitaciones,
  onCambio,
}: {
  capacitaciones: Capacitacion[];
  onCambio: () => void;
}) {
  async function marcarCompletado(id: string) {
    await supabase
      .from("capacitaciones")
      .update({ estado: "completado", fecha_completado: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    onCambio();
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ ...goldHeading, fontSize: 15, marginBottom: 14 }}>MIS CAPACITACIONES</h2>
      {capacitaciones.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: 13 }}>No tienes capacitaciones asignadas.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {capacitaciones.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(218,165,32,0.15)",
                paddingBottom: 8,
                fontSize: 13,
              }}
            >
              <span style={{ color: theme.textLight }}>{c.curso_nombre}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <EstadoBadge estado={c.estado} />
                {c.estado !== "completado" && (
                  <button
                    onClick={() => marcarCompletado(c.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: theme.goldBright,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Marcar completado
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}