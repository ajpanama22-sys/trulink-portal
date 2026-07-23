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
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="notificaciones" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          CENTRO DE NOTIFICACIONES Y ALERTAS
        </h1>

        <p style={{ color: "#aaa", marginBottom: "30px" }}>
          Envía avisos operativos, alertas de despacho o comunicados directos a los usuarios del sistema.
        </p>

        <div style={{ maxWidth: "600px", backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "30px" }}>
          <form onSubmit={enviarAlerta} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            <div>
              <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "8px" }}>Destinatario:</label>
              <select
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                style={{ width: "100%", padding: "12px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px", outline: "none" }}
              >
                <option value="todos">Todos los Integradores / Clientes</option>
                <option value="equipo">Equipo Administrativo y Planta</option>
                <option value="pendientes">Usuarios con Validaciones Pendientes</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "8px" }}>Mensaje / Alerta:</label>
              <textarea
                rows={5}
                placeholder="Escribe el comunicado o alerta..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                style={{ width: "100%", padding: "12px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px", outline: "none", resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              style={{
                padding: "12px 20px",
                backgroundColor: "#DAA520",
                color: "#000",
                border: "none",
                borderRadius: "5px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
            >
              {enviando ? "Transmitiendo Alerta..." : "ENVIAR NOTIFICACIÓN"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}