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

type Cotizacion = {
  id: number;
  total: number;
  estado: string;
  descripcion: string;
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

export default function CRMEpicoEnterprise() {
  const router = useRouter();
  const [pestanaActiva, setPestanaActiva] = useState<"clientes" | "pipeline" | "actividades" | "cpq" | "gobierno">("clientes");
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [nuevoProspecto, setNuevoProspecto] = useState({
    razon_social: "",
    email: "",
    telefono_celular: "",
    perfil_cliente: "ISP",
    industria: "Telecomunicaciones y Fibra Óptica",
    pais: "Panamá",
  });
  const [nuevaOportunidad, setNuevaOportunidad] = useState({ titulo: "", pipeline_tipo: "B2B Licitación", valor_estimado: 0, vendedor_asignado: "Fred Jurado" });

  // --- Modal de conversión a cliente real ---
  const [modalConversion, setModalConversion] = useState<{ isOpen: boolean; prospecto: Prospecto | null }>({
    isOpen: false,
    prospecto: null,
  });
  const [tipoPagoConversion, setTipoPagoConversion] = useState<string>("50%");
  const [porcentajeEspecial, setPorcentajeEspecial] = useState<number>(50);
  const [convirtiendo, setConvirtiendo] = useState<boolean>(false);

  useEffect(() => {
    fetchCRMData();
  }, []);

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

      const { data: quoteData, error: quoteError } = await supabase.from("quotes").select("*").order("id", { ascending: false });
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
      { ...nuevaOportunidad, etapa: "Prospecto", probabilidad: 25 }
    ]);
    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setNuevaOportunidad({ titulo: "", pipeline_tipo: "B2B Licitación", valor_estimado: 0, vendedor_asignado: "Fred Jurado" });
      fetchCRMData();
      alert("Oportunidad añadida al Pipeline.");
    }
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

  const forecastTotal = oportunidades.reduce((acc, o) => acc + (Number(o.valor_estimado) * (Number(o.probabilidad) / 100)), 0);
  const pipelineValorTotal = oportunidades.reduce((acc, o) => acc + Number(o.valor_estimado), 0);

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
                  <h2 style={{ fontSize: "2.2rem", color: "#DAA520", margin: "10px 0 0 0", fontWeight: "400" }}>{oportunidades.length}</h2>
                </div>
              </div>

              <div className="card-enterprise" style={{ padding: "35px", marginBottom: "40px" }}>
                <h3 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0 }}>
                  Apertura de Oportunidad Comercial (SFA)
                </h3>
                <form onSubmit={handleCrearOportunidad} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "15px", alignItems: "end", marginTop: "20px" }}>
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
                          <td><span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "0.7rem", background: "rgba(255,255,255,0.08)", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)" }}>{o.etapa}</span></td>
                          <td style={{ color: "#DAA520", fontWeight: "600" }}>${Number(o.valor_estimado).toLocaleString()}</td>
                          <td>{o.probabilidad}%</td>
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
            <div className="card-enterprise" style={{ padding: "35px" }}>
              <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                Ficha Única Operativa (Bitácora Comercial)
              </h2>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", lineHeight: "1.6" }}>
                Registro estricto asociado al <strong>nombre_representante</strong> y <strong>telefono_celular</strong> de cada cuenta. Control y auditoría en tiempo real para la gerencia.
              </p>
              <div style={{ marginTop: "30px", textAlign: "center", padding: "40px", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "10px" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>Seleccione un cliente para desplegar la ficha operativa individualizada. (Pendiente de conectar — sección decorativa por ahora)</span>
              </div>
            </div>
          )}

          {/* SECCIÓN 4: CPQ & COTIZACIONES */}
          {pestanaActiva === "cpq" && (
            <div className="card-enterprise" style={{ padding: "35px" }}>
              <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                Motor CPQ & Tabla `quotes`
              </h2>
              {cotizaciones.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay cotizaciones registradas en la tabla <code>quotes</code>.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID Cotización</th>
                      <th>Estado</th>
                      <th>Descripción / Contrato</th>
                      <th>Total ($ USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.map((q) => (
                      <tr key={q.id}>
                        <td style={{ color: "rgba(255,255,255,0.5)" }}>#{q.id}</td>
                        <td><span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "0.7rem", background: "rgba(218,165,32,0.15)", color: "#DAA520", border: "1px solid rgba(218,165,32,0.3)" }}>{q.estado}</span></td>
                        <td style={{ textAlign: "left" }}>{q.descripcion || "Propuesta Comercial Enterprise"}</td>
                        <td style={{ color: "#DAA520", fontWeight: "600" }}>${Number(q.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
