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

  // Cargar estadísticas reales desde la tabla solicitudes_acceso en Supabase
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

      // Descomenta la siguiente línea si deseas enviar campañas UNICAMENTE a clientes aprobados:
      // query = query.eq("estado", "aprobado");

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
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="marketing" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.6rem", marginBottom: "10px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "10px", letterSpacing: "1px" }}>
          CENTRO DE MARKETING Y COMERCIALIZACIÓN
        </h1>
        <p style={{ color: "#888", marginBottom: "30px", fontSize: "0.9rem" }}>
          Diseña y despacha campañas comerciales directas, boletines técnicos de fábrica y anuncios de inventario para tus integradores.
        </p>

        {/* SELECTORES DE TIPO DE CAMPAÑA */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px" }}>
          
          <div 
            onClick={() => seleccionarPlantilla("lanzamiento")}
            style={{ 
              backgroundColor: tipoCampana === "lanzamiento" ? "#141400" : "#080808", 
              border: `2px solid ${tipoCampana === "lanzamiento" ? "#DAA520" : "rgba(218, 165, 32, 0.3)"}`, 
              borderRadius: "8px", 
              padding: "20px", 
              cursor: "pointer",
              transition: "all 0.3s ease"
            }}
          >
            <h3 style={{ fontSize: "1rem", color: "#DAA520", marginBottom: "8px" }}>🚀 Lanzamiento de Stock</h3>
            <p style={{ fontSize: "0.8rem", color: "#888", margin: 0 }}>Anuncia nuevos lotes de fábrica o reposiciones de cables/herrajes.</p>
          </div>

          <div 
            onClick={() => seleccionarPlantilla("volumen")}
            style={{ 
              backgroundColor: tipoCampana === "volumen" ? "#141400" : "#080808", 
              border: `2px solid ${tipoCampana === "volumen" ? "#DAA520" : "rgba(218, 165, 32, 0.3)"}`, 
              borderRadius: "8px", 
              padding: "20px", 
              cursor: "pointer",
              transition: "all 0.3s ease"
            }}
          >
            <h3 style={{ fontSize: "1rem", color: "#DAA520", marginBottom: "8px" }}>📦 Ofertas por Volumen</h3>
            <p style={{ fontSize: "0.8rem", color: "#888", margin: 0 }}>Campañas de precios especiales para listas de distribuidores.</p>
          </div>

          <div 
            onClick={() => seleccionarPlantilla("tecnico")}
            style={{ 
              backgroundColor: tipoCampana === "tecnico" ? "#141400" : "#080808", 
              border: `2px solid ${tipoCampana === "tecnico" ? "#DAA520" : "rgba(218, 165, 32, 0.3)"}`, 
              borderRadius: "8px", 
              padding: "20px", 
              cursor: "pointer",
              transition: "all 0.3s ease"
            }}
          >
            <h3 style={{ fontSize: "1rem", color: "#DAA520", marginBottom: "8px" }}>📄 Boletín Técnico</h3>
            <p style={{ fontSize: "0.8rem", color: "#888", margin: 0 }}>Informes de especificaciones, normativas y catálogos actualizados.</p>
          </div>

        </div>

        {/* FORMULARIO DE CONFIGURACIÓN DE CAMPAÑA */}
        <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "8px", padding: "30px" }}>
          <h3 style={{ fontSize: "1rem", textTransform: "uppercase", marginBottom: "20px", color: "#DAA520", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>
            Configurar Campaña: {tipoCampana.toUpperCase()}
          </h3>

          <form onSubmit={handleDespacharCampana}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Segmento de Destino:</label>
                <select
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value)}
                  style={inputStyle}
                >
                  <option value="todos">Todos los Clientes Registrados</option>
                  <option value="ISP">ISPs (Proveedores de Internet)</option>
                  <option value="MAYORISTA">Mayoristas y Distribuidores</option>
                  <option value="INTEGRADOR">Integradores de Redes</option>
                  <option value="CLIENTE FINAL">Clientes Finales</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Alcance Estimado:</label>
                <div style={{ ...inputStyle, backgroundColor: "#121212", color: "#fff", fontWeight: "bold", display: "flex", alignItems: "center" }}>
                  👥 {totalDestinatarios} Destinatarios
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Asunto del Correo / Mensaje:</label>
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej. Nuevo lote de producción disponible - Trulink Fiber"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "25px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "8px" }}>Contenido del Mensaje (Soporta HTML básico):</label>
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
                borderRadius: "6px",
                padding: "14px 28px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "1rem",
                width: "100%",
                transition: "transform 0.2s"
              }}
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
  backgroundColor: "#0a0a0a",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "6px",
  padding: "12px 15px",
  color: "#DAA520",
  outline: "none",
  fontSize: "0.95rem"
};