import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import AdminValidaciones from "./admin/validaciones";
import { theme } from "../lib/theme";
import { Card, Button } from "../lib/ui";

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

    // 1. Obtener correo directamente de la sesión actual de Supabase Auth
    let authEmail = "";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        authEmail = user.email;
      }
    } catch (e) {
      console.error("Error obteniendo usuario auth en admin:", e);
    }

    const tablaSesion = sessionStorage.getItem("trulink_usuario_tabla");
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");
    const emailSession = authEmail || sessionStorage.getItem("trulink_usuario_email") || sessionStorage.getItem("userEmail");

    // Lista de tablas posibles en la base de datos para buscar el celular de forma robusta
    const tablasAConsultar = [tablaSesion, "clientes", "clients", "admin", "administradores"].filter(Boolean) as string[];
    const tablasUnicas = Array.from(new Set(tablasAConsultar));

    let telefonoEncontrado = "";
    let emailEncontrado = emailSession || "";

    // 2. Intentar buscar por ID de usuario si existe en la tabla de sesión
    if (idUsuario && tablaSesion) {
      const { data, error } = await supabase
        .from(tablaSesion)
        .select("email, telefono_celular, telefono_oficina, phone, telefono")
        .eq("id", idUsuario)
        .maybeSingle();

      if (data && !error) {
        telefonoEncontrado = data.telefono_celular || data.phone || data.telefono_oficina || data.telefono || "";
        if (data.email) emailEncontrado = data.email;
      }
    }

    // 3. Si no se encontró el teléfono por ID, buscar de forma estricta por correo en todas las tablas posibles
    if (!telefonoEncontrado && emailSession) {
      for (const t of tablasUnicas) {
        const { data, error } = await supabase
          .from(t)
          .select("email, telefono_celular, telefono_oficina, phone, telefono")
          .eq("email", emailSession)
          .maybeSingle();

        if (data && !error) {
          const tel = data.telefono_celular || data.phone || data.telefono_oficina || data.telefono;
          if (tel) {
            telefonoEncontrado = tel;
            if (data.email) emailEncontrado = data.email;
            break;
          }
        }
      }
    }

    setUserEmail(emailEncontrado || emailSession || "No registrado");
    setUserCelular(telefonoEncontrado || "No registrado");
  };

  const handleGuardarNotificaciones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const tabla = sessionStorage.getItem("trulink_usuario_tabla") || "clientes";
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");

    if (idUsuario) {
      const { error } = await supabase
        .from(tabla)
        .update({
          email: userEmail,
          telefono_celular: userCelular !== "No registrado" ? userCelular : null
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
          <Card
            style={{
              border: `2px solid ${theme.gold}`,
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 0 30px rgba(218, 165, 32, 0.4)",
              color: theme.gold,
              fontFamily: "sans-serif",
              marginBottom: 0,
            }}
          >
            <h2 style={{ marginBottom: "15px", textAlign: "center", fontSize: "1.3rem", color: theme.gold }}>Canales de Notificación Activos</h2>
            <p style={{ fontSize: "0.9rem", color: "#ccc", marginBottom: "20px", textAlign: "center" }}>
              Es su primer acceso al panel administrativo. Los avisos y actualizaciones del sistema se enviarán automáticamente a sus medios registrados:
            </p>

            <div style={{ backgroundColor: "#111", border: "1px solid #333", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "8px", color: "#aaa" }}>
                📧 <strong style={{ color: theme.gold }}>Correo:</strong> {userEmail || "Cargando..."}
              </p>
              <p style={{ fontSize: "0.9rem", color: "#aaa" }}>
                📱 <strong style={{ color: theme.gold }}>Celular:</strong> {userCelular}
              </p>
            </div>

            <form onSubmit={handleGuardarNotificaciones}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="pushCheckAdmin"
                  checked={pushNotif}
                  onChange={(e) => setPushNotif(e.target.checked)}
                  style={{ accentColor: theme.gold, width: "18px", height: "18px" }}
                />
                <label htmlFor="pushCheckAdmin" style={{ fontSize: "0.9rem", cursor: "pointer", color: theme.textLight }}>Habilitar notificaciones Push adicionales en navegador</label>
              </div>

              <Button type="submit" variant="gold" style={{ width: "100%", padding: "12px", fontSize: "1rem" }}>
                Entendido y Continuar
              </Button>

              {mensajeModal && (
                <p style={{ marginTop: "10px", color: theme.red, textAlign: "center", fontSize: "0.85rem" }}>{mensajeModal}</p>
              )}
            </form>
          </Card>
        </div>
      )}

      {/* Renderizado de la vista de administración */}
      <AdminValidaciones />
    </div>
  );
}