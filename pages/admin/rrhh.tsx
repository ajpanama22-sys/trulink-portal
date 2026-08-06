import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient"; // ajusta esta ruta si tu cliente vive en otro lado
import Sidebar from "./Sidebar";
import jsPDF from "jspdf";
import { theme, pageWrapStyle } from "../../lib/theme"; // ⚠️ ajusta la ruta si guardas theme.ts en otro lugar
import {
  Card,
  Heading,
  PageHeader,
  Button,
  Badge,
  estadoToTone,
  inputStyle,
  DataRow,
} from "../../lib/ui"; // ⚠️ ajusta la ruta si guardas ui.tsx en otro lugar

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
    if (!supabase) {
      setLoading(false);
      setMsg("No se pudo conectar con Supabase.");
      return;
    }
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
          <PageHeader
            title="Mi RRHH"
            subtitle={`${colaborador.nombre} — ${colaborador.rol ?? "Colaborador"}`}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
            {TABS.map((t) => (
              <Button
                key={t}
                variant={tab === t ? "gold" : "outline-gold"}
                onClick={() => setTab(t)}
              >
                {t}
              </Button>
            ))}
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
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DataRow label="Nombre" valor={colaborador.nombre} />
      <DataRow label="Email" valor={colaborador.email} />
      <DataRow label="Rol (sistema)" valor={colaborador.rol ?? "—"} />
      <DataRow label="Departamento" valor={colaborador.departamento ?? "—"} />
      <DataRow label="Puesto" valor={planilla?.puesto ?? "No disponible en planilla"} />
      <DataRow label="Cédula" valor={colaborador.cedula ?? "No disponible"} />
      <DataRow
        label="Fecha de ingreso"
        valor={planilla?.fecha_ingreso ?? "No disponible en planilla"}
      />
      <DataRow
        label="Salario"
        valor={
          planilla?.salario_base != null
            ? `${planilla.moneda ?? "USD"} ${planilla.salario_base.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}`
            : "No disponible en planilla"
        }
      />
    </Card>
  );
}

// ============================================================
// Documentos + Carta de Trabajo (PDF con membrete corporativo)
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
      const pageWidth = doc.internal.pageSize.getWidth(); // 612pt

      // --- Colores corporativos ---
      const dorado: [number, number, number] = [180, 140, 40];
      const negro: [number, number, number] = [20, 20, 20];
      const gris: [number, number, number] = [110, 110, 110];

      // --- Logo (izquierda) ---
      try {
        const logoResp = await fetch("/images/logo.png");
        const logoBlob = await logoResp.blob();
        const logoDataUrl = await blobToDataURL(logoBlob);
        doc.addImage(logoDataUrl, "PNG", 45, 40, 95, 48);
      } catch {}

      // --- Bloque de contacto (derecha, alineado) ---
      const xDer = pageWidth - 45;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...negro);
      doc.text("TRULINK FIBER LLC", xDer, 46, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.3);
      doc.setTextColor(...gris);
      doc.text("5203 Juan Tabo Blvd NE, Suite 2B", xDer, 58, { align: "right" });
      doc.text("Albuquerque, Nuevo México, 87111, Estados Unidos", xDer, 68, { align: "right" });
      doc.text("fred.jurado@trulinkfiber.com", xDer, 78, { align: "right" });
      doc.text("+507 6640 3720", xDer, 88, { align: "right" });

      // --- Línea dorada de separación ---
      doc.setDrawColor(...dorado);
      doc.setLineWidth(1.1);
      doc.line(45, 102, pageWidth - 45, 102);

      // --- Título ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(...negro);
      doc.text("CARTA DE TRABAJO", pageWidth / 2, 138, { align: "center" });

      doc.setDrawColor(...dorado);
      doc.setLineWidth(0.6);
      doc.line(pageWidth / 2 - 55, 146, pageWidth / 2 + 55, 146);

      // --- Cuerpo ---
      const hoy = new Date().toLocaleDateString("es-PA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

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

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...negro);
      const lineas = doc.splitTextToSize(cuerpo, 500);
      doc.text(lineas, 56, 185);

      doc.text(`Panamá, ${hoy}.`, 56, 350);

      // --- Firma ---
      doc.setDrawColor(...gris);
      doc.setLineWidth(0.6);
      doc.line(56, 430, 260, 430);
      doc.setFontSize(10);
      doc.setTextColor(...negro);
      doc.text("Recursos Humanos", 56, 444);
      doc.setFontSize(8.5);
      doc.setTextColor(...gris);
      doc.text("Trulink Fiber LLC", 56, 456);

      // --- Sello/firma escaneada (esquina inferior derecha) ---
      try {
        const selloResp = await fetch("/images/firmaco.png");
        const selloBlob = await selloResp.blob();
        const selloDataUrl = await blobToDataURL(selloBlob);
        const { width: naturalW, height: naturalH } = await getImageDimensions(selloDataUrl);

        const anchoDeseado = 75;
        const alto = (naturalH / naturalW) * anchoDeseado;
        const margenDerecho = 60;
        const margenInferior = 60;
        const x = 612 - margenDerecho - anchoDeseado;
        const y = 792 - margenInferior - alto;

        doc.addImage(selloDataUrl, "PNG", x, y, anchoDeseado, alto);
      } catch {}

      // --- Pie de página corporativo ---
      doc.setDrawColor(...dorado);
      doc.setLineWidth(0.5);
      doc.line(45, 740, pageWidth - 45, 740);
      doc.setFontSize(7.5);
      doc.setTextColor(...gris);
      doc.text(
        "5203 Juan Tabo Blvd NE, Suite 2B, Albuquerque, NM 87111, USA  ·  fred.jurado@trulinkfiber.com  ·  +507 6640 3720  ·  www.trulinkfiber.com",
        pageWidth / 2,
        752,
        { align: "center" }
      );

      const nombreArchivo = `carta_trabajo_${colaborador.nombre.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      doc.save(nombreArchivo);

      if (!supabase) return;
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
      <Card>
        <Heading>Carta de Trabajo</Heading>
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
          Genera tu carta de trabajo en PDF con tu puesto, fecha de ingreso y salario
          actual según planilla.
        </p>
        <Button onClick={generarCartaTrabajo} disabled={generando}>
          {generando ? "Generando..." : "Generar Carta de Trabajo (PDF)"}
        </Button>
      </Card>

      <Card>
        <Heading>Documentos generados</Heading>
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
      </Card>
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
    if (!inicio || !fin || !supabase) return;
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
      <Card>
        <Heading>Nueva solicitud</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
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
        <Button
          onClick={enviar}
          disabled={enviando || !inicio || !fin}
          style={{ marginTop: 14 }}
        >
          {enviando ? "Enviando..." : "Enviar solicitud"}
        </Button>
      </Card>

      <Card>
        <Heading>Mis solicitudes</Heading>
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
                <Badge tone={estadoToTone(s.estado)}>{s.estado}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
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
    if (!supabase) return;
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
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Heading style={{ marginBottom: 4 }}>Marcar {siguienteTipo}</Heading>
          <p style={{ color: theme.textMuted, fontSize: 13 }}>
            Último marcaje:{" "}
            {ultimo
              ? `${ultimo.tipo} — ${new Date(ultimo.marcado_en).toLocaleString("es-PA")}`
              : "sin registros"}
          </p>
        </div>
        <Button
          onClick={marcar}
          disabled={marcando}
          variant={siguienteTipo === "entrada" ? "outline-green" : "outline-red"}
        >
          {marcando ? "Marcando..." : `Marcar ${siguienteTipo}`}
        </Button>
      </Card>

      <Card>
        <Heading>Historial reciente</Heading>
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
      </Card>
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
    if (!periodo || !texto || !supabase) return;
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
      <Card>
        <Heading>Nueva autoevaluación</Heading>
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
        <Button onClick={enviar} disabled={enviando || !periodo || !texto}>
          {enviando ? "Guardando..." : "Guardar autoevaluación"}
        </Button>
      </Card>

      <Card>
        <Heading>Historial</Heading>
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
      </Card>
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
    if (!supabase) return;
    await supabase
      .from("capacitaciones")
      .update({ estado: "completado", fecha_completado: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    onCambio();
  }

  return (
    <Card>
      <Heading>Mis capacitaciones</Heading>
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
                <Badge tone={estadoToTone(c.estado)}>{c.estado}</Badge>
                {c.estado !== "completado" && (
                  <Button variant="ghost" onClick={() => marcarCompletado(c.id)}>
                    Marcar completado
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}