import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Cliente = {
  id: number;
  nombre_empresa: string;
  perfil_cliente: string;
  industria: string;
  pais: string;
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

export default function CRMEpicoEnterprise() {
  const router = useRouter();
  const [pestanaActiva, setPestanaActiva] = useState<"clientes" | "pipeline" | "actividades" | "cpq" | "gobierno">("clientes");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados de formularios adaptados a los nuevos campos
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_empresa: "", perfil_cliente: "ISP", industria: "Telecomunicaciones y Fibra Óptica", pais: "Panamá" });
  const [nuevaOportunidad, setNuevaOportunidad] = useState({ titulo: "", pipeline_tipo: "B2B Licitación", valor_estimado: 0, vendedor_asignado: "Fred Jurado" });

  useEffect(() => {
    fetchCRMData();
  }, []);

  const fetchCRMData = async () => {
    setLoading(true);
    try {
      const { data: cliData } = await supabase.from("clientes").select("*").order("id", { ascending: false });
      const { data: oppData } = await supabase.from("crm_opportunities").select("*").order("id", { ascending: false });
      const { data: quoteData } = await supabase.from("quotes").select("*").order("id", { ascending: false });

      if (cliData) setClientes(cliData);
      if (oppData) setOportunidades(oppData);
      if (quoteData) setCotizaciones(quoteData);
    } catch (error) {
      console.error("Error sincronizando clúster CRM:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCliente.nombre_empresa) return alert("Ingrese el nombre de la empresa.");

    const { error } = await supabase.from("clientes").insert([nuevoCliente]);
    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setNuevoCliente({ nombre_empresa: "", perfil_cliente: "ISP", industria: "Telecomunicaciones y Fibra Óptica", pais: "Panamá" });
      fetchCRMData();
      alert("Cliente registrado exitosamente.");
    }
  };

  const handleCrearOportunidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaOportunidad.titulo) return alert("Ingrese el título de la oportunidad.");

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

  const forecastTotal = oportunidades.reduce((acc, o) => acc + (Number(o.valor_estimado) * (Number(o.probabilidad) / 100)), 0);
  const pipelineValorTotal = oportunidades.reduce((acc, o) => acc + Number(o.valor_estimado), 0);

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "50px 30px", fontFamily: "sans-serif" }}>
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
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid rgba(218, 165, 32, 0.25); padding: 14px; text-align: center; color: #FFF; font-size: 0.9rem; }
        th { background-color: #0a0a0a; color: #DAA520; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1.5px; }
        input, select { background-color: #050505; color: #DAA520; border: 1px solid rgba(218, 165, 32, 0.4); padding: 12px; border-radius: 8px; outline: none; width: 100%; font-size: 0.9rem; }
      `}</style>

      {/* Navegación Superior */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", maxWidth: "1350px", margin: "0 auto 40px auto" }}>
        <button onClick={() => router.push("/portal-cliente")} className="custom-btn">
          ← Volver al Portal Principal
        </button>
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
        {/* SECCIÓN 1: CLIENTES Y PERFILES */}
        {pestanaActiva === "clientes" && (
          <div>
            <div className="card-enterprise" style={{ padding: "35px", marginBottom: "40px" }}>
              <h3 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0 }}>
                Registro de Cuenta y Perfil Comercial
              </h3>
              <form onSubmit={handleCrearCliente} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "15px", alignItems: "end", marginTop: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Empresa / Cliente</label>
                  <input type="text" placeholder="Ej: IGTEL Honduras" value={nuevoCliente.nombre_empresa} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre_empresa: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Perfil de Cliente</label>
                  <select value={nuevoCliente.perfil_cliente} onChange={(e) => setNuevoCliente({ ...nuevoCliente, perfil_cliente: e.target.value })}>
                    <option value="ISP">ISP</option>
                    <option value="MAYORISTA">MAYORISTA</option>
                    <option value="INTEGRADOR">INTEGRADOR</option>
                    <option value="CLIENTE FINAL">CLIENTE FINAL</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>Industria</label>
                  <input type="text" value={nuevoCliente.industria} onChange={(e) => setNuevoCliente({ ...nuevoCliente, industria: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>País / Región</label>
                  <input type="text" value={nuevoCliente.pais} onChange={(e) => setNuevoCliente({ ...nuevoCliente, pais: e.target.value })} />
                </div>
                <button type="submit" className="gold-btn" style={{ height: "45px" }}>Guardar</button>
              </form>
            </div>

            <div className="card-enterprise" style={{ padding: "35px" }}>
              <h2 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", textTransform: "uppercase", marginTop: 0, marginBottom: "20px" }}>
                Directorio Global de Clientes y Perfiles
              </h2>
              {clientes.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay clientes registrados en el motor.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Empresa</th>
                      <th>Perfil del Cliente</th>
                      <th>Industria</th>
                      <th>País</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id}>
                        <td style={{ color: "rgba(255,255,255,0.5)" }}>#{c.id}</td>
                        <td style={{ textAlign: "left", fontWeight: "600" }}>{c.nombre_empresa}</td>
                        <td><span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "0.7rem", background: "rgba(218,165,32,0.15)", color: "#DAA520", border: "1px solid rgba(218,165,32,0.3)" }}>{c.perfil_cliente}</span></td>
                        <td>{c.industria}</td>
                        <td>{c.pais}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* SECCIÓN 2: PIPELINE & FORECASTING */}
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
                <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay oportunidades en el pipeline.</p>
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
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>Seleccione un cliente para desplegar la ficha operativa individualizada.</span>
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

        {/* SECCIÓN 5: AUDITORÍA & GOBERNANZA */}
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
    </div>
  );
}