import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminMarketing() {
  const [tipoCampana, setTipoCampana] = useState("lanzamiento");
  const [segmento, setSegmento] = useState("todos");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [totalDestinatarios, setTotalDestinatarios] = useState(0);

  useEffect(() => {
    calcularAlcance(segmento);
  }, [segmento]);

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

    const supabase = getSupabase();
    if (!supabase) {
      alert("Error de conexión con la base de datos.");
      return;
    }

    setCargando(true);
    try {
      const { error } = await supabase.from("solicitudes_acceso").insert([{
        tipo_solicitud: `Campaña: ${tipoCampana}`,
        razon_social: `Segmento: ${segmento}`,
        email: "marketing@trulinkfiber.org",
        estado: "enviado",
        datos_completos: { asunto, mensaje, destinatarios: totalDestinatarios }
      }]);

      if (error) throw error;

      alert(`¡Campaña despachada con éxito a ${totalDestinatarios} destinatarios del segmento seleccionado!`);
      setAsunto("");
      setMensaje("");
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
      setMensaje("Estimado socio comercial,\n\nNos complace anunciar la disponibilidad de nuestro nuevo lote de fábrica en cables de alta resistencia y herrajes 100% de nylon y fibra.\n\nConsulte el catálogo actualizado en el portal B2B.");
    } else if (tipo === "volumen") {
      setAsunto("📊 Ofertas especiales por volumen para listas de distribuidores - Trulink Fiber");
      setMensaje("Estimado integrador,\n\nHemos habilitado una estructura de precios escalonada por volumen para proyectos de expansión de redes FTTH. Ingrese al portal para cotizar directamente.");
    } else if (tipo === "tecnico") {
      setAsunto("⚙️ Boletín Técnico: Especificaciones de resistencia y normativas de fábrica");
      setMensaje("Compartimos nuestro último informe técnico con especificaciones de tensión, durabilidad y fichas de cumplimiento normativo para nuestros socios.");
    }
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="marketing" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        {/* Header Superior con Estilo Premium Black & Gold */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              CENTRO DE MARKETING Y COMERCIALIZACIÓN
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Diseña y despacha campañas comerciales directas, boletines técnicos de fábrica y anuncios de inventario para tus integradores.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            MODALIDAD: B2B ACTIVA
          </div>
        </div>

        {/* SELECTORES DE TIPO DE CAMPAÑA */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px" }}>
          
          <div 
            onClick={() => seleccionarPlantilla("lanzamiento")}
            style={{ 
              backgroundColor: tipoCampana === "lanzamiento" ? "#141400" : "#111111", 
              border: `1px solid ${tipoCampana === "lanzamiento" ? "#DAA520" : "rgba(218, 165, 32, 0.2)"}`, 
              borderRadius: "12px", 
              padding: "24px", 
              cursor: "pointer",
              boxShadow: tipoCampana === "lanzamiento" ? "0 4px 20px rgba(218, 165, 32, 0.15)" : "0 4px 20px rgba(0,0,0,0.5)",
              transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => { if (tipoCampana !== "lanzamiento") e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.5)"; }}
            onMouseOut={(e) => { if (tipoCampana !== "lanzamiento") e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.2)"; }}
          >
            <h3 style={{ fontSize: "1.05rem", color: "#DAA520", marginBottom: "8px", fontWeight: "600", letterSpacing: "0.5px" }}>🚀 Lanzamiento de Stock</h3>
            <p style={{ fontSize: "0.85rem", color: "#888", margin: 0, lineHeight: "1.4" }}>Anuncia nuevos lotes de fábrica o reposiciones de cables/herrajes.</p>
          </div>

          <div 
            onClick={() => seleccionarPlantilla("volumen")}
            style={{ 
              backgroundColor: tipoCampana === "volumen" ? "#141400" : "#111111", 
              border: `1px solid ${tipoCampana === "volumen" ? "#DAA520" : "rgba(218, 165, 32, 0.2)"}`, 
              borderRadius: "12px", 
              padding: "24px", 
              cursor: "pointer",
              boxShadow: tipoCampana === "volumen" ? "0 4px 20px rgba(218, 165, 32, 0.15)" : "0 4px 20px rgba(0,0,0,0.5)",
              transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => { if (tipoCampana !== "volumen") e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.5)"; }}
            onMouseOut={(e) => { if (tipoCampana !== "volumen") e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.2)"; }}
          >
            <h3 style={{ fontSize: "1.05rem", color: "#DAA520", marginBottom: "8px", fontWeight: "600", letterSpacing: "0.5px" }}>📦 Ofertas por Volumen</h3>
            <p style={{ fontSize: "0.85rem", color: "#888", margin: 0, lineHeight: "1.4" }}>Campañas de precios especiales para listas de distribuidores.</p>
          </div>

          <div 
            onClick={() => seleccionarPlantilla("tecnico")}
            style={{ 
              backgroundColor: tipoCampana === "tecnico" ? "#141400" : "#111111", 
              border: `1px solid ${tipoCampana === "tecnico" ? "#DAA520" : "rgba(218, 165, 32, 0.2)"}`, 
              borderRadius: "12px", 
              padding: "24px", 
              cursor: "pointer",
              boxShadow: tipoCampana === "tecnico" ? "0 4px 20px rgba(218, 165, 32, 0.15)" : "0 4px 20px rgba(0,0,0,0.5)",
              transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => { if (tipoCampana !== "tecnico") e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.5)"; }}
            onMouseOut={(e) => { if (tipoCampana !== "tecnico") e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.2)"; }}
          >
            <h3 style={{ fontSize: "1.05rem", color: "#DAA520", marginBottom: "8px", fontWeight: "600", letterSpacing: "0.5px" }}>📄 Boletín Técnico</h3>
            <p style={{ fontSize: "0.85rem", color: "#888", margin: 0, lineHeight: "1.4" }}>Informes de especificaciones, normativas y catálogos actualizados.</p>
          </div>

        </div>

        {/* FORMULARIO DE CONFIGURACIÓN DE CAMPAÑA */}
        <div style={{ backgroundColor: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "12px", padding: "35px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <h3 style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "25px", color: "#DAA520", borderLeft: "3px solid #DAA520", paddingLeft: "12px", letterSpacing: "1px" }}>
            Configurar Campaña: {tipoCampana.toUpperCase()}
          </h3>

          <form onSubmit={handleDespacharCampana}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "25px", marginBottom: "25px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px", letterSpacing: "0.5px" }}>Segmento de Destino:</label>
                <select
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value)}
                  style={inputStyle}
                >
                  <option value="todos" style={{ backgroundColor: "#111", color: "#DAA520" }}>Todos los Clientes Registrados</option>
                  <option value="ISP" style={{ backgroundColor: "#111", color: "#DAA520" }}>ISPs (Proveedores de Internet)</option>
                  <option value="MAYORISTA" style={{ backgroundColor: "#111", color: "#DAA520" }}>Mayoristas y Distribuidores</option>
                  <option value="INTEGRADOR" style={{ backgroundColor: "#111", color: "#DAA520" }}>Integradores de Redes</option>
                  <option value="CLIENTE FINAL" style={{ backgroundColor: "#111", color: "#DAA520" }}>Clientes Finales</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px", letterSpacing: "0.5px" }}>Alcance Estimado:</label>
                <div style={{ ...inputStyle, backgroundColor: "#0b0b0b", color: "#DAA520", fontWeight: "bold", display: "flex", alignItems: "center", border: "1px solid rgba(218, 165, 32, 0.4)" }}>
                  👥 {totalDestinatarios} Destinatarios
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "25px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px", letterSpacing: "0.5px" }}>Asunto del Correo / Mensaje:</label>
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej. Nuevo lote de producción disponible - Trulink Fiber"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "30px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px", letterSpacing: "0.5px" }}>Contenido del Mensaje (Soporta HTML básico):</label>
              <textarea
                rows={7}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe el cuerpo de la campaña comercial..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              style={{
                backgroundColor: "#DAA520",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                padding: "16px 28px",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "0.95rem",
                width: "100%",
                letterSpacing: "1px",
                boxShadow: "0 4px 15px rgba(218, 165, 32, 0.2)",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#e6b835"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#DAA520"; }}
            >
              {cargando ? "Despachando Campaña..." : "DESPACHAR CAMPAÑA DE MARKETING"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  backgroundColor: "#0b0b0b",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#DAA520",
  outline: "none",
  fontSize: "0.9rem",
  letterSpacing: "0.5px",
  boxSizing: "border-box" as const
};