import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import AdminValidaciones from "./admin/validaciones";

export default function AdminRoot() {
  const [mostrarModalNotif, setMostrarModalNotif] = useState(false);
  const [emailNotif, setEmailNotif] = useState("");
  const [pushNotif, setPushNotif] = useState(true);
  const [mensajeModal, setMensajeModal] = useState("");

  useEffect(() => {
    // Comprobar si la bandera del primer login está activa en el sessionStorage
    const debeMostrar = sessionStorage.getItem("trulink_mostrar_modal_notif");
    if (debeMostrar === "true") {
      setMostrarModalNotif(true);
    }
  }, []);

  const handleGuardarNotificaciones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const tabla = sessionStorage.getItem("trulink_usuario_tabla");
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");

    if (tabla && idUsuario) {
      const { error } = await supabase
        .from(tabla)
        .update({
          notificaciones_configuradas: true,
          email_notificaciones: emailNotif,
          push_activado: pushNotif
        })
        .eq('id', idUsuario);

      if (error) {
        setMensajeModal("Error al guardar: " + error.message);
        return;
      }
    }

    // Limpiar banderas del sessionStorage y cerrar modal
    sessionStorage.removeItem("trulink_mostrar_modal_notif");
    sessionStorage.removeItem("trulink_usuario_tabla");
    sessionStorage.removeItem("trulink_usuario_id");
    setMostrarModalNotif(false);
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "#000" }}>
      {/* MODAL DE CONFIGURACIÓN DE NOTIFICACIONES (Primer Login Colaborador / Admin) */}
      {mostrarModalNotif && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "#0a0a0a",
            border: "2px solid #DAA520",
            padding: "30px",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "450px",
            boxShadow: "0 0 30px rgba(218, 165, 32, 0.4)",
            color: "#DAA520",
            fontFamily: "sans-serif"
          }}>
            <h2 style={{ marginBottom: "15px", textAlign: "center", fontSize: "1.3rem" }}>Configuración de Notificaciones</h2>
            <p style={{ fontSize: "0.9rem", color: "#ccc", marginBottom: "20px", textAlign: "center" }}>
              Es su primer acceso al panel administrativo. Por favor, configure sus preferencias para recibir avisos del sistema.
            </p>

            <form onSubmit={handleGuardarNotificaciones}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>Correo para notificaciones:</label>
              <input
                type="email"
                placeholder="correo@trulinkfiber.com"
                value={emailNotif}
                onChange={(e) => setEmailNotif(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "15px",
                  backgroundColor: "#111",
                  border: "1px solid #DAA520",
                  color: "#DAA520",
                  borderRadius: "8px",
                  boxSizing: "border-box"
                }}
              />

              <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="pushCheckAdmin"
                  checked={pushNotif}
                  onChange={(e) => setPushNotif(e.target.checked)}
                  style={{ accentColor: "#DAA520", width: "18px", height: "18px" }}
                />
                <label htmlFor="pushCheckAdmin" style={{ fontSize: "0.9rem", cursor: "pointer" }}>Habilitar notificaciones Push</label>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#DAA520",
                  color: "#000",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "1rem"
                }}
              >
                Guardar y Continuar
              </button>

              {mensajeModal && (
                <p style={{ marginTop: "10px", color: "red", textAlign: "center", fontSize: "0.85rem" }}>{mensajeModal}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Renderizado de la vista de administración */}
      <AdminValidaciones />
    </div>
  );
}