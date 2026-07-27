import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminMarketing() {
  const [tipoCampana, setTipoCampana] = useState("lanzamiento");
  const [segmento, setSegmento] = useState("todos");
  const [correoIndividual, setCorreoIndividual] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [totalDestinatarios, setTotalDestinatarios] = useState(0);

  useEffect(() => {
    if (segmento === "individual") {
      setTotalDestinatarios(correoIndividual ? correoIndividual.split(',').length : 0);
    } else {
      calcularAlcance(segmento);
    }
  }, [segmento, correoIndividual]);

  const calcularAlcance = async (seg: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      let query = supabase
        .from("solicitudes_acceso")
        .select("*", { count: "exact", head: true });

      if (seg !== "todos") {
        query = query.contains("datos_completos", { perfil_cliente: seg });
      }

      const { count, error } = await query;
      
      if (error) {
        console.error("Error de Supabase:", error);
        setTotalDestinatarios(0);
        return;
      }

      setTotalDestinatarios(count || 0); 
    } catch (error) {
      console.error("Error calculando alcance:", error);
      setTotalDestinatarios(0);
    }
  };

  const handleDespacharCampana = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto || !mensaje) {
      alert("Por favor, complete el asunto y el contenido del mensaje.");
      return;
    }

    if (segmento === "individual" && !correoIndividual) {
      alert("Por favor, ingrese al menos un correo individual.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert("Error de conexión con la base de datos.");
      return;
    }

    setCargando(true);
    try {
      // Aquí se registraría el envío en Supabase
      // En una fase posterior, aquí llamarías a tu API (ej. /api/send-email) conectada a Brevo SMTP
      const { error } = await supabase.from("solicitudes_acceso").insert([{
        tipo_solicitud: `Campaña: ${tipoCampana}`,
        razon_social: segmento === "individual" ? `Individual: ${correoIndividual}` : `Segmento: ${segmento}`,
        email: "marketing@trulinkfiber.org",
        estado: "enviado",
        datos_completos: { asunto, mensaje, destinatarios: totalDestinatarios }
      }]);

      if (error) throw error;

      alert(`¡Campaña despachada con éxito a ${totalDestinatarios} destinatario(s)!`);
      setAsunto("");
      setMensaje("");
      if(segmento === "individual") setCorreoIndividual("");
    } catch (err: any) {
      alert("Error al despachar la campaña: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const seleccionarPlantilla = (tipo: string) => {
    setTipoCampana(tipo);
    if (tipo === "lanzamiento") {
      setAsunto("🚀 Nuevo lote de producción disponible - Trulink Fiber");
      setMensaje("Estimado [CLIENTE],\n\nNos complace anunciar la disponibilidad de nuestro nuevo lote de fábrica en cables de alta resistencia y herrajes 100% de nylon y fibra.\n\nConsulte el catálogo actualizado en el portal B2B.");
    } else if (tipo === "volumen") {
      setAsunto("📊 Ofertas especiales por volumen para listas de distribuidores - Trulink Fiber");
      setMensaje("Estimado [CLIENTE],\n\nHemos habilitado una estructura de precios escalonada por volumen para proyectos de expansión. Ingrese al portal para cotizar directamente los suministros de planta.");
    } else if (tipo === "tecnico") {
      setAsunto("⚙️ Boletín Técnico: Especificaciones de resistencia y normativas de fábrica");
      setMensaje("Hola [CLIENTE],\n\nCompartimos nuestro último informe técnico con especificaciones de tensión, durabilidad y fichas de cumplimiento normativo para nuestros socios estratégicos.");
    }
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="marketing" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        {/* Header Superior */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              CENTRO DE MARKETING OMNICANAL
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Segmenta, diseña y despacha campañas comerciales directas a tu red de integradores y mayoristas.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            ESTADO: ACTIVO
          </div>
        </div>

        {/* SELECTORES DE TIPO DE CAMPAÑA */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" }}>
          {[
            { id: "lanzamiento", icon: "🚀", title: "Lanzamiento de Stock", desc: "Nuevos lotes o reposiciones de fábrica." },
            { id: "volumen", icon: "📦", title: "Ofertas por Volumen", desc: "Campañas de precios para distribuidores." },
            { id: "tecnico", icon: "📄", title: "Boletín Técnico", desc: "Normativas y catálogos actualizados." }
          ].map((item) => (
            <div 
              key={item.id}
              onClick={() => seleccionarPlantilla(item.id)}
              style={{ 
                backgroundColor: tipoCampana === item.id ? "#141400" : "#111111", 
                border: `1px solid ${tipoCampana === item.id ? "#DAA520" : "rgba(218, 165, 32, 0.2)"}`, 
                borderRadius: "12px", 
                padding: "20px", 
                cursor: "pointer",
                boxShadow: tipoCampana === item.id ? "0 4px 20px rgba(218, 165, 32, 0.15)" : "none",
                transition: "all 0.3s ease"
              }}
            >
              <h3 style={{ fontSize: "1.05rem", color: "#DAA520", marginBottom: "8px", fontWeight: "600" }}>{item.icon} {item.title}</h3>
              <p style={{ fontSize: "0.8rem", color: "#888", margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* ÁREA DE TRABAJO (FORMULARIO Y VISTA PREVIA) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
          
          {/* Columna Izquierda: Configuración */}
          <div style={{ backgroundColor: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "12px", padding: "30px" }}>
            <h3 style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "25px", color: "#DAA520", borderLeft: "3px solid #DAA520", paddingLeft: "12px" }}>
              Parámetros de Envío
            </h3>

            <form onSubmit={handleDespacharCampana}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Segmento de Destino:</label>
                <select value={segmento} onChange={(e) => setSegmento(e.target.value)} style={inputStyle}>
                  <option value="todos">Todos los Clientes Registrados</option>
                  <option value="ISP">ISPs (Proveedores de Internet)</option>
                  <option value="MAYORISTA">Mayoristas y Distribuidores</option>
                  <option value="INTEGRADOR">Integradores de Redes</option>
                  <option value="individual">🎯 Envio Individual / Manual</option>
                </select>
              </div>

              {segmento === "individual" && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Correos Destinos (Separados por coma):</label>
                  <input 
                    type="text" 
                    value={correoIndividual} 
                    onChange={(e) => setCorreoIndividual(e.target.value)} 
                    placeholder="ej. director@igtel.com, compras@cliente.com" 
                    style={inputStyle} 
                  />
                </div>
              )}

              <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0b0b0b", padding: "12px", borderRadius: "8px", border: "1px solid rgba(218, 165, 32, 0.4)" }}>
                <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Alcance Estimado:</span>
                <span style={{ color: "#DAA520", fontWeight: "bold" }}>👥 {totalDestinatarios} Destinatario(s)</span>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Asunto del Correo:</label>
                <input type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto..." style={inputStyle} />
              </div>

              <div style={{ marginBottom: "30px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Cuerpo del Mensaje:</label>
                <textarea rows={6} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Contenido..." style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <button type="submit" disabled={cargando} style={buttonStyle}>
                {cargando ? "Despachando..." : "🚀 DESPACHAR CAMPAÑA"}
              </button>
            </form>
          </div>

          {/* Columna Derecha: Vista Previa */}
          <div style={{ backgroundColor: "#050505", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "30px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "25px", color: "#888", borderLeft: "3px solid #888", paddingLeft: "12px" }}>
              Vista Previa en Vivo
            </h3>
            
            <div style={{ backgroundColor: "#fff", color: "#000", flex: 1, borderRadius: "8px", padding: "30px", boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)", overflowY: "auto" }}>
              <div style={{ borderBottom: "2px solid #000", paddingBottom: "15px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "900", letterSpacing: "-1px" }}>TRULINK FIBER</h2>
                <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>Comunicado Oficial</span>
              </div>
              
              <div style={{ marginBottom: "20px" }}>
                <strong style={{ fontSize: "0.9rem", color: "#444" }}>Asunto: </strong>
                <span style={{ fontSize: "1rem", fontWeight: "bold" }}>{asunto || "Sin asunto definido..."}</span>
              </div>

              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: "1.6", color: "#222" }}>
                {mensaje || "El contenido del mensaje aparecerá aquí..."}
              </div>

              <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid #ddd", fontSize: "0.75rem", color: "#888", textAlign: "center" }}>
                © 2026 Trulink Fiber LLC. Todos los derechos reservados.<br/>
                Para darse de baja de estas notificaciones, contacte a su gerente de cuenta.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", backgroundColor: "#0b0b0b", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "12px 16px", color: "#DAA520", outline: "none", fontSize: "0.9rem", boxSizing: "border-box" as const
};

const buttonStyle = {
  backgroundColor: "#DAA520", color: "#000", border: "none", borderRadius: "8px", padding: "16px 28px", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", width: "100%", letterSpacing: "1px", boxShadow: "0 4px 15px rgba(218, 165, 32, 0.2)", transition: "all 0.2s ease"
};