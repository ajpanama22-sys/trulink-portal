import { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import {
  Card,
  Heading,
  PageHeader,
  Button,
  Badge,
  inputStyle,
} from "../../lib/ui";
import CotizacionManual from "../../components/admin/marketing/CotizacionManual";

/* ============================================================
   MARKETING ENTERPRISE SUITE — TRULINK FIBER LLC
   ------------------------------------------------------------
   Módulo unificado de marketing y comunicaciones.

   Pestañas:
     1. Dashboard Ejecutivo  — KPIs reales (ROI, CPL, conversión)
     2. Campañas             — ciclo de vida, gastos, ingresos, ROI
     3. Pipeline de Leads    — estados + conversión a prospecto CRM
     4. Comunicaciones       — envío email/SMS con segmentación fina
     5. Analítica            — rendimiento por canal y por origen

   Nota: usa getSupabase() (cliente singleton), NO createClient
   directo, para evitar los bugs intermitentes de sesión.
   ============================================================ */

type Campana = {
  id: number;
  nombre: string;
  tipo: string;
  estado: string;
  presupuesto: number;
  gasto: number;
  roi: number;
  objetivo?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  meta_leads?: number | null;
  ingresos_generados?: number | null;
};

type Lead = {
  id: number;
  nombre_contacto: string;
  empresa: string;
  email: string;
  telefono_celular: string;
  origen: string;
  estado: string;
  campana_id?: number | null;
  valor_estimado?: number | null;
  prospecto_id_convertido?: number | null;
  fecha_conversion?: string | null;
  notas?: string | null;
  created_at?: string | null;
};

type GastoCampana = {
  id: number;
  campana_id: number;
  monto: number;
  concepto: string;
  fecha: string;
  created_at: string;
};

type EnvioHistorial = {
  id: number;
  asunto: string | null;
  mensaje: string;
  canales: string | null;
  segmento_descripcion: string | null;
  total_destinatarios: number;
  enviados_email: number;
  fallidos_email: number;
  enviados_sms: number;
  fallidos_sms: number;
  autor: string | null;
  created_at: string;
};

/** Contacto normalizado, sin importar de qué tabla venga. */
type Destinatario = {
  key: string;        // "clientes:12" — identificador único para selección
  fuente: "clientes" | "colaboradores" | "leads" | "prospectos";
  fuenteLabel: string;
  nombre: string;
  email: string;
  telefono: string;
  etiqueta: string;   // perfil, rol, estado... lo que sirva para ubicarlo
};

const ESTADOS_CAMPANA = ["Activa", "Pausada", "Finalizada"] as const;
const ESTADOS_LEAD = ["Nuevo", "Contactado", "Calificado", "Descartado", "Convertido"] as const;
const PERFILES_CLIENTE = ["ISP", "MAYORISTA", "INTEGRADOR", "CLIENTE FINAL"] as const;

/**
 * Mismo criterio de Lista de Precios que usan validaciones.tsx y crm.tsx.
 * ISP -> A | MAYORISTA -> B | INTEGRADOR -> C | resto -> D
 */
const determinarPriceList = (perfil?: string): "A" | "B" | "C" | "D" => {
  const p = (perfil || "").toUpperCase().trim();
  switch (p) {
    case "ISP": return "A";
    case "MAYORISTA": return "B";
    case "INTEGRADOR": return "C";
    default: return "D";
  }
};

/** Extrae nombre/email/teléfono de una fila sin importar cómo se llamen las columnas. */
const resolverContacto = (row: any) => {
  const nombre =
    row.razon_social || row.nombre_contacto || row.nombre_completo || row.nombre ||
    row.empresa || row.email || "Sin nombre";
  const email = (row.email || row.correo || "").trim();
  const telefono = (row.telefono_celular || row.celular || row.telefono || row.telefono_oficina || "").trim();
  return { nombre, email, telefono };
};

const fmtMoneda = (n: number) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function MarketingEnterprise() {
  const [seccion, setSeccion] = useState<"dashboard" | "campanas" | "leads" | "comunicaciones" | "analitica" | "cotizaciones">("dashboard");
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [gastos, setGastos] = useState<GastoCampana[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Formularios ---
  const [nuevaCampana, setNuevaCampana] = useState({
    nombre: "", tipo: "B2B Outbound", presupuesto: 0, objetivo: "",
    fecha_inicio: "", fecha_fin: "", meta_leads: 0,
  });
  const [nuevoLead, setNuevoLead] = useState({
    nombre_contacto: "", empresa: "", email: "", telefono_celular: "",
    origen: "Manual", campana_id: "", valor_estimado: 0,
  });

  // --- Modal de gasto ---
  const [modalGasto, setModalGasto] = useState<{ open: boolean; campana: Campana | null }>({ open: false, campana: null });
  const [nuevoGasto, setNuevoGasto] = useState({ monto: 0, concepto: "", fecha: new Date().toISOString().slice(0, 10) });

  // --- Modal de ingreso ---
  const [modalIngreso, setModalIngreso] = useState<{ open: boolean; campana: Campana | null }>({ open: false, campana: null });
  const [montoIngreso, setMontoIngreso] = useState(0);

  // --- Filtros de leads ---
  const [busquedaLead, setBusquedaLead] = useState("");
  const [filtroEstadoLeadTabla, setFiltroEstadoLeadTabla] = useState("TODOS");
  const [filtroCampanaTabla, setFiltroCampanaTabla] = useState("TODAS");
  const [convirtiendoLead, setConvirtiendoLead] = useState<number | null>(null);

  // --- Comunicaciones: audiencias crudas ---
  const [clientesRaw, setClientesRaw] = useState<any[]>([]);
  const [colaboradoresRaw, setColaboradoresRaw] = useState<any[]>([]);
  const [prospectosRaw, setProspectosRaw] = useState<any[]>([]);
  const [audienciasCargadas, setAudienciasCargadas] = useState(false);
  const [cargandoAudiencias, setCargandoAudiencias] = useState(false);

  // --- Comunicaciones: constructor de segmento ---
  const [fuentes, setFuentes] = useState({ clientes: true, colaboradores: false, leads: false, prospectos: false });
  const [fPerfilCliente, setFPerfilCliente] = useState("TODOS");
  const [fPriceList, setFPriceList] = useState("TODAS");
  const [fStatusCliente, setFStatusCliente] = useState("TODOS");
  const [fEstadoLead, setFEstadoLead] = useState("TODOS");
  const [fCampanaLead, setFCampanaLead] = useState("TODAS");
  const [buscarDest, setBuscarDest] = useState("");
  const [enviarATodos, setEnviarATodos] = useState(true);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // --- Comunicaciones: mensaje ---
  const [canalEmail, setCanalEmail] = useState(true);
  const [canalSms, setCanalSms] = useState(false);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [autorEnvio, setAutorEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState("");
  const [historialEnvios, setHistorialEnvios] = useState<EnvioHistorial[]>([]);

  useEffect(() => { fetchDatosMarketing(); }, []);

  useEffect(() => {
    if (seccion === "comunicaciones" && !audienciasCargadas) {
      fetchAudiencias();
      fetchHistorialEnvios();
    }
  }, [seccion]);

  /* ==========================================================
     CARGA DE DATOS
     ========================================================== */

  const fetchDatosMarketing = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) { setLoading(false); return; }

    try {
      const [campRes, leadsRes, gastosRes] = await Promise.all([
        supabase.from("marketing_campaigns").select("*").order("id", { ascending: false }),
        supabase.from("marketing_leads").select("*").order("id", { ascending: false }),
        supabase.from("marketing_gastos").select("*").order("fecha", { ascending: false }),
      ]);

      if (campRes.error) console.error("Error consultando marketing_campaigns:", campRes.error.message);
      if (leadsRes.error) console.error("Error consultando marketing_leads:", leadsRes.error.message);
      if (gastosRes.error) console.error("Error consultando marketing_gastos (¿corriste el SQL?):", gastosRes.error.message);

      setCampanas(campRes.data || []);
      setLeads(leadsRes.data || []);
      setGastos(gastosRes.data || []);
    } catch (err) {
      console.error("Error sincronizando datos de marketing:", err);
    } finally {
      setLoading(false);
    }
  };

  /** Carga clientes, colaboradores y prospectos para el constructor de audiencias. */
  const fetchAudiencias = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setCargandoAudiencias(true);
    try {
      const [cliRes, colRes, prosRes] = await Promise.all([
        supabase.from("clientes").select("*"),
        supabase.from("colaboradores").select("*"),
        supabase.from("crm_prospectos").select("*"),
      ]);

      if (cliRes.error) console.error("Error consultando clientes:", cliRes.error.message);
      if (colRes.error) console.error("Error consultando colaboradores:", colRes.error.message);
      if (prosRes.error) console.error("Error consultando crm_prospectos:", prosRes.error.message);

      setClientesRaw(cliRes.data || []);
      setColaboradoresRaw(colRes.data || []);
      setProspectosRaw(prosRes.data || []);
    } catch (err) {
      console.error("Error cargando audiencias:", err);
    } finally {
      setCargandoAudiencias(false);
      setAudienciasCargadas(true);
    }
  };

  const fetchHistorialEnvios = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("marketing_envios").select("*")
      .order("created_at", { ascending: false }).limit(25);
    if (error) {
      console.error("Error consultando marketing_envios (¿corriste el SQL?):", error.message);
      setHistorialEnvios([]);
    } else {
      setHistorialEnvios(data || []);
    }
  };

  /** Deja constancia en audit_log. Nunca interrumpe la acción principal si falla. */
  const registrarAuditoria = async (accion: string, entidad: string, entidadId: string | number | null, detalle: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await supabase.from("audit_log").insert([{
        accion, entidad,
        entidad_id: entidadId != null ? String(entidadId) : null,
        detalle, autor: autorEnvio || null,
      }]);
    } catch (err) {
      console.error("No se pudo registrar en audit_log:", err);
    }
  };

  /* ==========================================================
     CAMPAÑAS
     ========================================================== */

  const handleCrearCampana = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCampana.nombre.trim()) return alert("Ingresa el nombre de la campaña.");

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { data, error } = await supabase.from("marketing_campaigns").insert([{
      nombre: nuevaCampana.nombre,
      tipo: nuevaCampana.tipo,
      estado: "Activa",
      presupuesto: nuevaCampana.presupuesto,
      gasto: 0,
      roi: 0,
      objetivo: nuevaCampana.objetivo || null,
      fecha_inicio: nuevaCampana.fecha_inicio || null,
      fecha_fin: nuevaCampana.fecha_fin || null,
      meta_leads: nuevaCampana.meta_leads || 0,
      ingresos_generados: 0,
    }]).select().single();

    if (error) return alert("Error al crear la campaña: " + error.message);

    registrarAuditoria("campana_creada", "campana", data?.id ?? null,
      `Se lanzó la campaña "${nuevaCampana.nombre}" (${nuevaCampana.tipo}) con presupuesto de ${fmtMoneda(nuevaCampana.presupuesto)}.`);

    setNuevaCampana({ nombre: "", tipo: "B2B Outbound", presupuesto: 0, objetivo: "", fecha_inicio: "", fecha_fin: "", meta_leads: 0 });
    fetchDatosMarketing();
    alert("Campaña creada correctamente.");
  };

  const handleCambiarEstadoCampana = async (id: number, estado: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("marketing_campaigns").update({ estado }).eq("id", id);
    if (error) return alert("Error al cambiar el estado: " + error.message);

    const c = campanas.find((x) => x.id === id);
    setCampanas((prev) => prev.map((x) => (x.id === id ? { ...x, estado } : x)));
    registrarAuditoria("campana_estado", "campana", id, `La campaña "${c?.nombre || id}" pasó a estado "${estado}".`);
  };

  const abrirModalGasto = (campana: Campana) => {
    setModalGasto({ open: true, campana });
    setNuevoGasto({ monto: 0, concepto: "", fecha: new Date().toISOString().slice(0, 10) });
  };

  /**
   * Registra un gasto en el libro (marketing_gastos) y recalcula el total
   * acumulado de la campaña, para que el ROI siempre refleje la realidad.
   */
  const handleRegistrarGasto = async () => {
    const campana = modalGasto.campana;
    if (!campana) return;
    if (nuevoGasto.monto <= 0) return alert("El monto debe ser mayor a cero.");

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { error } = await supabase.from("marketing_gastos").insert([{
      campana_id: campana.id,
      monto: nuevoGasto.monto,
      concepto: nuevoGasto.concepto || "Sin concepto",
      fecha: nuevoGasto.fecha,
    }]);
    if (error) return alert("Error al registrar el gasto: " + error.message);

    const gastoAcumulado = Number(campana.gasto || 0) + Number(nuevoGasto.monto);
    const ingresos = Number(campana.ingresos_generados || 0);
    const roiNuevo = gastoAcumulado > 0 ? ((ingresos - gastoAcumulado) / gastoAcumulado) * 100 : 0;

    await supabase.from("marketing_campaigns")
      .update({ gasto: gastoAcumulado, roi: Number(roiNuevo.toFixed(2)) })
      .eq("id", campana.id);

    registrarAuditoria("gasto_registrado", "campana", campana.id,
      `Gasto de ${fmtMoneda(nuevoGasto.monto)} en "${campana.nombre}" (${nuevoGasto.concepto || "sin concepto"}).`);

    setModalGasto({ open: false, campana: null });
    fetchDatosMarketing();
  };

  const abrirModalIngreso = (campana: Campana) => {
    setModalIngreso({ open: true, campana });
    setMontoIngreso(Number(campana.ingresos_generados || 0));
  };

  const handleRegistrarIngreso = async () => {
    const campana = modalIngreso.campana;
    if (!campana) return;

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const gastoActual = Number(campana.gasto || 0);
    const roiNuevo = gastoActual > 0 ? ((montoIngreso - gastoActual) / gastoActual) * 100 : 0;

    const { error } = await supabase.from("marketing_campaigns")
      .update({ ingresos_generados: montoIngreso, roi: Number(roiNuevo.toFixed(2)) })
      .eq("id", campana.id);
    if (error) return alert("Error al registrar ingresos: " + error.message);

    registrarAuditoria("ingreso_registrado", "campana", campana.id,
      `Ingresos atribuidos a "${campana.nombre}" actualizados a ${fmtMoneda(montoIngreso)}.`);

    setModalIngreso({ open: false, campana: null });
    fetchDatosMarketing();
  };

  /* ==========================================================
     LEADS
     ========================================================== */

  const handleCrearLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoLead.nombre_contacto.trim() && !nuevoLead.empresa.trim()) {
      return alert("Ingresa al menos el nombre del contacto o la empresa.");
    }
    if (!nuevoLead.email.trim() && !nuevoLead.telefono_celular.trim()) {
      return alert("Ingresa un email o un teléfono; sin uno de los dos no se le puede contactar.");
    }

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { error } = await supabase.from("marketing_leads").insert([{
      nombre_contacto: nuevoLead.nombre_contacto,
      empresa: nuevoLead.empresa,
      email: nuevoLead.email,
      telefono_celular: nuevoLead.telefono_celular,
      origen: nuevoLead.origen,
      estado: "Nuevo",
      campana_id: nuevoLead.campana_id ? Number(nuevoLead.campana_id) : null,
      valor_estimado: nuevoLead.valor_estimado || 0,
    }]);
    if (error) return alert("Error al registrar el lead: " + error.message);

    setNuevoLead({ nombre_contacto: "", empresa: "", email: "", telefono_celular: "", origen: "Manual", campana_id: "", valor_estimado: 0 });
    fetchDatosMarketing();
  };

  const handleCambiarEstadoLead = async (id: number, estado: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("marketing_leads").update({ estado }).eq("id", id);
    if (error) return alert("Error al cambiar el estado del lead: " + error.message);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estado } : l)));
  };

  /**
   * Puente Marketing -> CRM. Toma un lead calificado y lo inserta en
   * crm_prospectos, para que desde el CRM se le pueda dar seguimiento y
   * eventualmente convertirlo en cliente real con su lista de precios.
   */
  const handleConvertirLeadAProspecto = async (lead: Lead) => {
    if (!lead.email) {
      return alert("Este lead no tiene email. El CRM lo necesita para poder activarlo como cliente más adelante.");
    }
    const empresaDestino = lead.empresa || lead.nombre_contacto;
    if (!confirm(`¿Enviar "${empresaDestino}" al CRM como prospecto comercial?`)) return;

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    setConvirtiendoLead(lead.id);
    try {
      const perfilInferido = "CLIENTE FINAL";
      const { data: prospecto, error } = await supabase.from("crm_prospectos").insert([{
        razon_social: empresaDestino,
        email: lead.email,
        telefono_celular: lead.telefono_celular || null,
        perfil_cliente: perfilInferido,
        industria: "Telecomunicaciones y Fibra Óptica",
        pais: "Panamá",
        status: "prospecto",
        etapa_pipeline: "Prospecto",
      }]).select().single();

      if (error) {
        alert("Error al enviar el lead al CRM: " + error.message);
        return;
      }

      await supabase.from("marketing_leads").update({
        estado: "Convertido",
        prospecto_id_convertido: prospecto?.id ?? null,
        fecha_conversion: new Date().toISOString(),
      }).eq("id", lead.id);

      registrarAuditoria("lead_convertido", "lead", lead.id,
        `El lead "${empresaDestino}" pasó a prospecto del CRM.`);

      setLeads((prev) => prev.map((l) => (l.id === lead.id
        ? { ...l, estado: "Convertido", prospecto_id_convertido: prospecto?.id ?? null }
        : l)));

      alert(`"${empresaDestino}" ya está en el CRM. Puedes darle seguimiento desde CRM & Oportunidades.`);
    } finally {
      setConvirtiendoLead(null);
    }
  };

  /* ==========================================================
     COMUNICACIONES — construcción del segmento
     ========================================================== */

  /** Convierte cada fuente activa en una lista normalizada de destinatarios. */
  const candidatos: Destinatario[] = useMemo(() => {
    const salida: Destinatario[] = [];

    if (fuentes.clientes) {
      clientesRaw.forEach((c) => {
        const perfil = (c.perfil_cliente || c.tipo_cliente || "").toString().toUpperCase().trim();
        const priceList = (c.price_list || determinarPriceList(perfil)).toString().toUpperCase();
        const status = (c.status || "").toString();

        if (fPerfilCliente !== "TODOS" && perfil !== fPerfilCliente) return;
        if (fPriceList !== "TODAS" && priceList !== fPriceList) return;
        if (fStatusCliente !== "TODOS" && status !== fStatusCliente) return;

        const { nombre, email, telefono } = resolverContacto(c);
        salida.push({
          key: `clientes:${c.id}`, fuente: "clientes", fuenteLabel: "Cliente",
          nombre, email, telefono,
          etiqueta: [perfil || "SIN PERFIL", `Lista ${priceList}`, status].filter(Boolean).join(" · "),
        });
      });
    }

    if (fuentes.colaboradores) {
      colaboradoresRaw.forEach((c) => {
        const { nombre, email, telefono } = resolverContacto(c);
        const rol = c.rol || c.cargo || c.puesto || c.departamento || c.area || "Colaborador";
        salida.push({
          key: `colaboradores:${c.id}`, fuente: "colaboradores", fuenteLabel: "Colaborador",
          nombre, email, telefono, etiqueta: String(rol),
        });
      });
    }

    if (fuentes.leads) {
      leads.forEach((l) => {
        if (fEstadoLead !== "TODOS" && l.estado !== fEstadoLead) return;
        if (fCampanaLead !== "TODAS" && String(l.campana_id ?? "") !== fCampanaLead) return;

        const { nombre, email, telefono } = resolverContacto(l);
        const camp = campanas.find((c) => c.id === l.campana_id);
        salida.push({
          key: `leads:${l.id}`, fuente: "leads", fuenteLabel: "Lead",
          nombre: l.empresa ? `${nombre} (${l.empresa})` : nombre,
          email, telefono,
          etiqueta: [l.estado, camp?.nombre || l.origen].filter(Boolean).join(" · "),
        });
      });
    }

    if (fuentes.prospectos) {
      prospectosRaw.forEach((p) => {
        if (p.status && p.status !== "prospecto") return;
        const { nombre, email, telefono } = resolverContacto(p);
        salida.push({
          key: `prospectos:${p.id}`, fuente: "prospectos", fuenteLabel: "Prospecto CRM",
          nombre, email, telefono,
          etiqueta: (p.perfil_cliente || "Prospecto").toString(),
        });
      });
    }

    // Búsqueda libre por nombre, email o teléfono
    const q = buscarDest.toLowerCase().trim();
    const filtrados = q
      ? salida.filter((d) =>
          d.nombre.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          d.telefono.toLowerCase().includes(q) ||
          d.etiqueta.toLowerCase().includes(q))
      : salida;

    // Un mismo correo puede estar como cliente y como lead: se envía una sola vez.
    const vistos = new Set<string>();
    return filtrados.filter((d) => {
      const huella = (d.email || d.telefono || d.key).toLowerCase();
      if (vistos.has(huella)) return false;
      vistos.add(huella);
      return true;
    });
  }, [fuentes, clientesRaw, colaboradoresRaw, prospectosRaw, leads, campanas,
      fPerfilCliente, fPriceList, fStatusCliente, fEstadoLead, fCampanaLead, buscarDest]);

  /** Los que realmente van a recibir el mensaje, según canales elegidos. */
  const destinatariosFinales = useMemo(() => {
    const base = enviarATodos ? candidatos : candidatos.filter((d) => seleccionados.has(d.key));
    return base.filter((d) => (canalEmail && d.email) || (canalSms && d.telefono));
  }, [candidatos, enviarATodos, seleccionados, canalEmail, canalSms]);

  const sinEmail = destinatariosFinales.filter((d) => !d.email).length;
  const sinTelefono = destinatariosFinales.filter((d) => !d.telefono).length;
  const descartadosPorFalta = (enviarATodos ? candidatos.length : seleccionados.size) - destinatariosFinales.length;

  const toggleSeleccion = (key: string) => {
    setSeleccionados((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  /** Texto legible del segmento, para dejarlo guardado en el historial. */
  const descripcionSegmento = useMemo(() => {
    if (!enviarATodos) return `Selección manual de ${seleccionados.size} destinatario(s)`;
    const partes: string[] = [];
    if (fuentes.clientes) {
      const det = [
        fPerfilCliente !== "TODOS" ? fPerfilCliente : null,
        fPriceList !== "TODAS" ? `Lista ${fPriceList}` : null,
        fStatusCliente !== "TODOS" ? fStatusCliente : null,
      ].filter(Boolean).join("/");
      partes.push(det ? `Clientes (${det})` : "Todos los clientes");
    }
    if (fuentes.colaboradores) partes.push("Colaboradores");
    if (fuentes.leads) {
      const camp = campanas.find((c) => String(c.id) === fCampanaLead);
      const det = [
        fEstadoLead !== "TODOS" ? fEstadoLead : null,
        camp ? camp.nombre : null,
      ].filter(Boolean).join("/");
      partes.push(det ? `Leads (${det})` : "Todos los leads");
    }
    if (fuentes.prospectos) partes.push("Prospectos CRM");
    if (buscarDest.trim()) partes.push(`filtro texto "${buscarDest.trim()}"`);
    return partes.length ? partes.join(" + ") : "Sin audiencia seleccionada";
  }, [enviarATodos, seleccionados, fuentes, fPerfilCliente, fPriceList, fStatusCliente, fEstadoLead, fCampanaLead, buscarDest, campanas]);

  const handleEnviarComunicacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) return alert("Escribe el contenido del mensaje.");
    if (!canalEmail && !canalSms) return alert("Selecciona al menos un canal: Email o SMS.");
    if (destinatariosFinales.length === 0) return alert("No hay destinatarios que cumplan con los filtros y canales elegidos.");
    if (canalEmail && !asunto.trim()) return alert("Escribe el asunto del correo.");

    if (!confirm(`Se va a enviar a ${destinatariosFinales.length} destinatario(s) por ${[canalEmail && "EMAIL", canalSms && "SMS"].filter(Boolean).join(" + ")}. ¿Confirmas?`)) return;

    setEnviando(true);
    setResultadoEnvio("");

    const canales: string[] = [];
    if (canalEmail) canales.push("email");
    if (canalSms) canales.push("sms");

    try {
      const res = await fetch("/api/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canales,
          asunto,
          mensaje,
          segmento_descripcion: descripcionSegmento,
          destinatarios: destinatariosFinales.map((d) => ({
            nombre: d.nombre, email: d.email || null, telefono: d.telefono || null,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "El servidor rechazó el envío.");

      const okEmail = Number(data?.email?.enviados ?? 0);
      const failEmail = Number(data?.email?.fallidos ?? 0);
      const okSms = Number(data?.sms?.enviados ?? 0);
      const failSms = Number(data?.sms?.fallidos ?? 0);
      const total = Number(data?.total ?? destinatariosFinales.length);

      const partes: string[] = [];
      if (canalEmail) partes.push(`Email: ${okEmail} de ${total}` + (failEmail ? ` (${failEmail} fallaron)` : ""));
      if (canalSms) partes.push(`SMS: ${okSms} de ${total}` + (failSms ? ` (${failSms} fallaron)` : ""));
      setResultadoEnvio(partes.join("  |  ") || "Envío procesado.");

      const supabase = getSupabase();
      if (supabase) {
        await supabase.from("marketing_envios").insert([{
          asunto: asunto || null,
          mensaje,
          canales: canales.join(","),
          segmento_descripcion: descripcionSegmento,
          total_destinatarios: total,
          enviados_email: okEmail, fallidos_email: failEmail,
          enviados_sms: okSms, fallidos_sms: failSms,
          autor: autorEnvio || null,
        }]);
      }

      registrarAuditoria("comunicacion_enviada", "comunicacion", null,
        `Envío a ${total} destinatario(s) por ${canales.join("+")} — segmento: ${descripcionSegmento}.`);

      setMensaje("");
      setAsunto("");
      fetchHistorialEnvios();
    } catch (err: any) {
      setResultadoEnvio("Error: " + (err?.message || "no se pudo completar el envío."));
    } finally {
      setEnviando(false);
    }
  };

  /* ==========================================================
     MÉTRICAS DERIVADAS
     ========================================================== */

  const leadsPorCampana = useMemo(() => {
    const mapa: Record<number, number> = {};
    leads.forEach((l) => { if (l.campana_id) mapa[l.campana_id] = (mapa[l.campana_id] || 0) + 1; });
    return mapa;
  }, [leads]);

  const campanasActivas = campanas.filter((c) => c.estado === "Activa");
  const totalPresupuesto = campanas.reduce((a, c) => a + Number(c.presupuesto || 0), 0);
  const totalGasto = campanas.reduce((a, c) => a + Number(c.gasto || 0), 0);
  const totalIngresos = campanas.reduce((a, c) => a + Number(c.ingresos_generados || 0), 0);
  const roiGlobal = totalGasto > 0 ? ((totalIngresos - totalGasto) / totalGasto) * 100 : 0;
  const leadsConvertidos = leads.filter((l) => l.estado === "Convertido").length;
  const tasaConversion = leads.length > 0 ? (leadsConvertidos / leads.length) * 100 : 0;
  const costoPorLead = leads.length > 0 && totalGasto > 0 ? totalGasto / leads.length : 0;
  const pipelineLeads = leads.reduce((a, l) => a + Number(l.valor_estimado || 0), 0);

  const embudo = ESTADOS_LEAD.map((estado) => ({
    estado, cantidad: leads.filter((l) => l.estado === estado).length,
  }));
  const maxEmbudo = Math.max(1, ...embudo.map((e) => e.cantidad));

  /** Agregado por canal (columna `tipo` de la campaña). */
  const rendimientoPorCanal = useMemo(() => {
    const mapa: Record<string, { canal: string; campanas: number; gasto: number; ingresos: number; leads: number }> = {};
    campanas.forEach((c) => {
      const canal = c.tipo || "Sin canal";
      if (!mapa[canal]) mapa[canal] = { canal, campanas: 0, gasto: 0, ingresos: 0, leads: 0 };
      mapa[canal].campanas += 1;
      mapa[canal].gasto += Number(c.gasto || 0);
      mapa[canal].ingresos += Number(c.ingresos_generados || 0);
      mapa[canal].leads += leadsPorCampana[c.id] || 0;
    });
    return Object.values(mapa).sort((a, b) => b.ingresos - a.ingresos);
  }, [campanas, leadsPorCampana]);

  const leadsPorOrigen = useMemo(() => {
    const mapa: Record<string, number> = {};
    leads.forEach((l) => { const o = l.origen || "Sin origen"; mapa[o] = (mapa[o] || 0) + 1; });
    return Object.entries(mapa).map(([origen, cantidad]) => ({ origen, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  }, [leads]);
  const maxOrigen = Math.max(1, ...leadsPorOrigen.map((o) => o.cantidad));

  const leadsFiltrados = leads.filter((l) => {
    if (filtroEstadoLeadTabla !== "TODOS" && l.estado !== filtroEstadoLeadTabla) return false;
    if (filtroCampanaTabla !== "TODAS" && String(l.campana_id ?? "") !== filtroCampanaTabla) return false;
    const q = busquedaLead.toLowerCase().trim();
    if (!q) return true;
    return [l.nombre_contacto, l.empresa, l.email, l.telefono_celular, l.origen]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const colorRoi = (roi: number) => (roi > 0 ? "#2ecc71" : roi < 0 ? "#e74c3c" : "#DAA520");

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="marketing" />

      <div style={pageWrapStyle()}>
        <style jsx global>{`
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid ${theme.borderGold}; padding: 12px; text-align: center; color: ${theme.textLight}; font-size: 0.85rem; }
          th { background-color: #0a0a0a; color: ${theme.gold}; font-weight: 600; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1.2px; }
          input[type="checkbox"] { width: 16px; height: 16px; accent-color: ${theme.gold}; padding: 0; }
          .lbl { display: block; font-size: 0.68rem; color: rgba(255,255,255,0.6); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          .chip { padding: 3px 9px; border-radius: 12px; font-size: 0.68rem; background: ${theme.goldSoft}; color: ${theme.gold}; border: 1px solid ${theme.borderGoldLight}; }
          .barra-fondo { background: #141414; border-radius: 6px; height: 22px; overflow: hidden; flex: 1; }
          .barra-relleno { background: linear-gradient(90deg, #8a6914, ${theme.gold}); height: 100%; border-radius: 6px; transition: width 0.5s ease; }
        `}</style>

        {/* NAVEGACIÓN — sin botón duplicado de "Volver": ya vive en el Sidebar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px", maxWidth: "1400px", margin: "0 auto 40px auto" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button variant={seccion === "dashboard" ? "gold" : "outline-gold"} onClick={() => setSeccion("dashboard")}>📊 Dashboard Ejecutivo</Button>
            <Button variant={seccion === "campanas" ? "gold" : "outline-gold"} onClick={() => setSeccion("campanas")}>🎯 Campañas</Button>
            <Button variant={seccion === "leads" ? "gold" : "outline-gold"} onClick={() => setSeccion("leads")}>💼 Pipeline de Leads</Button>
            <Button variant={seccion === "comunicaciones" ? "gold" : "outline-gold"} onClick={() => setSeccion("comunicaciones")}>📣 Comunicaciones</Button>
            <Button variant={seccion === "analitica" ? "gold" : "outline-gold"} onClick={() => setSeccion("analitica")}>📈 Analítica</Button>
            <Button variant={seccion === "cotizaciones" ? "gold" : "outline-gold"} onClick={() => setSeccion("cotizaciones")}>📝 Cotizaciones</Button>
          </div>
        </div>

        <PageHeader
          title="ENTERPRISE MARKETING SUITE"
          subtitle="INTELIGENCIA COMERCIAL, ADQUISICIÓN Y COMUNICACIONES • TRULINK FIBER LLC"
        />

        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>

          {/* ================= DASHBOARD EJECUTIVO ================= */}
          {seccion === "dashboard" && (
            <div>
              {loading ? (
                <Card style={{ padding: "40px", textAlign: "center" }}>
                  <p style={{ color: theme.textMuted }}>Cargando indicadores...</p>
                </Card>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "18px", marginBottom: "35px" }}>
                    <Card style={{ padding: "22px", marginBottom: 0 }}>
                      <span className="lbl">Campañas Activas</span>
                      <h2 style={{ fontSize: "2rem", color: theme.gold, margin: "6px 0 0 0", fontWeight: 400 }}>{campanasActivas.length}</h2>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>{campanas.length} en total</span>
                    </Card>
                    <Card style={{ padding: "22px", marginBottom: 0 }}>
                      <span className="lbl">Inversión Ejecutada</span>
                      <h2 style={{ fontSize: "2rem", color: theme.textLight, margin: "6px 0 0 0", fontWeight: 400 }}>{fmtMoneda(totalGasto)}</h2>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>de {fmtMoneda(totalPresupuesto)} presupuestado</span>
                    </Card>
                    <Card style={{ padding: "22px", marginBottom: 0 }}>
                      <span className="lbl">ROI Global</span>
                      <h2 style={{ fontSize: "2rem", color: colorRoi(roiGlobal), margin: "6px 0 0 0", fontWeight: 400 }}>
                        {totalGasto > 0 ? `${roiGlobal.toFixed(1)}%` : "N/D"}
                      </h2>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>{fmtMoneda(totalIngresos)} atribuidos</span>
                    </Card>
                    <Card style={{ padding: "22px", marginBottom: 0 }}>
                      <span className="lbl">Leads Generados</span>
                      <h2 style={{ fontSize: "2rem", color: theme.gold, margin: "6px 0 0 0", fontWeight: 400 }}>{leads.length}</h2>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>{leadsConvertidos} convertidos</span>
                    </Card>
                    <Card style={{ padding: "22px", marginBottom: 0 }}>
                      <span className="lbl">Costo por Lead</span>
                      <h2 style={{ fontSize: "2rem", color: theme.textLight, margin: "6px 0 0 0", fontWeight: 400 }}>
                        {costoPorLead > 0 ? fmtMoneda(costoPorLead) : "N/D"}
                      </h2>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>inversión / leads</span>
                    </Card>
                    <Card style={{ padding: "22px", marginBottom: 0 }}>
                      <span className="lbl">Tasa de Conversión</span>
                      <h2 style={{ fontSize: "2rem", color: theme.green, margin: "6px 0 0 0", fontWeight: 400 }}>{tasaConversion.toFixed(1)}%</h2>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>lead → prospecto CRM</span>
                    </Card>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "35px" }}>
                    <Card style={{ padding: "30px", marginBottom: 0 }}>
                      <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "20px" }}>Embudo de Leads</Heading>
                      {leads.length === 0 ? (
                        <p style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic", fontSize: "0.85rem" }}>Todavía no hay leads registrados.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {embudo.map((e) => (
                            <div key={e.estado} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", width: "95px", flexShrink: 0 }}>{e.estado}</span>
                              <div className="barra-fondo">
                                <div className="barra-relleno" style={{ width: `${(e.cantidad / maxEmbudo) * 100}%` }} />
                              </div>
                              <span style={{ fontSize: "0.8rem", color: theme.gold, fontWeight: 600, width: "35px", textAlign: "right" }}>{e.cantidad}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    <Card style={{ padding: "30px", marginBottom: 0 }}>
                      <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "20px" }}>Valor en Pipeline de Leads</Heading>
                      <h2 style={{ fontSize: "2.6rem", color: theme.gold, margin: "0 0 6px 0", fontWeight: 400 }}>{fmtMoneda(pipelineLeads)}</h2>
                      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", lineHeight: 1.6, margin: 0 }}>
                        Suma del valor estimado de todos los leads que aún no se han descartado ni cerrado.
                        Este monto alimenta el pipeline del CRM a medida que los leads se convierten en prospectos.
                      </p>
                    </Card>
                  </div>

                  <Card style={{ padding: "30px" }}>
                    <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "10px" }}>Campañas con Mejor Retorno</Heading>
                    {campanas.length === 0 ? (
                      <p style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic", fontSize: "0.85rem" }}>No hay campañas registradas todavía.</p>
                    ) : (
                      <table>
                        <thead>
                          <tr><th>Campaña</th><th>Canal</th><th>Inversión</th><th>Ingresos</th><th>Leads</th><th>ROI</th></tr>
                        </thead>
                        <tbody>
                          {[...campanas].sort((a, b) => Number(b.roi || 0) - Number(a.roi || 0)).slice(0, 5).map((c) => (
                            <tr key={c.id}>
                              <td style={{ textAlign: "left", fontWeight: 600 }}>{c.nombre}</td>
                              <td>{c.tipo}</td>
                              <td>{fmtMoneda(c.gasto)}</td>
                              <td>{fmtMoneda(c.ingresos_generados || 0)}</td>
                              <td>{leadsPorCampana[c.id] || 0}</td>
                              <td style={{ color: colorRoi(Number(c.roi || 0)), fontWeight: 600 }}>{Number(c.roi || 0).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </>
              )}
            </div>
          )}

          {/* ================= CAMPAÑAS ================= */}
          {seccion === "campanas" && (
            <div>
              <Card style={{ padding: "35px", marginBottom: "35px" }}>
                <Heading style={{ fontSize: "1.05rem", textTransform: "uppercase", marginBottom: "20px" }}>Lanzar Nueva Campaña</Heading>
                <form onSubmit={handleCrearCampana} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", alignItems: "end" }}>
                  <div>
                    <label className="lbl">Nombre de Campaña</label>
                    <input type="text" placeholder="Ej: Expansión Asia-Panamá Hub" value={nuevaCampana.nombre} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevaCampana({ ...nuevaCampana, nombre: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl">Canal</label>
                    <select value={nuevaCampana.tipo} onChange={(e) => setNuevaCampana({ ...nuevaCampana, tipo: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                      <option value="B2B Outbound">B2B Outbound</option>
                      <option value="Email Automation">Email Automation (Brevo SMTP)</option>
                      <option value="SMS Campaign">SMS Campaign</option>
                      <option value="Global Ads">Global Ads</option>
                      <option value="Partners Estratégicos">Partners Estratégicos</option>
                      <option value="Ferias y Eventos">Ferias y Eventos</option>
                      <option value="Referidos">Referidos</option>
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Presupuesto ($ USD)</label>
                    <input type="number" min={0} value={nuevaCampana.presupuesto} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevaCampana({ ...nuevaCampana, presupuesto: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="lbl">Fecha de Inicio</label>
                    <input type="date" value={nuevaCampana.fecha_inicio} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevaCampana({ ...nuevaCampana, fecha_inicio: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl">Fecha de Cierre</label>
                    <input type="date" value={nuevaCampana.fecha_fin} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevaCampana({ ...nuevaCampana, fecha_fin: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl">Meta de Leads</label>
                    <input type="number" min={0} value={nuevaCampana.meta_leads} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevaCampana({ ...nuevaCampana, meta_leads: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div style={{ gridColumn: "1 / 3" }}>
                    <label className="lbl">Objetivo Comercial</label>
                    <input type="text" placeholder="Ej: captar 20 ISP regionales para el Q4" value={nuevaCampana.objetivo} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevaCampana({ ...nuevaCampana, objetivo: e.target.value })} />
                  </div>
                  <Button type="submit" style={{ height: "44px" }}>Lanzar Campaña</Button>
                </form>
              </Card>

              <Card style={{ padding: "35px", overflowX: "auto" }}>
                <Heading style={{ fontSize: "1.05rem", textTransform: "uppercase", marginBottom: "10px" }}>Portafolio de Campañas</Heading>
                {campanas.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay campañas registradas.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Campaña</th><th>Canal</th><th>Estado</th><th>Vigencia</th>
                        <th>Presupuesto</th><th>Gasto</th><th>Ingresos</th>
                        <th>Leads</th><th>CPL</th><th>ROI</th><th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campanas.map((c) => {
                        const nLeads = leadsPorCampana[c.id] || 0;
                        const cpl = nLeads > 0 && Number(c.gasto) > 0 ? Number(c.gasto) / nLeads : 0;
                        const consumo = Number(c.presupuesto) > 0 ? (Number(c.gasto) / Number(c.presupuesto)) * 100 : 0;
                        return (
                          <tr key={c.id}>
                            <td style={{ textAlign: "left", fontWeight: 600 }}>
                              {c.nombre}
                              {c.objetivo && <div style={{ fontSize: "0.7rem", color: "#777", marginTop: "3px" }}>{c.objetivo}</div>}
                            </td>
                            <td style={{ fontSize: "0.78rem" }}>{c.tipo}</td>
                            <td>
                              <select value={c.estado} onChange={(e) => handleCambiarEstadoCampana(c.id, e.target.value)}
                                style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: "0.72rem" }}>
                                {ESTADOS_CAMPANA.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ fontSize: "0.72rem", color: "#aaa" }}>
                              {c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : "—"}
                              <br />{c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString() : "—"}
                            </td>
                            <td>{fmtMoneda(c.presupuesto)}</td>
                            <td>
                              {fmtMoneda(c.gasto)}
                              <div style={{ fontSize: "0.65rem", color: consumo > 100 ? theme.red : "#777", marginTop: "2px" }}>
                                {consumo.toFixed(0)}% consumido
                              </div>
                            </td>
                            <td>{fmtMoneda(c.ingresos_generados || 0)}</td>
                            <td style={{ color: theme.gold, fontWeight: 600 }}>
                              {nLeads}
                              {c.meta_leads ? <div style={{ fontSize: "0.65rem", color: "#777" }}>meta {c.meta_leads}</div> : null}
                            </td>
                            <td>{cpl > 0 ? fmtMoneda(cpl) : "—"}</td>
                            <td style={{ color: colorRoi(Number(c.roi || 0)), fontWeight: 700 }}>{Number(c.roi || 0).toFixed(1)}%</td>
                            <td>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                                <Button variant="outline-gold" onClick={() => abrirModalGasto(c)} style={{ padding: "6px 12px", fontSize: "0.7rem" }}>+ Gasto</Button>
                                <Button variant="outline-green" onClick={() => abrirModalIngreso(c)} style={{ padding: "6px 12px", fontSize: "0.7rem" }}>$ Ingresos</Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              {gastos.length > 0 && (
                <Card style={{ padding: "30px", marginTop: "30px" }}>
                  <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "10px" }}>Libro de Gastos (últimos movimientos)</Heading>
                  <table>
                    <thead><tr><th>Fecha</th><th>Campaña</th><th>Concepto</th><th>Monto</th></tr></thead>
                    <tbody>
                      {gastos.slice(0, 15).map((g) => (
                        <tr key={g.id}>
                          <td style={{ fontSize: "0.78rem", color: "#aaa" }}>{new Date(g.fecha).toLocaleDateString()}</td>
                          <td style={{ textAlign: "left" }}>{campanas.find((c) => c.id === g.campana_id)?.nombre || `#${g.campana_id}`}</td>
                          <td style={{ textAlign: "left", color: "#ccc" }}>{g.concepto}</td>
                          <td style={{ color: theme.red, fontWeight: 600 }}>-{fmtMoneda(g.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          {/* ================= PIPELINE DE LEADS ================= */}
          {seccion === "leads" && (
            <div>
              <Card style={{ padding: "35px", marginBottom: "30px" }}>
                <Heading style={{ fontSize: "1.05rem", textTransform: "uppercase", marginBottom: "20px" }}>Registrar Lead Manualmente</Heading>
                <form onSubmit={handleCrearLead} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", alignItems: "end" }}>
                  <div><label className="lbl">Contacto</label>
                    <input type="text" placeholder="Nombre de la persona" value={nuevoLead.nombre_contacto} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevoLead({ ...nuevoLead, nombre_contacto: e.target.value })} /></div>
                  <div><label className="lbl">Empresa</label>
                    <input type="text" placeholder="Razón social" value={nuevoLead.empresa} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevoLead({ ...nuevoLead, empresa: e.target.value })} /></div>
                  <div><label className="lbl">Email</label>
                    <input type="email" placeholder="contacto@empresa.com" value={nuevoLead.email} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevoLead({ ...nuevoLead, email: e.target.value })} /></div>
                  <div><label className="lbl">Teléfono Celular</label>
                    <input type="text" placeholder="+507 6640 3720" value={nuevoLead.telefono_celular} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevoLead({ ...nuevoLead, telefono_celular: e.target.value })} /></div>
                  <div><label className="lbl">Origen</label>
                    <select value={nuevoLead.origen} onChange={(e) => setNuevoLead({ ...nuevoLead, origen: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                      <option value="Manual">Manual</option>
                      <option value="Web">Formulario Web</option>
                      <option value="Referido">Referido</option>
                      <option value="Feria">Feria / Evento</option>
                      <option value="Email">Campaña de Email</option>
                      <option value="SMS">Campaña de SMS</option>
                      <option value="Redes Sociales">Redes Sociales</option>
                    </select></div>
                  <div><label className="lbl">Campaña Atribuida</label>
                    <select value={nuevoLead.campana_id} onChange={(e) => setNuevoLead({ ...nuevoLead, campana_id: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                      <option value="">— Sin campaña —</option>
                      {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select></div>
                  <div><label className="lbl">Valor Estimado ($)</label>
                    <input type="number" min={0} value={nuevoLead.valor_estimado} style={{ ...inputStyle, width: "100%" }}
                      onChange={(e) => setNuevoLead({ ...nuevoLead, valor_estimado: parseFloat(e.target.value) || 0 })} /></div>
                  <Button type="submit" style={{ height: "44px" }}>Registrar Lead</Button>
                </form>
              </Card>

              <Card style={{ padding: "35px", overflowX: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "15px" }}>
                  <Heading style={{ fontSize: "1.05rem", textTransform: "uppercase", margin: 0 }}>Pipeline de Prospectos Potenciales</Heading>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input type="text" placeholder="Buscar contacto, empresa, email..." value={busquedaLead}
                      onChange={(e) => setBusquedaLead(e.target.value)} style={{ ...inputStyle, width: "260px" }} />
                    <select value={filtroEstadoLeadTabla} onChange={(e) => setFiltroEstadoLeadTabla(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                      <option value="TODOS">Todos los estados</option>
                      {ESTADOS_LEAD.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filtroCampanaTabla} onChange={(e) => setFiltroCampanaTabla(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                      <option value="TODAS">Todas las campañas</option>
                      {campanas.map((c) => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                    </select>
                    <span className="chip">{leadsFiltrados.length} leads</span>
                  </div>
                </div>

                {leadsFiltrados.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay leads que coincidan con los filtros.</p>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Contacto</th><th>Empresa</th><th>Email</th><th>Teléfono</th><th>Campaña / Origen</th><th>Valor Est.</th><th>Estado</th><th>Acción</th></tr>
                    </thead>
                    <tbody>
                      {leadsFiltrados.map((l) => {
                        const camp = campanas.find((c) => c.id === l.campana_id);
                        const yaConvertido = l.estado === "Convertido" || !!l.prospecto_id_convertido;
                        return (
                          <tr key={l.id}>
                            <td style={{ textAlign: "left", fontWeight: 600 }}>{l.nombre_contacto || "—"}</td>
                            <td style={{ textAlign: "left" }}>{l.empresa || "—"}</td>
                            <td style={{ fontSize: "0.78rem", color: theme.gold }}>{l.email || "—"}</td>
                            <td style={{ fontSize: "0.78rem" }}>{l.telefono_celular || "—"}</td>
                            <td style={{ fontSize: "0.75rem" }}>
                              {camp ? <span className="chip">{camp.nombre}</span> : <span style={{ color: "#777" }}>Sin campaña</span>}
                              <div style={{ color: "#777", marginTop: "3px" }}>{l.origen}</div>
                            </td>
                            <td>{Number(l.valor_estimado || 0) > 0 ? fmtMoneda(l.valor_estimado || 0) : "—"}</td>
                            <td>
                              <select value={l.estado} onChange={(e) => handleCambiarEstadoLead(l.id, e.target.value)}
                                style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: "0.72rem" }}>
                                {ESTADOS_LEAD.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td>
                              {yaConvertido ? (
                                <Badge tone="success">✓ En el CRM</Badge>
                              ) : (
                                <Button variant="outline-green" disabled={convirtiendoLead === l.id} style={{ padding: "6px 12px", fontSize: "0.7rem" }}
                                  onClick={() => handleConvertirLeadAProspecto(l)}>
                                  {convirtiendoLead === l.id ? "Enviando..." : "→ Enviar al CRM"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}

          {/* ================= COMUNICACIONES ================= */}
          {seccion === "comunicaciones" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "30px" }}>

                {/* --- Constructor de audiencia --- */}
                <Card style={{ padding: "30px", marginBottom: 0 }}>
                  <Heading style={{ fontSize: "1rem", textTransform: "uppercase", marginBottom: "18px" }}>1 · Definir Audiencia</Heading>

                  {cargandoAudiencias ? (
                    <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>Cargando contactos...</p>
                  ) : (
                    <>
                      <label className="lbl">Fuentes de contactos</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
                        {([
                          ["clientes", `Clientes (${clientesRaw.length})`],
                          ["colaboradores", `Colaboradores (${colaboradoresRaw.length})`],
                          ["leads", `Leads (${leads.length})`],
                          ["prospectos", `Prospectos CRM (${prospectosRaw.length})`],
                        ] as [keyof typeof fuentes, string][]).map(([k, label]) => (
                          <label key={k} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: fuentes[k] ? theme.gold : "rgba(255,255,255,0.55)", fontSize: "0.8rem" }}>
                            <input type="checkbox" checked={fuentes[k]}
                              onChange={(e) => setFuentes({ ...fuentes, [k]: e.target.checked })} />
                            {label}
                          </label>
                        ))}
                      </div>

                      {fuentes.clientes && (
                        <div style={{ background: "#050505", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                          <p style={{ fontSize: "0.7rem", color: theme.gold, margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>Afinar clientes</p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                            <div><label className="lbl">Perfil</label>
                              <select value={fPerfilCliente} onChange={(e) => setFPerfilCliente(e.target.value)} style={{ ...inputStyle, width: "100%", fontSize: "0.75rem", padding: "8px" }}>
                                <option value="TODOS">Todos</option>
                                {PERFILES_CLIENTE.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select></div>
                            <div><label className="lbl">Lista Precio</label>
                              <select value={fPriceList} onChange={(e) => setFPriceList(e.target.value)} style={{ ...inputStyle, width: "100%", fontSize: "0.75rem", padding: "8px" }}>
                                <option value="TODAS">Todas</option>
                                <option value="A">A</option><option value="B">B</option>
                                <option value="C">C</option><option value="D">D</option>
                              </select></div>
                            <div><label className="lbl">Estado</label>
                              <select value={fStatusCliente} onChange={(e) => setFStatusCliente(e.target.value)} style={{ ...inputStyle, width: "100%", fontSize: "0.75rem", padding: "8px" }}>
                                <option value="TODOS">Todos</option>
                                <option value="activo">Activo</option>
                                <option value="pendiente_password">Pendiente contraseña</option>
                              </select></div>
                          </div>
                        </div>
                      )}

                      {fuentes.leads && (
                        <div style={{ background: "#050505", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                          <p style={{ fontSize: "0.7rem", color: theme.gold, margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>Afinar leads</p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div><label className="lbl">Estado</label>
                              <select value={fEstadoLead} onChange={(e) => setFEstadoLead(e.target.value)} style={{ ...inputStyle, width: "100%", fontSize: "0.75rem", padding: "8px" }}>
                                <option value="TODOS">Todos</option>
                                {ESTADOS_LEAD.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select></div>
                            <div><label className="lbl">Campaña</label>
                              <select value={fCampanaLead} onChange={(e) => setFCampanaLead(e.target.value)} style={{ ...inputStyle, width: "100%", fontSize: "0.75rem", padding: "8px" }}>
                                <option value="TODAS">Todas</option>
                                {campanas.map((c) => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                              </select></div>
                          </div>
                        </div>
                      )}

                      <label className="lbl">Buscar dentro de la audiencia</label>
                      <input type="text" placeholder="Nombre, email, teléfono o etiqueta..." value={buscarDest}
                        onChange={(e) => setBuscarDest(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: "14px", boxSizing: "border-box" }} />

                      <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer", color: theme.gold, fontSize: "0.82rem", marginBottom: "12px" }}>
                        <input type="checkbox" checked={enviarATodos} onChange={(e) => setEnviarATodos(e.target.checked)} />
                        Enviar a todos los que cumplen el filtro ({candidatos.length})
                      </label>

                      {!enviarATodos && (
                        <p style={{ fontSize: "0.72rem", color: "#888", margin: "0 0 10px 0" }}>
                          Marca uno por uno a quién le llega. Seleccionados: <strong style={{ color: theme.gold }}>{seleccionados.size}</strong>
                          {seleccionados.size > 0 && (
                            <Button variant="outline-gold" style={{ marginLeft: "10px", padding: "6px 12px", fontSize: "0.7rem" }} onClick={() => setSeleccionados(new Set())}>Limpiar</Button>
                          )}
                        </p>
                      )}

                      <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", background: "#050505" }}>
                        {candidatos.length === 0 ? (
                          <p style={{ color: "#666", fontStyle: "italic", fontSize: "0.8rem", padding: "16px", margin: 0, textAlign: "center" }}>
                            Selecciona al menos una fuente de contactos arriba.
                          </p>
                        ) : (
                          candidatos.map((d) => {
                            const marcado = enviarATodos || seleccionados.has(d.key);
                            return (
                              <div key={d.key}
                                onClick={() => { if (!enviarATodos) toggleSeleccion(d.key); }}
                                style={{
                                  display: "flex", alignItems: "center", gap: "10px",
                                  padding: "9px 13px", borderBottom: "1px solid #131313",
                                  cursor: enviarATodos ? "default" : "pointer",
                                  opacity: marcado ? 1 : 0.45,
                                }}>
                                <input type="checkbox" checked={marcado} readOnly disabled={enviarATodos} style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: "#FFF", fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nombre}</div>
                                  <div style={{ color: "#777", fontSize: "0.68rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {d.email || "sin email"} · {d.telefono || "sin teléfono"}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: "0.62rem", color: theme.gold }}>{d.fuenteLabel}</div>
                                  <div style={{ fontSize: "0.62rem", color: "#666" }}>{d.etiqueta}</div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </Card>

                {/* --- Redacción y envío --- */}
                <Card style={{ padding: "30px", marginBottom: 0 }}>
                  <Heading style={{ fontSize: "1rem", textTransform: "uppercase", marginBottom: "18px" }}>2 · Redactar y Enviar</Heading>

                  <form onSubmit={handleEnviarComunicacion}>
                    <label className="lbl">Canales</label>
                    <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: canalEmail ? theme.gold : "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={canalEmail} onChange={(e) => setCanalEmail(e.target.checked)} /> Email
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: canalSms ? theme.gold : "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={canalSms} onChange={(e) => setCanalSms(e.target.checked)} /> SMS
                      </label>
                    </div>

                    {canalEmail && (
                      <div style={{ marginBottom: "14px" }}>
                        <label className="lbl">Asunto del correo</label>
                        <input type="text" placeholder="Ej: Nueva lista de precios vigente" value={asunto} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                          onChange={(e) => setAsunto(e.target.value)} />
                      </div>
                    )}

                    <label className="lbl">Mensaje</label>
                    <textarea rows={7} placeholder="Escribe el comunicado..." value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)} style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: "6px", boxSizing: "border-box" }} />
                    {canalSms && (
                      <p style={{ fontSize: "0.7rem", color: "#888", margin: "0 0 12px 0" }}>
                        📱 SMS: {mensaje.length} caracteres ({Math.max(1, Math.ceil(mensaje.length / 160))} segmento{mensaje.length > 160 ? "s" : ""}). Mientras más corto, mejor.
                      </p>
                    )}

                    <div style={{ marginBottom: "16px" }}>
                      <label className="lbl">Enviado por (queda en el historial)</label>
                      <input type="text" placeholder="Tu nombre" value={autorEnvio} onChange={(e) => setAutorEnvio(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    </div>

                    {/* Resumen antes de disparar */}
                    <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.35)", borderRadius: "8px", padding: "15px 18px", marginBottom: "18px" }}>
                      <p style={{ fontSize: "0.68rem", color: "#888", textTransform: "uppercase", margin: "0 0 8px 0", letterSpacing: "0.5px" }}>Resumen del envío</p>
                      <p style={{ color: "#FFF", fontSize: "0.85rem", margin: "0 0 8px 0" }}>
                        Llegará a <strong style={{ color: theme.gold, fontSize: "1.15rem" }}>{destinatariosFinales.length}</strong> destinatario(s)
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.74rem", margin: "0 0 6px 0", lineHeight: 1.5 }}>
                        Segmento: {descripcionSegmento}
                      </p>
                      {descartadosPorFalta > 0 && (
                        <p style={{ color: "#e67e22", fontSize: "0.72rem", margin: "6px 0 0 0" }}>
                          ⚠ {descartadosPorFalta} contacto(s) quedan fuera por no tener dato del canal elegido.
                        </p>
                      )}
                      {canalEmail && sinEmail > 0 && (
                        <p style={{ color: "#e67e22", fontSize: "0.72rem", margin: "4px 0 0 0" }}>⚠ {sinEmail} sin email — solo recibirán SMS.</p>
                      )}
                      {canalSms && sinTelefono > 0 && (
                        <p style={{ color: "#e67e22", fontSize: "0.72rem", margin: "4px 0 0 0" }}>⚠ {sinTelefono} sin teléfono — solo recibirán email.</p>
                      )}
                    </div>

                    <Button type="submit" disabled={enviando || destinatariosFinales.length === 0} style={{ width: "100%", padding: "15px" }}>
                      {enviando ? "ENVIANDO..." : `ENVIAR A ${destinatariosFinales.length} DESTINATARIO(S)`}
                    </Button>

                    {resultadoEnvio && (
                      <p style={{ fontSize: "0.82rem", textAlign: "center", marginTop: "14px", marginBottom: 0,
                        color: resultadoEnvio.startsWith("Error") ? theme.red : theme.green }}>
                        {resultadoEnvio}
                      </p>
                    )}
                  </form>

                  <div style={{ marginTop: "20px", padding: "13px 16px", backgroundColor: "rgba(218,165,32,0.04)", border: "1px dashed rgba(218,165,32,0.25)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "0.75rem", color: "#888", margin: 0 }}>
                      📌 <strong style={{ color: theme.gold }}>Push móvil</strong> aún no está conectado — se habilita cuando se publique la app.
                    </p>
                  </div>
                </Card>
              </div>

              {/* --- Historial --- */}
              <Card style={{ padding: "30px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", margin: 0 }}>Historial de Comunicaciones</Heading>
                  <Button variant="outline-gold" style={{ padding: "6px 12px", fontSize: "0.7rem" }} onClick={fetchHistorialEnvios}>↻ Actualizar</Button>
                </div>
                {historialEnvios.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic", fontSize: "0.82rem", textAlign: "center", padding: "12px" }}>
                    Todavía no se ha enviado ninguna comunicación desde este módulo.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {historialEnvios.map((h) => (
                      <div key={h.id} style={{ background: "#050505", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "18px", marginBottom: "6px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span className="chip" style={{ marginRight: "9px" }}>{(h.canales || "").toUpperCase().replace(",", " + ")}</span>
                            <strong style={{ color: "#FFF", fontSize: "0.85rem" }}>{h.asunto || "(sin asunto)"}</strong>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem" }}>{new Date(h.created_at).toLocaleString()}</div>
                            {h.autor && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.68rem" }}>por {h.autor}</div>}
                          </div>
                        </div>
                        <p style={{ color: "#999", fontSize: "0.76rem", margin: "0 0 6px 0", lineHeight: 1.5 }}>
                          {h.mensaje.length > 150 ? h.mensaje.slice(0, 150) + "..." : h.mensaje}
                        </p>
                        <div style={{ display: "flex", gap: "18px", fontSize: "0.7rem", color: "#777", flexWrap: "wrap" }}>
                          <span>👥 {h.total_destinatarios}</span>
                          {h.enviados_email > 0 && <span style={{ color: theme.green }}>✉ {h.enviados_email} enviados</span>}
                          {h.fallidos_email > 0 && <span style={{ color: theme.red }}>✉ {h.fallidos_email} fallaron</span>}
                          {h.enviados_sms > 0 && <span style={{ color: theme.green }}>📱 {h.enviados_sms} enviados</span>}
                          {h.fallidos_sms > 0 && <span style={{ color: theme.red }}>📱 {h.fallidos_sms} fallaron</span>}
                          {h.segmento_descripcion && <span style={{ color: "#666" }}>🎯 {h.segmento_descripcion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ================= ANALÍTICA ================= */}
          {seccion === "analitica" && (
            <div>
              <Card style={{ padding: "35px", marginBottom: "30px", overflowX: "auto" }}>
                <Heading style={{ fontSize: "1.05rem", textTransform: "uppercase", marginBottom: "10px" }}>Rendimiento por Canal</Heading>
                {rendimientoPorCanal.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic", textAlign: "center" }}>Sin campañas para analizar todavía.</p>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Canal</th><th>Campañas</th><th>Inversión</th><th>Ingresos</th><th>Leads</th><th>CPL</th><th>ROI</th></tr>
                    </thead>
                    <tbody>
                      {rendimientoPorCanal.map((r) => {
                        const roi = r.gasto > 0 ? ((r.ingresos - r.gasto) / r.gasto) * 100 : 0;
                        const cpl = r.leads > 0 && r.gasto > 0 ? r.gasto / r.leads : 0;
                        return (
                          <tr key={r.canal}>
                            <td style={{ textAlign: "left", fontWeight: 600 }}>{r.canal}</td>
                            <td>{r.campanas}</td>
                            <td>{fmtMoneda(r.gasto)}</td>
                            <td>{fmtMoneda(r.ingresos)}</td>
                            <td style={{ color: theme.gold, fontWeight: 600 }}>{r.leads}</td>
                            <td>{cpl > 0 ? fmtMoneda(cpl) : "—"}</td>
                            <td style={{ color: colorRoi(roi), fontWeight: 700 }}>{r.gasto > 0 ? `${roi.toFixed(1)}%` : "N/D"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" }}>
                <Card style={{ padding: "30px", marginBottom: 0 }}>
                  <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "18px" }}>Leads por Origen</Heading>
                  {leadsPorOrigen.length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic", fontSize: "0.85rem" }}>Sin leads registrados.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
                      {leadsPorOrigen.map((o) => (
                        <div key={o.origen} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", width: "115px", flexShrink: 0 }}>{o.origen}</span>
                          <div className="barra-fondo">
                            <div className="barra-relleno" style={{ width: `${(o.cantidad / maxOrigen) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: "0.8rem", color: theme.gold, fontWeight: 600, width: "32px", textAlign: "right" }}>{o.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card style={{ padding: "30px", marginBottom: 0 }}>
                  <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "18px" }}>Eficiencia de Adquisición</Heading>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #161616", paddingBottom: "11px" }}>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>Inversión total ejecutada</span>
                      <strong style={{ color: "#FFF", fontSize: "0.9rem" }}>{fmtMoneda(totalGasto)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #161616", paddingBottom: "11px" }}>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>Presupuesto sin ejecutar</span>
                      <strong style={{ color: theme.gold, fontSize: "0.9rem" }}>{fmtMoneda(Math.max(0, totalPresupuesto - totalGasto))}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #161616", paddingBottom: "11px" }}>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>Costo por lead</span>
                      <strong style={{ color: "#FFF", fontSize: "0.9rem" }}>{costoPorLead > 0 ? fmtMoneda(costoPorLead) : "N/D"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #161616", paddingBottom: "11px" }}>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>Costo por lead convertido</span>
                      <strong style={{ color: "#FFF", fontSize: "0.9rem" }}>
                        {leadsConvertidos > 0 && totalGasto > 0 ? fmtMoneda(totalGasto / leadsConvertidos) : "N/D"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>Retorno neto</span>
                      <strong style={{ color: colorRoi(totalIngresos - totalGasto), fontSize: "0.9rem" }}>
                        {fmtMoneda(totalIngresos - totalGasto)}
                      </strong>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ================= COTIZACIONES (Pedidos Especiales, Cable, Producto) ================= */}
          {seccion === "cotizaciones" && <CotizacionManual />}
        </div>
      </div>

      {/* ============ MODAL: REGISTRAR GASTO ============ */}
      {modalGasto.open && modalGasto.campana && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <Card style={{ maxWidth: "440px", width: "100%", marginBottom: 0 }}>
            <Heading style={{ fontSize: "1.1rem", letterSpacing: "1px", marginBottom: 4 }}>REGISTRAR GASTO</Heading>
            <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "20px" }}>
              Campaña: <strong style={{ color: theme.gold }}>{modalGasto.campana.nombre}</strong><br />
              <span style={{ fontSize: "0.78rem", color: "#777" }}>
                Gasto acumulado actual: {fmtMoneda(modalGasto.campana.gasto)} de {fmtMoneda(modalGasto.campana.presupuesto)}
              </span>
            </p>
            <div style={{ marginBottom: "14px" }}>
              <label className="lbl">Monto ($ USD)</label>
              <input type="number" min={0} value={nuevoGasto.monto} style={{ ...inputStyle, width: "100%" }}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: parseFloat(e.target.value) || 0 })} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label className="lbl">Concepto</label>
              <input type="text" placeholder="Ej: pauta digital octubre" value={nuevoGasto.concepto} style={{ ...inputStyle, width: "100%" }}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, concepto: e.target.value })} />
            </div>
            <div style={{ marginBottom: "22px" }}>
              <label className="lbl">Fecha</label>
              <input type="date" value={nuevoGasto.fecha} style={{ ...inputStyle, width: "100%" }}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalGasto({ open: false, campana: null })}>
                CANCELAR
              </Button>
              <Button onClick={handleRegistrarGasto}>GUARDAR GASTO</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ============ MODAL: INGRESOS ATRIBUIDOS ============ */}
      {modalIngreso.open && modalIngreso.campana && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <Card style={{ maxWidth: "440px", width: "100%", marginBottom: 0, border: `1px solid ${theme.greenBorder}` }}>
            <Heading style={{ fontSize: "1.1rem", letterSpacing: "1px", marginBottom: 4, color: theme.green }}>INGRESOS ATRIBUIDOS</Heading>
            <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "20px" }}>
              Campaña: <strong style={{ color: theme.gold }}>{modalIngreso.campana.nombre}</strong><br />
              <span style={{ fontSize: "0.78rem", color: "#777" }}>
                Ventas cerradas que se le atribuyen a esta campaña. Con esto se recalcula el ROI.
              </span>
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label className="lbl">Ingresos totales ($ USD)</label>
              <input type="number" min={0} value={montoIngreso} style={{ ...inputStyle, width: "100%" }}
                onChange={(e) => setMontoIngreso(parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "8px", padding: "13px 16px", marginBottom: "22px", fontSize: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ color: "#888" }}>Gasto acumulado</span>
                <strong style={{ color: "#e74c3c" }}>{fmtMoneda(modalIngreso.campana.gasto)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>ROI resultante</span>
                <strong style={{ color: colorRoi(Number(modalIngreso.campana.gasto) > 0 ? ((montoIngreso - Number(modalIngreso.campana.gasto)) / Number(modalIngreso.campana.gasto)) * 100 : 0) }}>
                  {Number(modalIngreso.campana.gasto) > 0
                    ? `${(((montoIngreso - Number(modalIngreso.campana.gasto)) / Number(modalIngreso.campana.gasto)) * 100).toFixed(1)}%`
                    : "N/D (sin gasto registrado)"}
                </strong>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalIngreso({ open: false, campana: null })}>
                CANCELAR
              </Button>
              <Button variant="outline-green" onClick={handleRegistrarIngreso}>
                GUARDAR
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
