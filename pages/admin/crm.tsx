import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/router";
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
  DataRow,
} from "../../lib/ui";

type Prospecto = {
  id: number;
  razon_social: string;
  email: string;
  telefono_celular: string;
  perfil_cliente: string;
  industria: string;
  pais: string;
  status: string;
  etapa_pipeline: string;
};

type Oportunidad = {
  id: number;
  titulo: string;
  pipeline_tipo: string;
  etapa: string;
  valor_estimado: number;
  probabilidad: number;
  vendedor_asignado: string;
};

// Las cotizaciones (tabla "quotes") tienen campos muy variables según cómo
// se generaron — igual que en pages/admin/cotizaciones.tsx, se maneja como
// "any" y se resuelven los campos reales al mostrar, en vez de un tipo fijo.

type ClienteReal = {
  id: string; // uuid
  razon_social: string;
  nombre_representante: string;
  email: string;
  telefono_celular: string;
  price_list: string;
  status: string;
};

type ActividadBitacora = {
  id: number;
  cliente_id: string;
  tipo: string;
  descripcion: string;
  autor: string;
  fecha_contacto: string;
};

// --- Auditoría & Métricas ---
// Métricas calculadas al vuelo desde las tablas ya existentes (no requieren
// tabla nueva). La bitácora de auditoría sí necesita la tabla "audit_log"
// (ver instrucciones SQL entregadas junto con este componente).

type MetricasComerciales = {
  prospectosTotalHistorico: number;
  prospectosConvertidos: number;
  oportunidadesGanadas: number;
  oportunidadesPerdidas: number;
  valorGanado: number;
  cotizacionesTotal: number;
  cotizacionesValorTotal: number;
  cotizacionesAbonadoTotal: number;
};

type EntradaAuditoria = {
  id: number;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: string | null;
  autor: string | null;
  created_at: string;
};

/**
 * Determina la Lista de Precios (una sola letra, tal como se guarda en la
 * columna price_list de la tabla clientes) según el perfil B2B del cliente.
 * Misma lógica que pages/admin/validaciones.tsx — se repite acá para que
 * la conversión desde el CRM active al cliente exactamente igual.
 * ISP -> A | MAYORISTA -> B | INTEGRADOR -> C | resto (Cliente Final) -> D
 */
const determinarPriceList = (perfil?: string): "A" | "B" | "C" | "D" => {
  const p = (perfil || "").toUpperCase().trim();
  switch (p) {
    case "ISP":
      return "A";
    case "MAYORISTA":
      return "B";
    case "INTEGRADOR":
      return "C";
    case "CLIENTE FINAL":
    default:
      return "D";
  }
};

/**
 * Lista de etapas del pipeline. La etapa es solo una categoría visual del
 * proceso de venta; NO determina la probabilidad — esa la define el
 * vendedor a mano, según su lectura real de la negociación.
 */
const ETAPAS_PIPELINE = ["Prospecto", "Calificado", "Propuesta", "Negociación", "Ganado", "Perdido"] as const;

export default function CRMEpicoEnterprise() {
  const router = useRouter();
  const [pestanaActiva, setPestanaActiva] = useState<"clientes" | "pipeline" | "actividades" | "cpq" | "gobierno">("clientes");
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [nuevoProspecto, setNuevoProspecto] = useState({
    razon_social: "",
    email: "",
    telefono_celular: "",
    perfil_cliente: "ISP",
    industria: "Telecomunicaciones y Fibra Óptica",
    pais: "Panamá",
  });
  const [nuevaOportunidad, setNuevaOportunidad] = useState({ titulo: "", pipeline_tipo: "B2B Licitación", valor_estimado: 0, probabilidad: 25, vendedor_asignado: "Fred Jurado" });

  // --- Modal de conversión a cliente real ---
  const [modalConversion, setModalConversion] = useState<{ isOpen: boolean; prospecto: Prospecto | null }>({
    isOpen: false,
    prospecto: null,
  });
  const [tipoPagoConversion, setTipoPagoConversion] = useState<string>("50%");
  const [porcentajeEspecial, setPorcentajeEspecial] = useState<number>(50);
  const [convirtiendo, setConvirtiendo] = useState<boolean>(false);

  // --- Ficha Operativa (bitácora por cliente real) ---
  const [clientesReales, setClientesReales] = useState<ClienteReal[]>([]);
  const [clientesRealesCargados, setClientesRealesCargados] = useState<boolean>(false);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string>("");
  const [actividades, setActividades] = useState<ActividadBitacora[]>([]);
  const [cargandoActividades, setCargandoActividades] = useState<boolean>(false);
  const [nuevaActividad, setNuevaActividad] = useState({ tipo: "Nota", descripcion: "", autor: "" });

  // --- CPQ & Cotizaciones (portado de pages/admin/cotizaciones.tsx) ---
  const [busquedaCotizaciones, setBusquedaCotizaciones] = useState("");
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<any>(null);
  const [modalCotizacionAbierto, setModalCotizacionAbierto] = useState(false);
  const [cargandoPdf, setCargandoPdf] = useState(false);

  // --- Auditoría & Métricas ---
  const [metricas, setMetricas] = useState<MetricasComerciales | null>(null);
  const [bitacoraAuditoria, setBitacoraAuditoria] = useState<EntradaAuditoria[]>([]);
  const [cargandoGobierno, setCargandoGobierno] = useState(false);
  const [gobiernoCargado, setGobiernoCargado] = useState(false);

  useEffect(() => {
    fetchCRMData();
  }, []);

  useEffect(() => {
    if (pestanaActiva === "gobierno" && !gobiernoCargado) {
      fetchMetricasYAuditoria();
    }
  }, [pestanaActiva]);

  useEffect(() => {
    if (pestanaActiva === "actividades" && !clientesRealesCargados) {
      fetchClientesReales();
    }
  }, [pestanaActiva]);

  useEffect(() => {
    if (clienteSeleccionadoId) {
      fetchActividades(clienteSeleccionadoId);
    } else {
      setActividades([]);
    }
  }, [clienteSeleccionadoId]);

  const fetchCRMData = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data: prosData, error: prosError } = await supabase
        .from("crm_prospectos")
        .select("*")
        .eq("status", "prospecto")
        .order("id", { ascending: false });
      if (prosError) console.error("Error consultando crm_prospectos:", prosError.message);

      const { data: oppData, error: oppError } = await supabase.from("crm_opportunities").select("*").order("id", { ascending: false });
      if (oppError) console.error("Error consultando crm_opportunities (¿existe la tabla?):", oppError.message);

      const { data: quoteData, error: quoteError } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
      if (quoteError) console.error("Error consultando quotes:", quoteError.message);

      if (prosData) setProspectos(prosData);
      if (oppData) setOportunidades(oppData);
      if (quoteData) setCotizaciones(quoteData);
    } catch (error) {
      console.error("Error sincronizando clúster CRM:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carga la lista de clientes REALES (tabla clientes) para el selector
   * de la Ficha Operativa. Se carga una sola vez, la primera vez que se
   * abre este tab, para no pedirla de más si nunca se usa.
   */
  const fetchClientesReales = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("clientes")
      .select("id, razon_social, nombre_representante, email, telefono_celular, price_list, status")
      .order("razon_social", { ascending: true });

    if (error) {
      console.error("Error consultando clientes reales:", error.message);
    } else {
      setClientesReales(data || []);
    }
    setClientesRealesCargados(true);
  };

  /**
   * Carga la bitácora de contacto de un cliente puntual, más reciente primero.
   */
  const fetchActividades = async (clienteId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    setCargandoActividades(true);
    const { data, error } = await supabase
      .from("crm_activities")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("fecha_contacto", { ascending: false });

    if (error) {
      console.error("Error consultando crm_activities (¿existe la tabla?):", error.message);
      setActividades([]);
    } else {
      setActividades(data || []);
    }
    setCargandoActividades(false);
  };

  /**
   * Calcula las métricas comerciales (Win Rate, conversión de prospectos,
   * estado de cobro de cotizaciones) directamente desde las tablas ya
   * existentes: crm_prospectos, crm_opportunities y quotes. No requiere
   * ninguna tabla nueva — solo consultas puntuales de conteo/suma.
   * Además carga las últimas 20 entradas de la bitácora de auditoría
   * (tabla "audit_log", ver instrucciones SQL aparte).
   */
  const fetchMetricasYAuditoria = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setCargandoGobierno(true);
    try {
      const [
        prospectosTotalRes,
        prospectosConvertidosRes,
        oppGanadasRes,
        oppPerdidasRes,
        quotesRes,
        auditRes,
      ] = await Promise.all([
        supabase.from("crm_prospectos").select("id", { count: "exact", head: true }),
        supabase.from("crm_prospectos").select("id", { count: "exact", head: true }).eq("status", "convertido"),
        supabase.from("crm_opportunities").select("valor_estimado").eq("etapa", "Ganado"),
        supabase.from("crm_opportunities").select("id", { count: "exact", head: true }).eq("etapa", "Perdido"),
        supabase.from("quotes").select("total, monto_abono"),
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      const valorGanado = (oppGanadasRes.data || []).reduce((acc: number, o: any) => acc + Number(o.valor_estimado || 0), 0);
      const cotizacionesValorTotal = (quotesRes.data || []).reduce((acc: number, q: any) => acc + Number(q.total || 0), 0);
      const cotizacionesAbonadoTotal = (quotesRes.data || []).reduce((acc: number, q: any) => acc + Number(q.monto_abono || 0), 0);

      setMetricas({
        prospectosTotalHistorico: prospectosTotalRes.count || 0,
        prospectosConvertidos: prospectosConvertidosRes.count || 0,
        oportunidadesGanadas: (oppGanadasRes.data || []).length,
        oportunidadesPerdidas: oppPerdidasRes.count || 0,
        valorGanado,
        cotizacionesTotal: (quotesRes.data || []).length,
        cotizacionesValorTotal,
        cotizacionesAbonadoTotal,
      });

      if (auditRes.error) {
        console.error("Error consultando audit_log (¿existe la tabla? revisa el SQL de configuración):", auditRes.error.message);
        setBitacoraAuditoria([]);
      } else {
        setBitacoraAuditoria(auditRes.data || []);
      }
    } catch (err) {
      console.error("Error calculando métricas comerciales:", err);
    } finally {
      setCargandoGobierno(false);
      setGobiernoCargado(true);
    }
  };

  /**
   * Inserta una entrada en la bitácora de auditoría (tabla audit_log).
   * Se llama "en segundo plano" desde las acciones clave del CRM
   * (conversión de cliente, altas de oportunidad, cambios de etapa, etc.)
   * y nunca bloquea ni interrumpe la acción principal si falla.
   */
  const registrarAuditoria = async (accion: string, entidad: string, entidadId: string | number | null, detalle: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { error } = await supabase.from("audit_log").insert([
        {
          accion,
          entidad,
          entidad_id: entidadId != null ? String(entidadId) : null,
          detalle,
          autor: null,
        },
      ]);
      if (error) console.error("No se pudo registrar en audit_log (¿existe la tabla?):", error.message);
    } catch (err) {
      console.error("Error registrando auditoría:", err);
    }
  };

  const handleCrearActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSeleccionadoId) return alert("Selecciona un cliente primero.");
    if (!nuevaActividad.descripcion.trim()) return alert("Escribe una descripción para la entrada de la bitácora.");

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { error } = await supabase.from("crm_activities").insert([
      {
        cliente_id: clienteSeleccionadoId,
        tipo: nuevaActividad.tipo,
        descripcion: nuevaActividad.descripcion,
        autor: nuevaActividad.autor || null,
      },
    ]);

    if (error) {
      alert("Error al registrar la actividad: " + error.message);
    } else {
      setNuevaActividad({ tipo: "Nota", descripcion: "", autor: nuevaActividad.autor });
      fetchActividades(clienteSeleccionadoId);
    }
  };

  // Función de seguridad para evitar errores con JSON (items/productos/details)
  const parseJSON = (value: any) => {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return {};
    }
  };

  const resolverDatosCliente = (item: any) => {
    const empresa = item.razon_social || item.empresa || item.nombre_empresa || item.company || "Sin especificar";
    const representante = item.nombre_representante || item.representante || item.contacto || item.nombre_contacto || "N/D";
    const email = item.email || item.correo || "N/D";
    const telefono = item.telefono_celular || item.telefono_oficina || item.telefono || item.celular || "N/D";
    return { empresa, representante, email, telefono };
  };

  /**
   * Genera el texto descriptivo de la forma de pago acordada con el cliente.
   * Misma lógica que ya se usa en validaciones.tsx y en la conversión del CRM,
   * centralizada acá para reusarla también al mostrar el detalle de una cotización.
   */
  const descripcionFormaPago = (formaPago?: string | null, porcentajePago?: number | null): string => {
    if (!formaPago) return "No definida para este cliente.";
    if (formaPago === "50%") {
      return "50% a la orden de compra / aceptación de cotización y el 50% restante exactos 3 días antes de la fecha estimada de despacho.";
    }
    if (formaPago === "100%") {
      return "100% de pago anticipado a la aceptación de la cotización o emisión de orden de compra (Sin saldo pendiente).";
    }
    const inicial = porcentajePago ?? 50;
    const saldo = 100 - inicial;
    return `Especial: ${inicial}% a la aceptación de cotización / orden de compra y el diferencial de saldo de ${saldo}% exigible obligatoriamente 3 días antes de la fecha estimada de despacho.`;
  };

  const abrirDetalleCotizacion = async (item: any) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { empresa, representante, email, telefono } = resolverDatosCliente(item);
    const itemEnriquecido = {
      ...item,
      empresaResuelto: empresa,
      representanteResuelto: representante,
      emailResuelto: email,
      telefonoResuelto: telefono,
    };

    setCotizacionSeleccionada(itemEnriquecido);
    setModalCotizacionAbierto(true);
    setCargandoPdf(false);

    // Buscar la forma de pago acordada con el cliente real (cruzando por
    // cliente_id si la cotización lo tiene, o por email como respaldo).
    try {
      let clienteInfo: { forma_pago: string | null; porcentaje_pago: number | null } | null = null;

      if (item.cliente_id) {
        const { data } = await supabase
          .from("clientes")
          .select("forma_pago, porcentaje_pago")
          .eq("id", item.cliente_id)
          .maybeSingle();
        clienteInfo = data;
      } else if (email && email !== "N/D") {
        const { data } = await supabase
          .from("clientes")
          .select("forma_pago, porcentaje_pago")
          .ilike("email", email)
          .maybeSingle();
        clienteInfo = data;
      }

      setCotizacionSeleccionada((prev: any) => ({
        ...prev,
        formaPagoCliente: clienteInfo?.forma_pago || null,
        porcentajePagoCliente: clienteInfo?.porcentaje_pago ?? null,
      }));
    } catch (err) {
      console.error("Error consultando forma de pago del cliente:", err);
    }

    if (item.pdf_url && !item.pdf_url.startsWith("http")) {
      setCargandoPdf(true);
      try {
        const { data } = supabase.storage.from("documentos").getPublicUrl(item.pdf_url);
        if (data?.publicUrl) {
          setCotizacionSeleccionada((prev: any) => ({ ...prev, pdf_url_final: data.publicUrl }));
        }
      } catch (err) {
        console.error("Error al obtener URL del bucket documentos:", err);
      } finally {
        setCargandoPdf(false);
      }
    } else if (item.pdf_url) {
      setCotizacionSeleccionada((prev: any) => ({ ...prev, pdf_url_final: item.pdf_url }));
    } else if (item.referencia) {
      setCargandoPdf(true);
      try {
        const possiblePaths = [`${item.referencia}.pdf`, `${item.referencia.toLowerCase()}.pdf`];
        for (const path of possiblePaths) {
          const { data } = supabase.storage.from("documentos").getPublicUrl(path);
          if (data?.publicUrl) {
            setCotizacionSeleccionada((prev: any) => ({ ...prev, pdf_url_final: data.publicUrl }));
            break;
          }
        }
      } catch (err) {
        console.error("Error buscando archivo por referencia:", err);
      } finally {
        setCargandoPdf(false);
      }
    }
  };

  const cerrarDetalleCotizacion = () => {
    setCotizacionSeleccionada(null);
    setModalCotizacionAbierto(false);
    setCargandoPdf(false);
  };

  const handleCrearProspecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProspecto.razon_social) return alert("Ingrese el nombre de la empresa.");
    if (!nuevoProspecto.email) return alert("Ingrese el email del contacto (obligatorio para poder convertirlo en cliente más adelante).");

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { error } = await supabase.from("crm_prospectos").insert([{ ...nuevoProspecto, status: "prospecto", etapa_pipeline: "Prospecto" }]);
    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setNuevoProspecto({ razon_social: "", email: "", telefono_celular: "", perfil_cliente: "ISP", industria: "Telecomunicaciones y Fibra Óptica", pais: "Panamá" });
      registrarAuditoria("prospecto_creado", "prospecto", null, `Se registró el prospecto ${nuevoProspecto.razon_social}.`);
      fetchCRMData();
      alert("Prospecto registrado exitosamente.");
    }
  };

  const handleCrearOportunidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaOportunidad.titulo) return alert("Ingrese el título de la oportunidad.");

    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { error } = await supabase.from("crm_opportunities").insert([
      { ...nuevaOportunidad, etapa: "Prospecto" }
    ]);
    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setNuevaOportunidad({ titulo: "", pipeline_tipo: "B2B Licitación", valor_estimado: 0, probabilidad: 25, vendedor_asignado: "Fred Jurado" });
      registrarAuditoria("oportunidad_creada", "oportunidad", null, `Se abrió la oportunidad "${nuevaOportunidad.titulo}" por $${nuevaOportunidad.valor_estimado.toLocaleString()}.`);
      fetchCRMData();
      alert("Oportunidad añadida al Pipeline.");
    }
  };

  /**
   * Cambia solo la etapa de una oportunidad (categoría del proceso de
   * venta). No toca la probabilidad — esa se edita por separado.
   */
  const handleCambiarEtapa = async (oportunidadId: number, nuevaEtapa: string) => {
    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const { error } = await supabase
      .from("crm_opportunities")
      .update({ etapa: nuevaEtapa })
      .eq("id", oportunidadId);

    if (error) {
      alert("Error al actualizar la etapa: " + error.message);
      return;
    }

    setOportunidades((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, etapa: nuevaEtapa } : o)));

    const oportunidadAfectada = oportunidades.find((o) => o.id === oportunidadId);
    registrarAuditoria(
      "etapa_cambiada",
      "oportunidad",
      oportunidadId,
      `"${oportunidadAfectada?.titulo || oportunidadId}" pasó a la etapa "${nuevaEtapa}".`
    );
  };

  /**
   * Actualiza la probabilidad de cierre de una oportunidad, según el
   * criterio real del vendedor (no un valor calculado automáticamente).
   */
  const handleCambiarProbabilidad = async (oportunidadId: number, nuevaProbabilidad: number) => {
    const supabase = getSupabase();
    if (!supabase) return alert("No se pudo conectar con la base de datos.");

    const probabilidadValida = Math.max(0, Math.min(100, nuevaProbabilidad));

    const { error } = await supabase
      .from("crm_opportunities")
      .update({ probabilidad: probabilidadValida })
      .eq("id", oportunidadId);

    if (error) {
      alert("Error al actualizar la probabilidad: " + error.message);
      return;
    }

    setOportunidades((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, probabilidad: probabilidadValida } : o)));
  };

  const abrirModalConversion = (prospecto: Prospecto) => {
    setModalConversion({ isOpen: true, prospecto });
    setTipoPagoConversion("50%");
    setPorcentajeEspecial(50);
  };

  const cerrarModalConversion = () => {
    setModalConversion({ isOpen: false, prospecto: null });
  };

  /**
   * Convierte un prospecto del CRM en un cliente real, siguiendo EXACTAMENTE
   * la misma lógica que el botón "ACTIVAR" en pages/admin/validaciones.tsx:
   * calcula price_list según el perfil, genera un password_token, hace upsert
   * en "clientes" con status "pendiente_password", y dispara el email de
   * activación con el link a crear-password.tsx.
   */
  const confirmarConversion = async () => {
    const prospecto = modalConversion.prospecto;
    if (!prospecto) return;

    const supabase = getSupabase();
    if (!supabase) {
      alert("No se pudo conectar con la base de datos.");
      return;
    }

    setConvirtiendo(true);

    let porcentajeInicialReal = 50;
    let porcentajeSaldoReal = 50;
    let descripcionFormaPago = "";

    if (tipoPagoConversion === "50%") {
      porcentajeInicialReal = 50;
      porcentajeSaldoReal = 50;
      descripcionFormaPago = "50% a la orden de compra / aceptación de cotización y el 50% restante exactos 3 días antes de la fecha estimada de despacho.";
    } else if (tipoPagoConversion === "100%") {
      porcentajeInicialReal = 100;
      porcentajeSaldoReal = 0;
      descripcionFormaPago = "100% de pago anticipado a la aceptación de la cotización o emisión de orden de compra (Sin saldo pendiente).";
    } else {
      porcentajeInicialReal = porcentajeEspecial;
      porcentajeSaldoReal = 100 - porcentajeEspecial;
      descripcionFormaPago = `Especial: ${porcentajeInicialReal}% a la aceptación de cotización / orden de compra y el diferencial de saldo de ${porcentajeSaldoReal}% exigible obligatoriamente 3 días antes de la fecha estimada de despacho.`;
    }

    const passwordToken = "trulink_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const priceListVal = determinarPriceList(prospecto.perfil_cliente);

    // 1. Guardar en la tabla CLIENTES real (mismo patrón que validaciones.tsx)
    const { data: clienteInsertado, error: clienteError } = await supabase
      .from("clientes")
      .upsert(
        {
          razon_social: prospecto.razon_social,
          email: prospecto.email,
          tipo_cliente: prospecto.perfil_cliente || "Integrador",
          price_list: priceListVal,
          status: "pendiente_password",
          password_token: passwordToken,
          forma_pago: tipoPagoConversion,
          porcentaje_pago: porcentajeInicialReal,
          pais: prospecto.pais || null,
          telefono_celular: prospecto.telefono_celular || null,
          perfil_cliente: prospecto.perfil_cliente || null,
          industria: prospecto.industria || null,
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (clienteError) {
      alert("Error al convertir a cliente: " + clienteError.message);
      setConvirtiendo(false);
      return;
    }

    // 2. Enviar correo de activación (mismo endpoint que validaciones.tsx)
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "ACTIVACION",
          email: prospecto.email,
          razon_social: prospecto.razon_social,
          link: `https://portal.trulinkfiber.org/auth/crear-password?token=${passwordToken}`,
          forma_pago_texto: descripcionFormaPago,
          porcentaje_inicial: porcentajeInicialReal,
          porcentaje_saldo: porcentajeSaldoReal,
        }),
      });
    } catch (err: any) {
      console.error("Error enviando correo de activación:", err.message);
    }

    // 3. Marcar el prospecto como convertido (no se borra, queda de historial)
    const { error: updateProspectoError } = await supabase
      .from("crm_prospectos")
      .update({
        status: "convertido",
        cliente_id_convertido: clienteInsertado?.id || null,
        fecha_conversion: new Date().toISOString(),
      })
      .eq("id", prospecto.id);

    if (updateProspectoError) {
      console.error("El cliente se creó, pero no se pudo marcar el prospecto como convertido:", updateProspectoError.message);
    }

    setProspectos((prev) => prev.filter((p) => p.id !== prospecto.id));
    registrarAuditoria(
      "cliente_convertido",
      "cliente",
      clienteInsertado?.id || null,
      `${prospecto.razon_social} fue activado como cliente real (Lista de Precio ${priceListVal}, forma de pago ${tipoPagoConversion}).`
    );
    setConvirtiendo(false);
    cerrarModalConversion();
    alert(`${prospecto.razon_social} fue convertido a cliente real. Se envió el correo de activación.`);
  };

  // Solo las oportunidades realmente abiertas cuentan para las métricas de
  // arriba — "Ganado" y "Perdido" ya se cerraron, así que no deben inflar
  // el pipeline ni el forecast. La tabla de abajo sigue mostrando todas,
  // para conservar el historial completo.
  const oportunidadesAbiertas = oportunidades.filter((o) => o.etapa !== "Ganado" && o.etapa !== "Perdido");
  const forecastTotal = oportunidadesAbiertas.reduce((acc, o) => acc + (Number(o.valor_estimado) * (Number(o.probabilidad) / 100)), 0);
  const pipelineValorTotal = oportunidadesAbiertas.reduce((acc, o) => acc + Number(o.valor_estimado), 0);

  const cotizacionesFiltradas = cotizaciones.filter((item) => {
    const { empresa, representante, email, telefono } = resolverDatosCliente(item);
    const referencia = item.referencia || `QT-${item.id}`;
    const tipo = item.type || item.tipo || item.tipo_solicitud || "";
    const termino = busquedaCotizaciones.toLowerCase();
    return (
      referencia.toLowerCase().includes(termino) ||
      empresa.toLowerCase().includes(termino) ||
      representante.toLowerCase().includes(termino) ||
      email.toLowerCase().includes(termino) ||
      telefono.toLowerCase().includes(termino) ||
      tipo.toLowerCase().includes(termino) ||
      item.id?.toString().includes(termino)
    );
  });

  // ------------------------------------------------------------
  // Estilos locales (tokens del sistema de diseño compartido)
  // ------------------------------------------------------------
  const lbStyle: CSSProperties = {
    display: "block",
    fontSize: "0.7rem",
    color: theme.textMuted,
    marginBottom: "6px",
    textTransform: "uppercase",
  };

  const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: "15px" };
  const thStyle: CSSProperties = {
    border: `1px solid ${theme.borderGoldLight}`,
    padding: "14px",
    textAlign: "center",
    background: theme.background,
    color: theme.gold,
    fontWeight: 600,
    textTransform: "uppercase",
    fontSize: "0.75rem",
    letterSpacing: "1.5px",
  };
  const tdStyle: CSSProperties = {
    border: `1px solid ${theme.borderGoldLight}`,
    padding: "14px",
    textAlign: "center",
    color: theme.textLight,
    fontSize: "0.9rem",
  };

  const overlayStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
    padding: "20px",
    boxSizing: "border-box",
  };

  // El link de descarga del PDF necesita verse como el botón "gold" pero es
  // un <a>, no un <button> — Button (lib/ui.tsx) no soporta anchors, así que
  // se replica su estilo acá con los mismos tokens de theme.
  const goldLinkStyle: CSSProperties = {
    padding: "10px 24px",
    borderRadius: theme.radiusSm,
    fontWeight: 700,
    fontSize: "0.85rem",
    letterSpacing: "0.5px",
    cursor: "pointer",
    background: theme.goldGradient,
    color: "#1A1400",
    border: `1px solid ${theme.gold}`,
    boxShadow: "0 2px 10px rgba(218,165,32,0.3)",
    textDecoration: "none",
    display: "inline-block",
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="crm" />

      <div style={pageWrapStyle({ overflowX: "auto" })}>
        <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
          {/* Navegación Superior — pestañas */}
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px", marginBottom: "30px" }}>
            <Button variant={pestanaActiva === "clientes" ? "gold" : "outline-gold"} onClick={() => setPestanaActiva("clientes")}>
              🏢 Clientes & Cuentas
            </Button>
            <Button variant={pestanaActiva === "pipeline" ? "gold" : "outline-gold"} onClick={() => setPestanaActiva("pipeline")}>
              📈 Pipeline & Forecast
            </Button>
            <Button variant={pestanaActiva === "actividades" ? "gold" : "outline-gold"} onClick={() => setPestanaActiva("actividades")}>
              📞 Ficha Operativa
            </Button>
            <Button variant={pestanaActiva === "cpq" ? "gold" : "outline-gold"} onClick={() => setPestanaActiva("cpq")}>
              📑 CPQ & Cotizaciones
            </Button>
            <Button variant={pestanaActiva === "gobierno" ? "gold" : "outline-gold"} onClick={() => setPestanaActiva("gobierno")}>
              🛡️ Auditoría & Métricas
            </Button>
          </div>

          <PageHeader
            title="ENTERPRISE PURE CRM SUITE"
            subtitle="SISTEMA GLOBAL DE GESTIÓN COMERCIAL • TRULINK FIBER LLC"
          />

          {/* SECCIÓN 1: PROSPECTOS (antes "clientes", ahora tabla separada crm_prospectos) */}
          {pestanaActiva === "clientes" && (
            <div>
              <Card style={{ padding: "35px", marginBottom: "40px" }}>
                <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase" }}>
                  Registro de Prospecto Comercial
                </Heading>
                <form onSubmit={handleCrearProspecto} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", alignItems: "end", marginTop: "20px" }}>
                  <div>
                    <label style={lbStyle}>Empresa / Prospecto</label>
                    <input type="text" placeholder="Ej: IGTEL Honduras" value={nuevoProspecto.razon_social} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, razon_social: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={lbStyle}>Email de Contacto</label>
                    <input type="email" placeholder="contacto@empresa.com" value={nuevoProspecto.email} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, email: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={lbStyle}>Teléfono Celular</label>
                    <input type="text" placeholder="Ej: 66403720" value={nuevoProspecto.telefono_celular} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, telefono_celular: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={lbStyle}>Perfil de Cliente</label>
                    <select value={nuevoProspecto.perfil_cliente} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, perfil_cliente: e.target.value })} style={inputStyle}>
                      <option value="ISP">ISP</option>
                      <option value="MAYORISTA">MAYORISTA</option>
                      <option value="INTEGRADOR">INTEGRADOR</option>
                      <option value="CLIENTE FINAL">CLIENTE FINAL</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbStyle}>Industria</label>
                    <input type="text" value={nuevoProspecto.industria} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, industria: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={lbStyle}>País / Región</label>
                    <input type="text" value={nuevoProspecto.pais} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, pais: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Button type="submit" style={{ height: "45px", width: "100%" }}>Guardar Prospecto</Button>
                  </div>
                </form>
              </Card>

              <Card style={{ padding: "35px" }}>
                <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "20px" }}>
                  Directorio de Prospectos (Pendientes de Cerrar Venta)
                </Heading>
                {loading ? (
                  <p style={{ color: theme.textMuted, textAlign: "center" }}>Cargando...</p>
                ) : prospectos.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontStyle: "italic", textAlign: "center" }}>No hay prospectos registrados.</p>
                ) : (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Empresa</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Perfil</th>
                        <th style={thStyle}>Industria</th>
                        <th style={thStyle}>País</th>
                        <th style={thStyle}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospectos.map((p) => (
                        <tr key={p.id}>
                          <td style={{ ...tdStyle, color: theme.textMuted }}>#{p.id}</td>
                          <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600 }}>{p.razon_social}</td>
                          <td style={{ ...tdStyle, fontSize: "0.8rem" }}>{p.email}</td>
                          <td style={tdStyle}><Badge tone="gold">{p.perfil_cliente}</Badge></td>
                          <td style={tdStyle}>{p.industria}</td>
                          <td style={tdStyle}>{p.pais}</td>
                          <td style={tdStyle}>
                            <Button variant="outline-green" onClick={() => abrirModalConversion(p)}>
                              ✓ Convertir a Cliente
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}

          {/* SECCIÓN 2: PIPELINE & FORECASTING (sin cambios de lógica) */}
          {pestanaActiva === "pipeline" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "25px", marginBottom: "40px" }}>
                <Card style={{ padding: "30px" }}>
                  <span style={lbStyle}>Valor Total en Pipeline</span>
                  <h2 style={{ fontSize: "2.2rem", color: theme.textLight, margin: "10px 0 0 0", fontWeight: 400 }}>${pipelineValorTotal.toLocaleString()}</h2>
                </Card>
                <Card style={{ padding: "30px" }}>
                  <span style={lbStyle}>Forecast Ponderado (Ingresos)</span>
                  <h2 style={{ fontSize: "2.2rem", color: theme.gold, margin: "10px 0 0 0", fontWeight: 400 }}>${forecastTotal.toLocaleString()}</h2>
                </Card>
                <Card style={{ padding: "30px" }}>
                  <span style={lbStyle}>Oportunidades Abiertas</span>
                  <h2 style={{ fontSize: "2.2rem", color: theme.gold, margin: "10px 0 0 0", fontWeight: 400 }}>{oportunidadesAbiertas.length}</h2>
                </Card>
              </div>

              <Card style={{ padding: "35px", marginBottom: "40px" }}>
                <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase" }}>
                  Apertura de Oportunidad Comercial (SFA)
                </Heading>
                <form onSubmit={handleCrearOportunidad} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: "15px", alignItems: "end", marginTop: "20px" }}>
                  <div>
                    <label style={lbStyle}>Título de Oportunidad / Licitación</label>
                    <input type="text" placeholder="Ej: Contrato Anual Hub Panamá" value={nuevaOportunidad.titulo} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, titulo: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={lbStyle}>Embudo / Pipeline</label>
                    <select value={nuevaOportunidad.pipeline_tipo} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, pipeline_tipo: e.target.value })} style={inputStyle}>
                      <option value="B2B Licitación">B2B Licitación (Largo)</option>
                      <option value="B2C Rápido">B2C Ciclo Rápido</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbStyle}>Valor Estimado ($ USD)</label>
                    <input type="number" value={nuevaOportunidad.valor_estimado} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, valor_estimado: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={lbStyle}>Probabilidad Inicial (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={nuevaOportunidad.probabilidad}
                      onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, probabilidad: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={lbStyle}>Ejecutivo Asignado</label>
                    <input type="text" value={nuevaOportunidad.vendedor_asignado} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, vendedor_asignado: e.target.value })} style={inputStyle} />
                  </div>
                  <Button type="submit" style={{ height: "45px" }}>Registrar</Button>
                </form>
              </Card>

              <Card style={{ padding: "35px" }}>
                <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "20px" }}>
                  Seguimiento de Embudos de Venta
                </Heading>
                {oportunidades.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontStyle: "italic", textAlign: "center" }}>No hay oportunidades en el pipeline (o falta crear la tabla crm_opportunities — revisa la consola).</p>
                ) : (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Negocio</th>
                        <th style={thStyle}>Tipo Embudo</th>
                        <th style={thStyle}>Etapa Actual</th>
                        <th style={thStyle}>Valor ($)</th>
                        <th style={thStyle}>Probabilidad</th>
                        <th style={thStyle}>Ejecutivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oportunidades.map((o) => (
                        <tr key={o.id}>
                          <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600 }}>{o.titulo}</td>
                          <td style={tdStyle}>{o.pipeline_tipo}</td>
                          <td style={tdStyle}>
                            <select
                              value={o.etapa}
                              onChange={(e) => handleCambiarEtapa(o.id, e.target.value)}
                              style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: "0.75rem" }}
                            >
                              {ETAPAS_PIPELINE.map((etapa) => (
                                <option key={etapa} value={etapa}>{etapa}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ ...tdStyle, color: theme.gold, fontWeight: 600 }}>${Number(o.valor_estimado).toLocaleString()}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                defaultValue={o.probabilidad}
                                onBlur={(e) => {
                                  const nuevoValor = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                  if (nuevoValor !== o.probabilidad) handleCambiarProbabilidad(o.id, nuevoValor);
                                }}
                                style={{ ...inputStyle, width: "60px", padding: "6px", textAlign: "center", fontSize: "0.85rem" }}
                              />
                              <span>%</span>
                            </div>
                          </td>
                          <td style={tdStyle}>{o.vendedor_asignado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}

          {/* SECCIÓN 3: FICHA OPERATIVA */}
          {pestanaActiva === "actividades" && (
            <div>
              <Card style={{ padding: "35px", marginBottom: "30px" }}>
                <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "20px" }}>
                  Ficha Única Operativa (Bitácora Comercial)
                </Heading>
                <div style={{ maxWidth: "500px" }}>
                  <label style={lbStyle}>Seleccionar Cliente</label>
                  <select value={clienteSeleccionadoId} onChange={(e) => setClienteSeleccionadoId(e.target.value)} style={inputStyle}>
                    <option value="">— Elegí un cliente —</option>
                    {clientesReales.map((c) => (
                      <option key={c.id} value={c.id}>{c.razon_social || c.email}</option>
                    ))}
                  </select>
                </div>
              </Card>

              {clienteSeleccionadoId && (() => {
                const clienteActivo = clientesReales.find((c) => c.id === clienteSeleccionadoId);
                return (
                  <>
                    <Card style={{ padding: "30px", marginBottom: "30px" }}>
                      <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "15px" }}>Datos de la Cuenta</Heading>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "20px" }}>
                        <DataRow label="Representante" valor={clienteActivo?.nombre_representante || "—"} />
                        <DataRow label="Teléfono" valor={clienteActivo?.telefono_celular || "—"} />
                        <DataRow label="Email" valor={clienteActivo?.email || "—"} />
                        <DataRow label="Lista de Precio" valor={clienteActivo?.price_list || "—"} />
                      </div>
                    </Card>

                    <Card style={{ padding: "35px", marginBottom: "30px" }}>
                      <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "20px" }}>Registrar Contacto</Heading>
                      <form onSubmit={handleCrearActividad} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: "15px", alignItems: "end" }}>
                        <div>
                          <label style={lbStyle}>Tipo</label>
                          <select value={nuevaActividad.tipo} onChange={(e) => setNuevaActividad({ ...nuevaActividad, tipo: e.target.value })} style={inputStyle}>
                            <option value="Nota">Nota</option>
                            <option value="Llamada">Llamada</option>
                            <option value="Reunión">Reunión</option>
                            <option value="Email">Email</option>
                          </select>
                        </div>
                        <div>
                          <label style={lbStyle}>Registrado por</label>
                          <input type="text" placeholder="Tu nombre" value={nuevaActividad.autor} onChange={(e) => setNuevaActividad({ ...nuevaActividad, autor: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={lbStyle}>Descripción</label>
                          <input type="text" placeholder="Ej: Cliente pidió actualizar su plan..." value={nuevaActividad.descripcion} onChange={(e) => setNuevaActividad({ ...nuevaActividad, descripcion: e.target.value })} style={inputStyle} />
                        </div>
                        <Button type="submit" style={{ height: "45px" }}>Registrar</Button>
                      </form>
                    </Card>

                    <Card style={{ padding: "35px" }}>
                      <Heading style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "20px" }}>Historial de Contacto</Heading>
                      {cargandoActividades ? (
                        <p style={{ color: theme.textMuted, textAlign: "center" }}>Cargando...</p>
                      ) : actividades.length === 0 ? (
                        <p style={{ color: theme.textMuted, fontStyle: "italic", textAlign: "center" }}>Sin contactos registrados todavía para este cliente.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {actividades.map((a) => (
                            <div key={a.id} style={{ background: theme.inputBg, border: `1px solid ${theme.borderGoldLight}`, borderRadius: theme.radiusSm, padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
                              <div>
                                <Badge tone="gold">{a.tipo}</Badge>
                                <span style={{ color: theme.textLight, fontSize: "0.85rem", marginLeft: "10px" }}>{a.descripcion}</span>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ color: theme.textMuted, fontSize: "0.7rem" }}>{new Date(a.fecha_contacto).toLocaleString()}</div>
                                {a.autor && <div style={{ color: theme.textMuted, fontSize: "0.7rem" }}>por {a.autor}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </>
                );
              })()}
            </div>
          )}

          {/* SECCIÓN 4: CPQ & COTIZACIONES (portado de pages/admin/cotizaciones.tsx) */}
          {pestanaActiva === "cpq" && (
            <Card style={{ padding: "35px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase", margin: 0 }}>
                  Control de Cotizaciones (Tabla `quotes`)
                </Heading>
                <Badge tone="gold">TOTAL: {cotizacionesFiltradas.length}</Badge>
              </div>

              <input
                type="text"
                placeholder="Filtrar por referencia (QT-XXXX), tipo, razón social, representante, email o teléfono..."
                value={busquedaCotizaciones}
                onChange={(e) => setBusquedaCotizaciones(e.target.value)}
                style={{ ...inputStyle, maxWidth: "550px", width: "100%", boxSizing: "border-box", marginBottom: "20px" }}
              />

              {cotizacionesFiltradas.length === 0 ? (
                <p style={{ color: theme.textMuted, fontStyle: "italic", textAlign: "center" }}>No se encontraron cotizaciones registradas.</p>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Referencia / Fecha</th>
                      <th style={thStyle}>Cliente / Razón Social</th>
                      <th style={thStyle}>Contacto (Email / Tel)</th>
                      <th style={thStyle}>Tipo</th>
                      <th style={thStyle}>Total</th>
                      <th style={thStyle}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizacionesFiltradas.map((item: any) => {
                      const fechaFormateada = item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/D";
                      const totalVal = Number(item.total || 0).toFixed(2);
                      const referenciaStr = item.referencia || `QT-${item.id}`;
                      const tipoStr = item.tipo_solicitud || item.type || item.tipo || "N/D";
                      const { empresa, representante, email, telefono } = resolverDatosCliente(item);

                      return (
                        <tr key={item.id}>
                          <td style={{ ...tdStyle, textAlign: "left" }}>
                            <span style={{ color: theme.gold, fontWeight: 600 }}>{referenciaStr}</span>
                            <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "2px" }}>{fechaFormateada}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left" }}>
                            {empresa}
                            {representante !== "N/D" && representante && (
                              <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "2px" }}>Atn: {representante}</div>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left", fontSize: "0.85rem" }}>
                            <div style={{ color: theme.gold }}>{email}</div>
                            <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "2px" }}>{telefono}</div>
                          </td>
                          <td style={tdStyle}>
                            <Badge tone="gold">{tipoStr}</Badge>
                          </td>
                          <td style={{ ...tdStyle, color: theme.gold, fontWeight: 600 }}>${totalVal}</td>
                          <td style={tdStyle}>
                            <Button variant="outline-green" onClick={() => abrirDetalleCotizacion(item)}>
                              Ver Detalle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {/* MODAL DE DETALLE DE COTIZACIÓN */}
          {modalCotizacionAbierto && cotizacionSeleccionada && (
            <div style={overlayStyle}>
              <Card style={{ width: "90%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.borderGold}`, paddingBottom: "12px", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "1.2rem", color: theme.gold, letterSpacing: "1px", margin: 0 }}>
                    DETALLE: {cotizacionSeleccionada.referencia || `QT-${cotizacionSeleccionada.id}`}
                  </h2>
                  <Button variant="ghost" onClick={cerrarDetalleCotizacion} style={{ fontSize: "1.2rem", padding: "0 6px" }}>✕</Button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                  <DataRow label="Empresa / Razón Social" valor={cotizacionSeleccionada.empresaResuelto} />
                  <DataRow label="Representante / Atención" valor={cotizacionSeleccionada.representanteResuelto} />
                  <DataRow label="Correo Electrónico" valor={cotizacionSeleccionada.emailResuelto} />
                  <DataRow label="Teléfono" valor={cotizacionSeleccionada.telefonoResuelto} />
                  <DataRow label="Tipo de Solicitud" valor={cotizacionSeleccionada.tipo_solicitud || cotizacionSeleccionada.type || cotizacionSeleccionada.tipo || "N/D"} />
                  <DataRow label="Fecha de Emisión" valor={cotizacionSeleccionada.created_at ? new Date(cotizacionSeleccionada.created_at).toLocaleString() : "N/D"} />
                  <DataRow label="Estado" valor={<Badge tone={estadoToTone(cotizacionSeleccionada.status)}>{cotizacionSeleccionada.status || "pendiente"}</Badge>} />
                </div>

                {/* ESTADO DE PAGO — forma de pago acordada con el cliente + saldo pendiente */}
                <div style={{ marginBottom: "20px", background: theme.goldSoft, border: `1px dashed ${theme.borderGold}`, borderRadius: theme.radiusSm, padding: "15px 20px" }}>
                  <p style={{ fontSize: "0.75rem", color: theme.textMuted, textTransform: "uppercase", marginBottom: "6px" }}>Estado de Pago</p>
                  <p style={{ color: theme.textLight, fontSize: "0.85rem", margin: "0 0 10px 0", lineHeight: "1.5" }}>
                    <strong style={{ color: theme.gold }}>Forma de pago acordada: </strong>
                    {descripcionFormaPago(cotizacionSeleccionada.formaPagoCliente, cotizacionSeleccionada.porcentajePagoCliente)}
                  </p>
                  {(() => {
                    const total = Number(cotizacionSeleccionada.total || 0);
                    const abonado = Number(cotizacionSeleccionada.monto_abono || 0);
                    const falta = Math.max(0, total - abonado);
                    return (
                      <div style={{ display: "flex", gap: "25px", fontSize: "0.85rem" }}>
                        <span>Abonado: <strong style={{ color: theme.green }}>${abonado.toFixed(2)}</strong></span>
                        <span>Total: <strong style={{ color: theme.textLight }}>${total.toFixed(2)}</strong></span>
                        <span>Falta: <strong style={{ color: falta > 0 ? theme.red : theme.green }}>${falta.toFixed(2)}</strong></span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "0.75rem", color: theme.textMuted, textTransform: "uppercase", marginBottom: "8px" }}>Ítems / Contenido de la Cotización:</p>
                  <div style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.borderGoldLight}`, borderRadius: theme.radiusSm, maxHeight: "180px", overflowY: "auto" }}>
                    {(() => {
                      const itemsList = parseJSON(cotizacionSeleccionada.items) || parseJSON(cotizacionSeleccionada.productos) || parseJSON(cotizacionSeleccionada.details);
                      if (Array.isArray(itemsList) && itemsList.length > 0) {
                        return (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${theme.borderGold}`, color: theme.gold, backgroundColor: theme.background }}>
                                <th style={{ padding: "10px 14px" }}>SKU / Ref</th>
                                <th style={{ padding: "10px 14px" }}>Descripción</th>
                                <th style={{ padding: "10px 14px", textAlign: "center" }}>Cant.</th>
                                <th style={{ padding: "10px 14px", textAlign: "right" }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsList.map((prod: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: `1px solid ${theme.borderGoldLight}` }}>
                                  <td style={{ padding: "10px 14px", color: theme.gold, fontWeight: 600 }}>{prod.SKU || prod.sku || prod.codigo || "N/D"}</td>
                                  <td style={{ padding: "10px 14px", color: theme.textLight }}>{prod.Descripción || prod.descripcion || prod.description || prod.nombre || "Sin descripción"}</td>
                                  <td style={{ padding: "10px 14px", textAlign: "center", color: theme.textMuted }}>{prod.cantidad || prod.quantity || 1}</td>
                                  <td style={{ padding: "10px 14px", textAlign: "right", color: theme.textLight, fontWeight: 600 }}>
                                    ${Number(prod.total || (Number(prod.precioUnitario || prod.precio || 0) * Number(prod.cantidad || 1)) || prod.subtotal || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      } else if (typeof itemsList === "object" && itemsList !== null && Object.keys(itemsList).length > 0) {
                        return (
                          <div style={{ padding: "12px", color: theme.textLight, fontSize: "0.85rem" }}>
                            <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: theme.gold }}>SKU / Ref:</strong> {itemsList.SKU || itemsList.sku || "N/D"}</p>
                            <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: theme.gold }}>Descripción:</strong> {itemsList.Descripción || itemsList.descripcion || itemsList.description || itemsList.nombre || "N/D"}</p>
                            <p style={{ margin: 0 }}><strong style={{ color: theme.gold }}>Total:</strong> ${Number(itemsList.total || itemsList.precioUnitario || itemsList.precio || 0).toFixed(2)}</p>
                          </div>
                        );
                      } else {
                        return <p style={{ color: theme.textMuted, fontStyle: "italic", padding: "12px", margin: 0 }}>No hay ítems detallados guardados en esta cotización.</p>;
                      }
                    })()}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.borderGold}`, paddingTop: "15px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", color: theme.textMuted }}>Total General: </span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: theme.textLight }}>${Number(cotizacionSeleccionada.total || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {cargandoPdf ? (
                      <span style={{ fontSize: "0.8rem", color: theme.gold, fontStyle: "italic" }}>Buscando documento...</span>
                    ) : cotizacionSeleccionada.pdf_url_final ? (
                      <a href={cotizacionSeleccionada.pdf_url_final} target="_blank" rel="noopener noreferrer" style={goldLinkStyle}>
                        VER DOCUMENTO QT (PDF)
                      </a>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Archivo no encontrado en bucket</span>
                    )}
                    <Button variant="outline-gold" onClick={cerrarDetalleCotizacion}>CERRAR</Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* SECCIÓN 5: AUDITORÍA & MÉTRICAS (conectado a Supabase: crm_prospectos, crm_opportunities, quotes, audit_log) */}
          {pestanaActiva === "gobierno" && (
            <div>
              {cargandoGobierno && !metricas ? (
                <Card style={{ padding: "35px", textAlign: "center" }}>
                  <p style={{ color: theme.textMuted }}>Calculando métricas...</p>
                </Card>
              ) : (
                <>
                  {/* Tarjetas de métricas de ventas */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "30px" }}>
                    <Card style={{ padding: "25px" }}>
                      <span style={lbStyle}>Win Rate (Ganadas vs Cerradas)</span>
                      <h2 style={{ fontSize: "1.9rem", color: theme.green, margin: "10px 0 0 0", fontWeight: 400 }}>
                        {metricas && (metricas.oportunidadesGanadas + metricas.oportunidadesPerdidas) > 0
                          ? `${((metricas.oportunidadesGanadas / (metricas.oportunidadesGanadas + metricas.oportunidadesPerdidas)) * 100).toFixed(0)}%`
                          : "N/D"}
                      </h2>
                      <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                        {metricas?.oportunidadesGanadas || 0} ganadas / {metricas?.oportunidadesPerdidas || 0} perdidas
                      </span>
                    </Card>
                    <Card style={{ padding: "25px" }}>
                      <span style={lbStyle}>Valor Total Ganado</span>
                      <h2 style={{ fontSize: "1.9rem", color: theme.gold, margin: "10px 0 0 0", fontWeight: 400 }}>${(metricas?.valorGanado || 0).toLocaleString()}</h2>
                    </Card>
                    <Card style={{ padding: "25px" }}>
                      <span style={lbStyle}>Conversión de Prospectos</span>
                      <h2 style={{ fontSize: "1.9rem", color: theme.textLight, margin: "10px 0 0 0", fontWeight: 400 }}>
                        {metricas && metricas.prospectosTotalHistorico > 0
                          ? `${((metricas.prospectosConvertidos / metricas.prospectosTotalHistorico) * 100).toFixed(0)}%`
                          : "N/D"}
                      </h2>
                      <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                        {metricas?.prospectosConvertidos || 0} de {metricas?.prospectosTotalHistorico || 0} prospectos
                      </span>
                    </Card>
                    <Card style={{ padding: "25px" }}>
                      <span style={lbStyle}>Cotizaciones — Cobrado / Total</span>
                      <h2 style={{ fontSize: "1.6rem", color: theme.textLight, margin: "10px 0 0 0", fontWeight: 400 }}>
                        ${(metricas?.cotizacionesAbonadoTotal || 0).toLocaleString()} <span style={{ color: theme.textMuted, fontSize: "1rem" }}>/ ${(metricas?.cotizacionesValorTotal || 0).toLocaleString()}</span>
                      </h2>
                      <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>{metricas?.cotizacionesTotal || 0} cotizaciones registradas</span>
                    </Card>
                  </div>

                  {/* Bitácora de auditoría */}
                  <Card style={{ padding: "35px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <Heading style={{ fontSize: "1.1rem", textTransform: "uppercase", margin: 0 }}>
                        Bitácora de Auditoría (Últimos 20 movimientos)
                      </Heading>
                      <Button variant="outline-gold" onClick={fetchMetricasYAuditoria} style={{ padding: "8px 16px", fontSize: "0.7rem" }}>
                        ↻ Actualizar
                      </Button>
                    </div>

                    {bitacoraAuditoria.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px" }}>
                        <p style={{ color: theme.textMuted, fontStyle: "italic", marginBottom: "8px" }}>
                          Todavía no hay movimientos registrados en la bitácora de auditoría.
                        </p>
                        <p style={{ color: theme.textMuted, fontSize: "0.75rem" }}>
                          Si esperabas ver datos aquí, revisa que la tabla <code>audit_log</code> exista en Supabase (ver instrucciones SQL entregadas).
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {bitacoraAuditoria.map((entrada) => (
                          <div key={entrada.id} style={{ background: theme.inputBg, border: `1px solid ${theme.borderGoldLight}`, borderRadius: theme.radiusSm, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
                            <div>
                              <Badge tone="gold">{entrada.entidad}</Badge>
                              <span style={{ color: theme.textLight, fontSize: "0.85rem", marginLeft: "10px" }}>{entrada.detalle || entrada.accion}</span>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ color: theme.textMuted, fontSize: "0.7rem" }}>{new Date(entrada.created_at).toLocaleString()}</div>
                              {entrada.autor && <div style={{ color: theme.textMuted, fontSize: "0.7rem" }}>por {entrada.autor}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Nota de gobernanza (informativa) */}
                  <Card style={{ padding: "25px", marginTop: "30px" }}>
                    <Heading style={{ fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "10px" }}>Control de Permisos RLS</Heading>
                    <p style={{ color: theme.textMuted, fontSize: "0.8rem", margin: 0, lineHeight: "1.5" }}>
                      Aislamiento seguro por perfiles de cuenta (ISP, Mayorista, Integrador) y visibilidad gerencial global.
                    </p>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>

        {/* MODAL DE CONVERSIÓN A CLIENTE REAL */}
        {modalConversion.isOpen && modalConversion.prospecto && (
          <div style={overlayStyle}>
            <Card style={{ width: "100%", maxWidth: "500px", marginBottom: 0, border: `1px solid ${theme.greenBorder}` }}>
              <h2 style={{ color: theme.green, marginTop: 0, fontSize: "1.2rem", letterSpacing: "1px" }}>
                CONVERTIR A CLIENTE REAL
              </h2>
              <p style={{ fontSize: "0.9rem", color: theme.textMuted, marginBottom: "20px" }}>
                Esto va a crear a <strong style={{ color: theme.gold }}>{modalConversion.prospecto.razon_social}</strong> como cliente activo en el portal y le va a enviar el correo para crear su contraseña. Definí la forma de pago acordada:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "15px" }}>
                <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>FORMA DE PAGO:</label>
                <select value={tipoPagoConversion} onChange={(e) => setTipoPagoConversion(e.target.value)} style={inputStyle}>
                  <option value="50%">50% Anticipo / 50% antes despacho (3 días antes)</option>
                  <option value="100%">100% a la Orden de Compra</option>
                  <option value="ESPECIAL">ESPECIAL (Negociación Interna)</option>
                </select>
              </div>

              {tipoPagoConversion === "ESPECIAL" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: theme.goldSoft, padding: "10px", borderRadius: theme.radiusSm, border: `1px dashed ${theme.borderGold}`, marginBottom: "15px" }}>
                  <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>% A LA ORDEN:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={porcentajeEspecial}
                    onChange={(e) => setPorcentajeEspecial(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    style={{ ...inputStyle, width: "80px", textAlign: "center", fontWeight: 700 }}
                  />
                  <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Saldo: <strong style={{ color: theme.green }}>{100 - porcentajeEspecial}%</strong></span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <Button variant="ghost" onClick={cerrarModalConversion} disabled={convirtiendo}>
                  CANCELAR
                </Button>
                <Button variant="outline-green" onClick={confirmarConversion} disabled={convirtiendo}>
                  {convirtiendo ? "CONVIRTIENDO..." : "CONFIRMAR CONVERSIÓN"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
