import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

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

  useEffect(() => {
    fetchCRMData();
  }, []);

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

  return (
    <div style={{ display: "flex", backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", fontFamily: "sans-serif", boxSizing: "border-box" }}>
      {/* SIDEBAR FIJO — ya incluye "Volver al Portal" y "Cerrar Sesión" */}
      <Sidebar currentActive="crm" />

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, padding: "50px 30px", boxSizing: "border-box", overflowX: "auto" }}>
        <style jsx global>{`
          html, body {
            margin: 0;
            padding: 0;
            background-color: #000 !important;
            color: #DAA520;
          }
          .card-enterprise {
            background-color: #080808;
            border: 1px solid rgba(218, 165, 32, 0.35);
            border-radius: 14px;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9);
          }
          .card-enterprise:hover {
            border-color: #DAA520;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 1), 0 0 25px rgba(218, 165, 32, 0.25);
            transform: translateY(-3px);
          }
          .custom-btn {
            background-color: transparent;
            color: #DAA520;
            border: 1px solid rgba(218, 165, 32, 0.5);
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.8rem;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .custom-btn:hover, .custom-btn.active {
            background-color: #DAA520 !important;
            color: #000 !important;
            box-shadow: 0 0 20px rgba(218, 165, 32, 0.5);
          }
          .gold-btn {
            background-color: #DAA520;
            color: #000;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 0.85rem;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .gold-btn:hover {
            background-color: #f1c40f;
            box-shadow: 0 0 25px rgba(218, 165, 32, 0.6);
          }
          .convertir-btn {
            background-color: transparent;
            color: #2ecc71;
            border: 1px solid rgba(46, 204, 113, 0.5);
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .convertir-btn:hover {
            background-color: rgba(46, 204, 113, 0.15);
          }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid rgba(218, 165, 32, 0.25); padding: 14px; text-align: center; color: #FFF; font-size: 0.9rem; }
          th { background-color: #0a0a0a; color: #DAA520; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1.5px; }
          input, select { background-color: #050505; color: #DAA520; border: 1px solid rgba(218, 165, 32, 0.4); padding: 12px; border-radius: 8px; outline: none; width: 100%; font-size: 0.9rem; }
        `}</style>

        {/* Navegación Superior — pestañas únicamente, sin botón duplicado de "Volver" */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "40px", maxWidth: "1350px", margin: "0 auto 40px auto" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={() => setPestanaActiva("clientes")} className={`custom-btn ${pestanaActiva === "clientes" ? "active" : ""}`}>
              🏢 Clientes & Cuentas
            </button>
            <button onClick={() => setPestanaActiva("pipeline")} className={`custom-btn ${pestanaActiva === "pipeline" ? "active" : ""}`}>
              📈 Pipeline & Forecast
            </button>
            <button onClick={() => setPestanaActiva("actividades")} className={`custom-btn ${pestanaActiva === "actividades" ? "active" : ""}`}>
              📞 Ficha Operativa
            </button>
            <button onClick={() => setPestanaActiva("cpq")} className={`custom-btn ${pestanaActiva === "cpq" ? "active" : ""}`}>
              📑 CPQ & Cotizaciones
            </button>
            <button onClick={() => setPestanaActiva("gobierno")} className={`custom-btn ${pestanaActiva === "gobierno" ? "active" : ""}`}>
              🛡️ Auditoría & Métricas
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "45px" }}>
          <h1 style={{ color: "#DAA520", fontSize: "1.8rem", fontWeight: "300", letterSpacing: "3px", textTransform: "uppercase", margin: 0 }}>
            ENTERPRISE PURE CRM SUITE
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", letterSpacing: "1px", marginTop: "8px" }}>
            SISTEMA GLOBAL DE GESTIÓN COMERCIAL • TRULINK FIBER LLC
          </p>
        </div>

        <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
          {/* SECCIÓN 1: PROSPECTOS (antes "clientes", ahora tabla separada crm_prospectos) */}
          {pestanaActiva === "clientes" && (
            <div>
              <div className="card-enterprise" style={{ padding: "35px", marginBottom: "40px" }}>
                <h3 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0 }}>
                  Registro de Prospecto Comercial
                </h3>
                <form onSubmit={handleCrearProspecto} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", alignItems: "end", marginTop: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Empresa / Prospecto</label>
                    <input type="text" placeholder="Ej: IGTEL Honduras" value={nuevoProspecto.razon_social} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, razon_social: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Email de Contacto</label>
                    <input type="email" placeholder="contacto@empresa.com" value={nuevoProspecto.email} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, email: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Teléfono Celular</label>
                    <input type="text" placeholder="Ej: 66403720" value={nuevoProspecto.telefono_celular} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, telefono_celular: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Perfil de Cliente</label>
                    <select value={nuevoProspecto.perfil_cliente} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, perfil_cliente: e.target.value })}>
                      <option value="ISP">ISP</option>
                      <option value="MAYORISTA">MAYORISTA</option>
                      <option value="INTEGRADOR">INTEGRADOR</option>
                      <option value="CLIENTE FINAL">CLIENTE FINAL</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Industria</label>
                    <input type="text" value={nuevoProspecto.industria} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, industria: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>País / Región</label>
                    <input type="text" value={nuevoProspecto.pais} onChange={(e) => setNuevoProspecto({ ...nuevoProspecto, pais: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <button type="submit" className="gold-btn" style={{ height: "45px", width: "100%" }}>Guardar Prospecto</button>
                  </div>
                </form>
              </div>

              <div className="card-enterprise" style={{ padding: "35px" }}>
                <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                  Directorio de Prospectos (Pendientes de Cerrar Venta)
                </h2>
                {loading ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Cargando...</p>
                ) : prospectos.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay prospectos registrados.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Empresa</th>
                        <th>Email</th>
                        <th>Perfil</th>
                        <th>Industria</th>
                        <th>País</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospectos.map((p) => (
                        <tr key={p.id}>
                          <td style={{ color: "rgba(255,255,255,0.5)" }}>#{p.id}</td>
                          <td style={{ textAlign: "left", fontWeight: "600" }}>{p.razon_social}</td>
                          <td style={{ fontSize: "0.8rem" }}>{p.email}</td>
                          <td><span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "0.7rem", background: "rgba(218,165,32,0.15)", color: "#DAA520", border: "1px solid rgba(218,165,32,0.3)" }}>{p.perfil_cliente}</span></td>
                          <td>{p.industria}</td>
                          <td>{p.pais}</td>
                          <td>
                            <button className="convertir-btn" onClick={() => abrirModalConversion(p)}>
                              ✓ Convertir a Cliente
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* SECCIÓN 2: PIPELINE & FORECASTING (sin cambios de lógica) */}
          {pestanaActiva === "pipeline" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "25px", marginBottom: "40px" }}>
                <div className="card-enterprise" style={{ padding: "30px" }}>
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Valor Total en Pipeline</span>
                  <h2 style={{ fontSize: "2.2rem", color: "#FFF", margin: "10px 0 0 0", fontWeight: "400" }}>${pipelineValorTotal.toLocaleString()}</h2>
                </div>
                <div className="card-enterprise" style={{ padding: "30px" }}>
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Forecast Ponderado (Ingresos)</span>
                  <h2 style={{ fontSize: "2.2rem", color: "#DAA520", margin: "10px 0 0 0", fontWeight: "400" }}>${forecastTotal.toLocaleString()}</h2>
                </div>
                <div className="card-enterprise" style={{ padding: "30px" }}>
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Oportunidades Abiertas</span>
                  <h2 style={{ fontSize: "2.2rem", color: "#DAA520", margin: "10px 0 0 0", fontWeight: "400" }}>{oportunidadesAbiertas.length}</h2>
                </div>
              </div>

              <div className="card-enterprise" style={{ padding: "35px", marginBottom: "40px" }}>
                <h3 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0 }}>
                  Apertura de Oportunidad Comercial (SFA)
                </h3>
                <form onSubmit={handleCrearOportunidad} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: "15px", alignItems: "end", marginTop: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Título de Oportunidad / Licitación</label>
                    <input type="text" placeholder="Ej: Contrato Anual Hub Panamá" value={nuevaOportunidad.titulo} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, titulo: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Embudo / Pipeline</label>
                    <select value={nuevaOportunidad.pipeline_tipo} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, pipeline_tipo: e.target.value })}>
                      <option value="B2B Licitación">B2B Licitación (Largo)</option>
                      <option value="B2C Rápido">B2C Ciclo Rápido</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Valor Estimado ($ USD)</label>
                    <input type="number" value={nuevaOportunidad.valor_estimado} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, valor_estimado: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Probabilidad Inicial (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={nuevaOportunidad.probabilidad}
                      onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, probabilidad: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Ejecutivo Asignado</label>
                    <input type="text" value={nuevaOportunidad.vendedor_asignado} onChange={(e) => setNuevaOportunidad({ ...nuevaOportunidad, vendedor_asignado: e.target.value })} />
                  </div>
                  <button type="submit" className="gold-btn" style={{ height: "45px" }}>Registrar</button>
                </form>
              </div>

              <div className="card-enterprise" style={{ padding: "35px" }}>
                <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                  Seguimiento de Embudos de Venta
                </h2>
                {oportunidades.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay oportunidades en el pipeline (o falta crear la tabla crm_opportunities — revisa la consola).</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Negocio</th>
                        <th>Tipo Embudo</th>
                        <th>Etapa Actual</th>
                        <th>Valor ($)</th>
                        <th>Probabilidad</th>
                        <th>Ejecutivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oportunidades.map((o) => (
                        <tr key={o.id}>
                          <td style={{ textAlign: "left", fontWeight: "600" }}>{o.titulo}</td>
                          <td>{o.pipeline_tipo}</td>
                          <td>
                            <select
                              value={o.etapa}
                              onChange={(e) => handleCambiarEtapa(o.id, e.target.value)}
                              style={{ width: "auto", padding: "6px 10px", fontSize: "0.75rem" }}
                            >
                              {ETAPAS_PIPELINE.map((etapa) => (
                                <option key={etapa} value={etapa}>{etapa}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ color: "#DAA520", fontWeight: "600" }}>${Number(o.valor_estimado).toLocaleString()}</td>
                          <td>
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
                                style={{ width: "60px", padding: "6px", textAlign: "center", fontSize: "0.85rem" }}
                              />
                              <span>%</span>
                            </div>
                          </td>
                          <td>{o.vendedor_asignado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* SECCIÓN 3: FICHA OPERATIVA */}
          {pestanaActiva === "actividades" && (
            <div>
              <div className="card-enterprise" style={{ padding: "35px", marginBottom: "30px" }}>
                <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                  Ficha Única Operativa (Bitácora Comercial)
                </h2>
                <div style={{ maxWidth: "500px" }}>
                  <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Seleccionar Cliente</label>
                  <select value={clienteSeleccionadoId} onChange={(e) => setClienteSeleccionadoId(e.target.value)}>
                    <option value="">— Elegí un cliente —</option>
                    {clientesReales.map((c) => (
                      <option key={c.id} value={c.id}>{c.razon_social || c.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              {clienteSeleccionadoId && (() => {
                const clienteActivo = clientesReales.find((c) => c.id === clienteSeleccionadoId);
                return (
                  <>
                    <div className="card-enterprise" style={{ padding: "30px", marginBottom: "30px" }}>
                      <h3 style={{ color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", marginTop: 0, marginBottom: "15px" }}>Datos de la Cuenta</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "20px", fontSize: "0.85rem" }}>
                        <div><span style={{ color: "rgba(255,255,255,0.5)" }}>Representante</span><br /><strong style={{ color: "#FFF" }}>{clienteActivo?.nombre_representante || "—"}</strong></div>
                        <div><span style={{ color: "rgba(255,255,255,0.5)" }}>Teléfono</span><br /><strong style={{ color: "#FFF" }}>{clienteActivo?.telefono_celular || "—"}</strong></div>
                        <div><span style={{ color: "rgba(255,255,255,0.5)" }}>Email</span><br /><strong style={{ color: "#FFF" }}>{clienteActivo?.email || "—"}</strong></div>
                        <div><span style={{ color: "rgba(255,255,255,0.5)" }}>Lista de Precio</span><br /><strong style={{ color: "#DAA520" }}>{clienteActivo?.price_list || "—"}</strong></div>
                      </div>
                    </div>

                    <div className="card-enterprise" style={{ padding: "35px", marginBottom: "30px" }}>
                      <h3 style={{ color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>Registrar Contacto</h3>
                      <form onSubmit={handleCrearActividad} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: "15px", alignItems: "end" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Tipo</label>
                          <select value={nuevaActividad.tipo} onChange={(e) => setNuevaActividad({ ...nuevaActividad, tipo: e.target.value })}>
                            <option value="Nota">Nota</option>
                            <option value="Llamada">Llamada</option>
                            <option value="Reunión">Reunión</option>
                            <option value="Email">Email</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Registrado por</label>
                          <input type="text" placeholder="Tu nombre" value={nuevaActividad.autor} onChange={(e) => setNuevaActividad({ ...nuevaActividad, autor: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Descripción</label>
                          <input type="text" placeholder="Ej: Cliente pidió actualizar su plan..." value={nuevaActividad.descripcion} onChange={(e) => setNuevaActividad({ ...nuevaActividad, descripcion: e.target.value })} />
                        </div>
                        <button type="submit" className="gold-btn" style={{ height: "45px" }}>Registrar</button>
                      </form>
                    </div>

                    <div className="card-enterprise" style={{ padding: "35px" }}>
                      <h3 style={{ color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>Historial de Contacto</h3>
                      {cargandoActividades ? (
                        <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Cargando...</p>
                      ) : actividades.length === 0 ? (
                        <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>Sin contactos registrados todavía para este cliente.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {actividades.map((a) => (
                            <div key={a.id} style={{ background: "#050505", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
                              <div>
                                <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.65rem", background: "rgba(218,165,32,0.15)", color: "#DAA520", border: "1px solid rgba(218,165,32,0.3)", marginRight: "10px" }}>{a.tipo}</span>
                                <span style={{ color: "#FFF", fontSize: "0.85rem" }}>{a.descripcion}</span>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem" }}>{new Date(a.fecha_contacto).toLocaleString()}</div>
                                {a.autor && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>por {a.autor}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* SECCIÓN 4: CPQ & COTIZACIONES (portado de pages/admin/cotizaciones.tsx) */}
          {pestanaActiva === "cpq" && (
            <div className="card-enterprise" style={{ padding: "35px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", margin: 0 }}>
                  Control de Cotizaciones (Tabla `quotes`)
                </h2>
                <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "8px 16px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.8rem" }}>
                  TOTAL: {cotizacionesFiltradas.length}
                </div>
              </div>

              <input
                type="text"
                placeholder="Filtrar por referencia (QT-XXXX), tipo, razón social, representante, email o teléfono..."
                value={busquedaCotizaciones}
                onChange={(e) => setBusquedaCotizaciones(e.target.value)}
                style={{ maxWidth: "550px", marginBottom: "20px" }}
              />

              {cotizacionesFiltradas.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No se encontraron cotizaciones registradas.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Referencia / Fecha</th>
                      <th>Cliente / Razón Social</th>
                      <th>Contacto (Email / Tel)</th>
                      <th>Tipo</th>
                      <th>Total</th>
                      <th>Acción</th>
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
                          <td style={{ textAlign: "left" }}>
                            <span style={{ color: "#DAA520", fontWeight: "600" }}>{referenciaStr}</span>
                            <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{fechaFormateada}</div>
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {empresa}
                            {representante !== "N/D" && representante && (
                              <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>Atn: {representante}</div>
                            )}
                          </td>
                          <td style={{ textAlign: "left", fontSize: "0.85rem" }}>
                            <div style={{ color: "#DAA520" }}>{email}</div>
                            <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{telefono}</div>
                          </td>
                          <td>
                            <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", border: "1px solid rgba(218,165,32,0.3)", background: "rgba(218,165,32,0.08)", color: "#DAA520", fontWeight: "600" }}>
                              {tipoStr}
                            </span>
                          </td>
                          <td style={{ color: "#DAA520", fontWeight: "600" }}>${totalVal}</td>
                          <td>
                            <button className="convertir-btn" onClick={() => abrirDetalleCotizacion(item)}>
                              Ver Detalle
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* MODAL DE DETALLE DE COTIZACIÓN */}
          {modalCotizacionAbierto && cotizacionSeleccionada && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
              <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "12px", padding: "30px", width: "90%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "12px", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "1.2rem", color: "#DAA520", letterSpacing: "1px", margin: 0 }}>
                    DETALLE: {cotizacionSeleccionada.referencia || `QT-${cotizacionSeleccionada.id}`}
                  </h2>
                  <button onClick={cerrarDetalleCotizacion} style={{ background: "transparent", border: "none", color: "#DAA520", fontSize: "1.2rem", cursor: "pointer", fontWeight: "bold" }}>✕</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px", fontSize: "0.9rem" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Empresa / Razón Social:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.empresaResuelto}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Representante / Atención:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.representanteResuelto}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Correo Electrónico:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.emailResuelto}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Teléfono:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.telefonoResuelto}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Tipo de Solicitud:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.tipo_solicitud || cotizacionSeleccionada.type || cotizacionSeleccionada.tipo || "N/D"}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Fecha de Emisión:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.created_at ? new Date(cotizacionSeleccionada.created_at).toLocaleString() : "N/D"}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Estado:</p>
                    <p style={{ color: "#fff", margin: 0, fontWeight: 500 }}>{cotizacionSeleccionada.status || "pendiente"}</p>
                  </div>
                </div>

                {/* ESTADO DE PAGO — forma de pago acordada con el cliente + saldo pendiente */}
                <div style={{ marginBottom: "20px", background: "rgba(218, 165, 32, 0.05)", border: "1px dashed rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "15px 20px" }}>
                  <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>Estado de Pago</p>
                  <p style={{ color: "#fff", fontSize: "0.85rem", margin: "0 0 10px 0", lineHeight: "1.5" }}>
                    <strong style={{ color: "#DAA520" }}>Forma de pago acordada: </strong>
                    {descripcionFormaPago(cotizacionSeleccionada.formaPagoCliente, cotizacionSeleccionada.porcentajePagoCliente)}
                  </p>
                  {(() => {
                    const total = Number(cotizacionSeleccionada.total || 0);
                    const abonado = Number(cotizacionSeleccionada.monto_abono || 0);
                    const falta = Math.max(0, total - abonado);
                    return (
                      <div style={{ display: "flex", gap: "25px", fontSize: "0.85rem" }}>
                        <span>Abonado: <strong style={{ color: "#2ecc71" }}>${abonado.toFixed(2)}</strong></span>
                        <span>Total: <strong style={{ color: "#fff" }}>${total.toFixed(2)}</strong></span>
                        <span>Falta: <strong style={{ color: falta > 0 ? "#e74c3c" : "#2ecc71" }}>${falta.toFixed(2)}</strong></span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "8px" }}>Ítems / Contenido de la Cotización:</p>
                  <div style={{ backgroundColor: "#0b0b0b", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px", maxHeight: "180px", overflowY: "auto" }}>
                    {(() => {
                      const itemsList = parseJSON(cotizacionSeleccionada.items) || parseJSON(cotizacionSeleccionada.productos) || parseJSON(cotizacionSeleccionada.details);
                      if (Array.isArray(itemsList) && itemsList.length > 0) {
                        return (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#141414" }}>
                                <th style={{ padding: "10px 14px" }}>SKU / Ref</th>
                                <th style={{ padding: "10px 14px" }}>Descripción</th>
                                <th style={{ padding: "10px 14px", textAlign: "center" }}>Cant.</th>
                                <th style={{ padding: "10px 14px", textAlign: "right" }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsList.map((prod: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #161616" }}>
                                  <td style={{ padding: "10px 14px", color: "#DAA520", fontWeight: "600" }}>{prod.SKU || prod.sku || prod.codigo || "N/D"}</td>
                                  <td style={{ padding: "10px 14px", color: "#fff" }}>{prod.Descripción || prod.descripcion || prod.description || prod.nombre || "Sin descripción"}</td>
                                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#ccc" }}>{prod.cantidad || prod.quantity || 1}</td>
                                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#fff", fontWeight: "600" }}>
                                    ${Number(prod.total || (Number(prod.precioUnitario || prod.precio || 0) * Number(prod.cantidad || 1)) || prod.subtotal || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      } else if (typeof itemsList === "object" && itemsList !== null && Object.keys(itemsList).length > 0) {
                        return (
                          <div style={{ padding: "12px", color: "#fff", fontSize: "0.85rem" }}>
                            <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#DAA520" }}>SKU / Ref:</strong> {itemsList.SKU || itemsList.sku || "N/D"}</p>
                            <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#DAA520" }}>Descripción:</strong> {itemsList.Descripción || itemsList.descripcion || itemsList.description || itemsList.nombre || "N/D"}</p>
                            <p style={{ margin: 0 }}><strong style={{ color: "#DAA520" }}>Total:</strong> ${Number(itemsList.total || itemsList.precioUnitario || itemsList.precio || 0).toFixed(2)}</p>
                          </div>
                        );
                      } else {
                        return <p style={{ color: "#666", fontStyle: "italic", padding: "12px", margin: 0 }}>No hay ítems detallados guardados en esta cotización.</p>;
                      }
                    })()}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(218, 165, 32, 0.3)", paddingTop: "15px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", color: "#888" }}>Total General: </span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>${Number(cotizacionSeleccionada.total || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {cargandoPdf ? (
                      <span style={{ fontSize: "0.8rem", color: "#DAA520", fontStyle: "italic" }}>Buscando documento...</span>
                    ) : cotizacionSeleccionada.pdf_url_final ? (
                      <a href={cotizacionSeleccionada.pdf_url_final} target="_blank" rel="noopener noreferrer" className="gold-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                        VER DOCUMENTO QT (PDF)
                      </a>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>Archivo no encontrado en bucket</span>
                    )}
                    <button onClick={cerrarDetalleCotizacion} className="custom-btn">CERRAR</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 5: AUDITORÍA & GOBERNANZA (decorativo, sin cambios) */}
          {pestanaActiva === "gobierno" && (
            <div className="card-enterprise" style={{ padding: "35px" }}>
              <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                Auditoría, Gobernanza y Métricas Comerciales
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginTop: "20px" }}>
                <div style={{ background: "#050505", padding: "25px", borderRadius: "10px", border: "1px solid rgba(218,165,32,0.2)" }}>
                  <h4 style={{ color: "#DAA520", margin: "0 0 10px 0", fontSize: "0.9rem", textTransform: "uppercase" }}>Control de Permisos RLS</h4>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", margin: 0, lineHeight: "1.5" }}>
                    Aislamiento seguro por perfiles de cuenta (ISP, Mayorista, Integrador) y visibilidad gerencial global.
                  </p>
                </div>
                <div style={{ background: "#050505", padding: "25px", borderRadius: "10px", border: "1px solid rgba(218,165,32,0.2)" }}>
                  <h4 style={{ color: "#DAA520", margin: "0 0 10px 0", fontSize: "0.9rem", textTransform: "uppercase" }}>Métricas de Rendimiento (Win Rate)</h4>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", margin: 0, lineHeight: "1.5" }}>
                    Monitoreo de tiempos de respuesta por tomador de decisiones y cumplimiento de cuotas comerciales.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL DE CONVERSIÓN A CLIENTE REAL */}
      {modalConversion.isOpen && modalConversion.prospecto && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#111111", border: "1px solid rgba(46, 204, 113, 0.5)", borderRadius: "12px", padding: "30px", width: "100%", maxWidth: "500px", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
            <h2 style={{ color: "#2ecc71", marginTop: 0, fontSize: "1.2rem", letterSpacing: "1px" }}>
              CONVERTIR A CLIENTE REAL
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#CCC", marginBottom: "20px" }}>
              Esto va a crear a <strong style={{ color: "#DAA520" }}>{modalConversion.prospecto.razon_social}</strong> como cliente activo en el portal y le va a enviar el correo para crear su contraseña. Definí la forma de pago acordada:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "15px" }}>
              <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>FORMA DE PAGO:</label>
              <select value={tipoPagoConversion} onChange={(e) => setTipoPagoConversion(e.target.value)} style={{ background: "#1a1a1a", color: "#E0E0E0", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "6px", padding: "10px" }}>
                <option value="50%">50% Anticipo / 50% antes despacho (3 días antes)</option>
                <option value="100%">100% a la Orden de Compra</option>
                <option value="ESPECIAL">ESPECIAL (Negociación Interna)</option>
              </select>
            </div>

            {tipoPagoConversion === "ESPECIAL" && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(218, 165, 32, 0.05)", padding: "10px", borderRadius: "6px", border: "1px dashed rgba(218, 165, 32, 0.4)", marginBottom: "15px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>% A LA ORDEN:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={porcentajeEspecial}
                  onChange={(e) => setPorcentajeEspecial(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                  style={{ background: "#000", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "4px", padding: "6px 10px", width: "80px", textAlign: "center", fontWeight: "700" }}
                />
                <span style={{ fontSize: "0.8rem", color: "#AAA" }}>Saldo: <strong style={{ color: "#2ecc71" }}>{100 - porcentajeEspecial}%</strong></span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={cerrarModalConversion}
                disabled={convirtiendo}
                style={{ padding: "11px 22px", cursor: "pointer", borderRadius: "6px", fontWeight: 600, fontSize: "0.8rem", background: "transparent", color: "#AAA", border: "1px solid #555" }}
              >
                CANCELAR
              </button>
              <button
                onClick={confirmarConversion}
                disabled={convirtiendo}
                style={{ padding: "11px 22px", cursor: "pointer", borderRadius: "6px", fontWeight: 600, fontSize: "0.8rem", background: "rgba(46, 204, 113, 0.2)", color: "#2ecc71", border: "1px solid #2ecc71", opacity: convirtiendo ? 0.5 : 1 }}
              >
                {convirtiendo ? "CONVIRTIENDO..." : "CONFIRMAR CONVERSIÓN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
