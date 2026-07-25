import { useState } from "react";
import Sidebar from "./Sidebar";

export default function AdminNotificaciones() {
  const [mensaje, setMensaje] = useState("");
  const [destinatario, setDestinatario] = useState("todos");
  const [enviando, setEnviando] = useState(false);

  const enviarAlerta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) {
      alert("Por favor escribe el contenido de la notificación.");
      return;
    }

    setEnviando(true);
    setTimeout(() => {
      alert(`Notificación enviada exitosamente a: ${destinatario.toUpperCase()}`);
      setMensaje("");
      setEnviando(false);
    }, 1000);
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="notificaciones" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        {/* Header Superior con Estilo Premium Black & Gold */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              CENTRO DE NOTIFICACIONES Y ALERTAS
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Envía avisos operativos, alertas de despacho o comunicados directos a los usuarios del sistema.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            CANAL ACTIVO
          </div>
        </div>

        {/* CONTENEDOR DEL FORMULARIO CON ESTÉTICA B2B */}
        <div style={{ maxWidth: "700px", backgroundColor: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "12px", padding: "35px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <h3 style={{ fontSize: "1.1rem", textTransform: "uppercase", marginBottom: "25px", color: "#DAA520", borderLeft: "3px solid #DAA520", paddingLeft: "12px", letterSpacing: "1px" }}>
            Nueva Alerta Operativa
          </h3>

          <form onSubmit={enviarAlerta} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            <div>
              <label style={{ fontSize: "0.85rem", color: "#aaa", display: "block", marginBottom: "8px", letterSpacing: "0.5px" }}>Destinatario:</label>
              <select
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                style={inputStyle}
              >
                <option value="todos" style={{ backgroundColor: "#111", color: "#DAA520" }}>Todos los Integradores / Clientes</option>
                <option value="equipo" style={{ backgroundColor: "#111", color: "#DAA520" }}>Equipo Administrativo y Planta</option>
                <option value="pendientes" style={{ backgroundColor: "#111", color: "#DAA520" }}>Usuarios con Validaciones Pendientes</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", color: "#aaa", display: "block", marginBottom: "8px", letterSpacing: "0.5px" }}>Mensaje / Alerta:</label>
              <textarea
                rows={6}
                placeholder="Escribe el comunicado o alerta..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
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
              {enviando ? "Transmitiendo Alerta..." : "ENVIAR NOTIFICACIÓN"}
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