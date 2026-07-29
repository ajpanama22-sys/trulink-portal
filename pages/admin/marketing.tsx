import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Campaña = {
  id: number;
  nombre: string;
  tipo: string;
  estado: string;
  presupuesto: number;
  gasto: number;
  roi: number;
};

type Lead = {
  id: number;
  nombre_contacto: string;
  empresa: string;
  email: string;
  telefono_celular: string;
  origen: string;
  estado: string;
};

export default function MarketingEnterprise() {
  const router = useRouter();
  const [seccionActiva, setSeccionActiva] = useState<"dashboard" | "campañas" | "leads">("dashboard");
  const [campañas, setCampañas] = useState<Campaña[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados para nueva campaña
  const [nuevaCampana, setNuevaCampana] = useState({
    nombre: "",
    tipo: "B2B Outbound",
    presupuesto: 0,
  });

  useEffect(() => {
    fetchDataMarketing();
  }, []);

  const fetchDataMarketing = async () => {
    setLoading(true);
    try {
      const { data: dataCampañas } = await supabase.from("marketing_campaigns").select("*").order("id", { ascending: false });
      const { data: dataLeads } = await supabase.from("marketing_leads").select("*").order("id", { ascending: false });

      if (dataCampañas) setCampañas(dataCampañas);
      if (dataLeads) setLeads(dataLeads);
    } catch (error) {
      console.error("Error al sincronizar con el motor enterprise de Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearCampana = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCampana.nombre) return alert("Ingrese el nombre de la campaña.");

    const { error } = await supabase.from("marketing_campaigns").insert([
      {
        nombre: nuevaCampana.nombre,
        tipo: nuevaCampana.tipo,
        estado: "Activa",
        presupuesto: nuevaCampana.presupuesto,
        gasto: 0.0,
        roi: 0.0,
      },
    ]);

    if (error) {
      alert(`Error al registrar campaña: ${error.message}`);
    } else {
      setNuevaCampana({ nombre: "", tipo: "B2B Outbound", presupuesto: 0 });
      fetchDataMarketing();
      alert("Campaña desplegada con éxito en el clúster.");
    }
  };

  const totalPresupuesto = campañas.reduce((acc, c) => acc + Number(c.presupuesto), 0);
  const totalGasto = campañas.reduce((acc, c) => acc + Number(c.gasto), 0);

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
          padding: 10px 22px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
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
          padding: 12px 26px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 0.9rem;
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

      {/* Header Corporativo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", maxWidth: "1300px", margin: "0 auto 40px auto" }}>
        <button onClick={() => router.push("/portal-cliente")} className="custom-btn">
          ← Volver al Portal Principal
        </button>
        <div style={{ display: "flex", gap: "15px" }}>
          <button onClick={() => setSeccionActiva("dashboard")} className={`custom-btn ${seccionActiva === "dashboard" ? "active" : ""}`}>
            📊 Dashboard
          </button>
          <button onClick={() => setSeccionActiva("campañas")} className={`custom-btn ${seccionActiva === "campañas" ? "active" : ""}`}>
            🎯 Campañas B2B
          </button>
          <button onClick={() => setSeccionActiva("leads")} className={`custom-btn ${seccionActiva === "leads" ? "active" : ""}`}>
            💼 Pipeline Leads
          </button>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "50px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "140px", marginBottom: "20px" }} />
        <h1 style={{ color: "#DAA520", fontSize: "1.8rem", fontWeight: "300", letterSpacing: "3px", textTransform: "uppercase", margin: 0 }}>
          ENTERPRISE MARKETING SUITE
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", letterSpacing: "1px", marginTop: "8px" }}>
          SISTEMA DE INTELIGENCIA COMERCIAL Y ADQUISICIÓN GLOBAL • TRULINK FIBER LLC
        </p>
      </div>

      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        {seccionActiva === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "25px", marginBottom: "40px" }}>
              <div className="card-enterprise" style={{ padding: "30px" }}>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>Campañas Activas</span>
                <h2 style={{ fontSize: "2.2rem", color: "#DAA520", margin: "10px 0 0 0", fontWeight: "400" }}>{campañas.filter(c => c.estado === 'Activa').length}</h2>
              </div>
              <div className="card-enterprise" style={{ padding: "30px" }}>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>Presupuesto Global Asignado</span>
                <h2 style={{ fontSize: "2.2rem", color: "#FFF", margin: "10px 0 0 0", fontWeight: "400" }}>${totalPresupuesto.toLocaleString()}</h2>
              </div>
              <div className="card-enterprise" style={{ padding: "30px" }}>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>Leads en Pipeline</span>
                <h2 style={{ fontSize: "2.2rem", color: "#DAA520", margin: "10px 0 0 0", fontWeight: "400" }}>{leads.length}</h2>
              </div>
            </div>

            <div className="card-enterprise" style={{ padding: "40px", marginBottom: "40px" }}>
              <h3 style={{ color: "#DAA520", fontSize: "1.1rem", fontWeight: "500", letterSpacing: "1px", textTransform: "uppercase", marginTop: 0 }}>
                Despliegue Rápido de Campaña Global
              </h3>
              <form onSubmit={handleCrearCampana} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "20px", alignItems: "end", marginTop: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "8px", textTransform: "uppercase" }}>Nombre de Campaña</label>
                  <input
                    type="text"
                    placeholder="Ej: Expansión Asia-Panamá Hub"
                    value={nuevaCampana.nombre}
                    onChange={(e) => setNuevaCampana({ ...nuevaCampana, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "8px", textTransform: "uppercase" }}>Canal / Tipo</label>
                  <select
                    value={nuevaCampana.tipo}
                    onChange={(e) => setNuevaCampana({ ...nuevaCampana, tipo: e.target.value })}
                  >
                    <option value="B2B Outbound">B2B Outbound</option>
                    <option value="Email Automation">Email Automation (Brevo SMTP)</option>
                    <option value="Global Ads">Global Ads</option>
                    <option value="Partners Estratégicos">Partners Estratégicos</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "8px", textTransform: "uppercase" }}>Presupuesto ($ USD)</label>
                  <input
                    type="number"
                    value={nuevaCampana.presupuesto}
                    onChange={(e) => setNuevaCampana({ ...nuevaCampana, presupuesto: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <button type="submit" className="gold-btn" style={{ height: "47px" }}>
                  Desplegar
                </button>
              </form>
            </div>
          </div>
        )}

        {seccionActiva === "campañas" && (
          <div className="card-enterprise" style={{ padding: "40px" }}>
            <h2 style={{ color: "#DAA520", fontSize: "1.2rem", fontWeight: "500", letterSpacing: "1px", textTransform: "uppercase", marginTop: 0, marginBottom: "25px" }}>
              Gestión de Campañas Publicitarias y B2B
            </h2>
            {campañas.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay campañas registradas actualmente en el clúster.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Campaña</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Presupuesto</th>
                    <th>Gasto</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {campañas.map((c) => (
                    <tr key={c.id}>
                      <td style={{ color: "rgba(255,255,255,0.5)" }}>#{c.id}</td>
                      <td style={{ textAlign: "left", fontWeight: "500" }}>{c.nombre}</td>
                      <td>{c.tipo}</td>
                      <td>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", backgroundColor: "rgba(218, 165, 32, 0.15)", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.4)" }}>
                          {c.estado}
                        </span>
                      </td>
                      <td>${Number(c.presupuesto).toLocaleString()}</td>
                      <td>${Number(c.gasto).toLocaleString()}</td>
                      <td style={{ color: "#DAA520", fontWeight: "600" }}>{c.roi}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {seccionActiva === "leads" && (
          <div className="card-enterprise" style={{ padding: "40px" }}>
            <h2 style={{ color: "#DAA520", fontSize: "1.2rem", fontWeight: "500", letterSpacing: "1px", textTransform: "uppercase", marginTop: 0, marginBottom: "25px" }}>
              Pipeline de Prospectos y Clientes Potenciales
            </h2>
            {leads.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", textAlign: "center" }}>No hay leads registrados en el sistema.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Contacto</th>
                    <th>Empresa</th>
                    <th>Email</th>
                    <th>Teléfono Móvil</th>
                    <th>Origen</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td style={{ textAlign: "left", fontWeight: "500" }}>{l.nombre_contacto}</td>
                      <td style={{ textAlign: "left" }}>{l.empresa}</td>
                      <td style={{ color: "rgba(255,255,255,0.7)" }}>{l.email}</td>
                      <td>{l.telefono_celular}</td>
                      <td>{l.origen}</td>
                      <td>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", backgroundColor: "rgba(255, 255, 255, 0.08)", color: "#FFF", border: "1px solid rgba(255, 255, 255, 0.2)" }}>
                          {l.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}