import { useState } from "react";
import Sidebar from "./Sidebar";

export default function AdminMarketing() {
  const [tipoCampana, setTipoCampana] = useState<"lanzamiento" | "promocion" | "boletin">("lanzamiento");
  const [segmento, setSegmento] = useState("todos");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ejecutarCampana = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto.trim() || !mensaje.trim()) {
      alert("Por favor completa el asunto y el contenido de la campaña.");
      return;
    }

    setEnviando(true);
    // Simulación de envío a través de la API de correo / Brevo
    setTimeout(() => {
      alert(`Campaña de tipo [${tipoCampana.toUpperCase()}] despachada con éxito al segmento: ${segmento.toUpperCase()}`);
      setAsunto("");
      setMensaje("");
      setEnviando(false);
    }, 1200);
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="marketing" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          CENTRO DE MARKETING Y COMERCIALIZACIÓN
        </h1>

        <p style={{ color: "#aaa", marginBottom: "30px" }}>
          Diseña y despacha campañas comerciales directas, boletines técnicos de fábrica y anuncios de inventario para tus integradores.
        </p>

        {/* Panel de Opciones Creativas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "30px" }}>
          <div 
            onClick={() => setTipoCampana("lanzamiento")}
            style={{
              backgroundColor: tipoCampana === "lanzamiento" ? "#1a1608" : "#0a0a0a",
              border: `1px solid ${tipoCampana === "lanzamiento" ? "#DAA520" : "#333"}`,
              borderRadius: "8px",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontWeight: "bold", color: "#fff", marginBottom: "5px" }}>Lanzamiento de Stock</div>
            <div style={{ fontSize: "0.85rem", color: "#888" }}>Anuncia nuevos lotes de fábrica o reposiciones de cables/herrajes.</div>
          </div>

          <div 
            onClick={() => setTipoCampana("promocion")}
            style={{
              backgroundColor: tipoCampana === "promocion" ? "#1a1608" : "#0a0a0a",
              border: `1px solid ${tipoCampana === "promocion" ? "#DAA520" : "#333"}`,
              borderRadius: "8px",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontWeight: "bold", color: "#fff", marginBottom: "5px" }}>Ofertas por Volumen</div>
            <div style={{ fontSize: "0.85rem", color: "#888" }}>Campañas de precios especiales para listas de distribuidores.</div>
          </div>

          <div 
            onClick={() => setTipoCampana("boletin")}
            style={{
              backgroundColor: tipoCampana === "boletin" ? "#1a1608" : "#0a0a0a",
              border: `1px solid ${tipoCampana === "boletin" ? "#DAA520" : "#333"}`,
              borderRadius: "8px",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontWeight: "bold", color: "#fff", marginBottom: "5px" }}>Boletín Técnico</div>
            <div style={{ fontSize: "0.85rem", color: "#888" }}>Informes de especificaciones, normativas y catálogos actualizados.</div>
          </div>
        </div>

        {/* Formulario de Configuración de la Campaña */}
        <div style={{ maxWidth: "700px", backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "30px" }}>
          <h3 style={{ fontSize: "1.1rem", color: "#DAA520", marginBottom: "20px", textTransform: "uppercase" }}>
            Configurar Campaña: {tipoCampana}
          </h3>

          <form onSubmit={ejecutarCampana} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            <div>
              <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "8px" }}>Segmento de Destino:</label>
              <select
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                style={{ width: "100%", padding: "12px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px", outline: "none" }}
              >
                <option value="todos">Todos los Clientes Registrados</option>
                <option value="integradores">Integradores Certificados / Lista A-B</option>
                <option value="activos">Clientes con Cotizaciones Recientes</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "8px" }}>Asunto del Correo / Mensaje:</label>
              <input
                type="text"
                placeholder="Ej. Nuevo lote de producción disponible - Trulink Fiber"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                style={{ width: "100%", padding: "12px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "8px" }}>Contenido del Mensaje (Soporta HTML básico):</label>
              <textarea
                rows={6}
                placeholder="Escribe el cuerpo de la campaña comercial..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                style={{ width: "100%", padding: "12px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px", outline: "none", resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              style={{
                padding: "14px 20px",
                backgroundColor: "#DAA520",
                color: "#000",
                border: "none",
                borderRadius: "5px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
            >
              {enviando ? "Procesando Campaña..." : "DESPACHAR CAMPAÑA DE MARKETING"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}