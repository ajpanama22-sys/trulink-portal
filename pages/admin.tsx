import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import AdminValidaciones from "./admin/validaciones";

export default function AdminRoot() {
  const [mostrarModalNotif, setMostrarModalNotif] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userCelular, setUserCelular] = useState("");
  const [mensajeModal, setMensajeModal] = useState("");

  useEffect(() => {
    // Comprobar si la bandera del primer login está activa en el sessionStorage
    const debeMostrar = sessionStorage.getItem("trulink_mostrar_modal_notif");
    if (debeMostrar === "true") {
      setMostrarModalNotif(true);
      cargarDatosUsuario();
    }
  }, []);

  const cargarDatosUsuario = async () => {
    if (!supabase) return;

    // 1. Obtener correo directamente de la sesión actual de Supabase Auth (ideal si se creó manualmente)
    let authEmail = "";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        authEmail = user.email;
      }
    } catch (e) {
      console.error("Error obteniendo usuario auth en admin:", e);
    }

    const tabla = sessionStorage.getItem("trulink_usuario_tabla");
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");
    const emailSession = authEmail || sessionStorage.getItem("trulink_usuario_email") || sessionStorage.getItem("userEmail");

    if (tabla && idUsuario) {
      const { data } = await supabase
        .from(tabla)
        .select("email, telefono, telefono_celular, phone")
        .eq("id", idUsuario)
        .single();

      if (data) {
        setUserEmail(data.email || emailSession || "No registrado");
        // Buscamos primero en "telefono" (la columna real de tu Supabase)
        setUserCelular(data.telefono || data.telefono_celular || data.phone || "No registrado");
        return;
      }
    }

    // Fallback si no hay ID pero sí emailSession
    if (emailSession) {
      const { data } = await supabase
        .from(tabla || "clients")
        .select("email, telefono, telefono_celular, phone")
        .eq("email", emailSession)
        .single();

      if (data) {
        setUserEmail(data.email || emailSession);
        setUserCelular(data.telefono || data.telefono_celular || data.phone || "No registrado");
        return;
      }
      setUserEmail(emailSession);
      setUserCelular("No registrado");
    } else {
      setUserEmail("No registrado");
      setUserCelular("No registrado");
    }
  };

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
          email_notificaciones: userEmail,
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
      {/* MODAL DE CONFIGURACIÓN DE NOTIFICACIONES INFORMATIVO (Admin) */}
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
            maxWidth: "480px",
            boxShadow: "0 0 30px rgba(218, 165, 32, 0.4)",
            color: "#DAA520",
            fontFamily: "sans-serif"
          }}>
            <h2 style={{ marginBottom: "15px", textAlign: "center", fontSize: "1.3rem" }}>Canales de Notificación Activos</h2>
            <p style={{ fontSize: "0.9rem", color: "#ccc", marginBottom: "20px", textAlign: "center" }}>
              Es su primer acceso al panel administrativo. Los avisos y actualizaciones del sistema se enviarán automáticamente a sus medios registrados:
            </p>

            <div style={{ backgroundColor: "#111", border: "1px solid #333", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "8px", color: "#aaa" }}>
                📧 <strong style={{ color: "#DAA520" }}>Correo:</strong> {userEmail || "Cargando..."}
              </p>
              <p style={{ fontSize: "0.9rem", color: "#aaa" }}>
                📱 <strong style={{ color: "#DAA520" }}>Celular:</strong> {userCelular}
              </p>
            </div>

            <form onSubmit={handleGuardarNotificaciones}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="pushCheckAdmin"
                  checked={pushNotif}
                  onChange={(e) => setPushNotif(e.target.checked)}
                  style={{ accentColor: "#DAA520", width: "18px", height: "18px" }}
                />
                <label htmlFor="pushCheckAdmin" style={{ fontSize: "0.9rem", cursor: "pointer", color: "#ddd" }}>Habilitar notificaciones Push adicionales en navegador</label>
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
                Entendido y Continuar
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