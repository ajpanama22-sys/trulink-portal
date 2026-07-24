import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabaseClient";

export default function PushAlertModal() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    verificarRolYPermisos();
  }, []);

  const verificarRolYPermisos = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Obtenemos la sesión actual del usuario autenticado en Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user) {
        // Consultamos el rol en la tabla de usuarios
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("email", session.user.email)
          .single();

        // Si es superuser o admin, NO mostramos el modal de alertas de cliente
        if (userData && (userData.role === "superuser" || userData.role === "admin")) {
          return; 
        }
      }

      // Si es un cliente regular o colaborador y no ha activado las alertas en este dispositivo
      const alertasActivadas = localStorage.getItem("trulink_push_activado");
      if (!alertasActivadas) {
        setMostrarModal(true);
      }
    } catch (error) {
      console.error("Error verificando rol para alertas:", error);
    }
  };

  const handleActivarAlertas = async () => {
    setActivando(true);
    try {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          localStorage.setItem("trulink_push_activado", "true");
          alert("¡Alertas de fábrica activadas con éxito en este dispositivo!");
          setMostrarModal(false);
        } else {
          alert("Para recibir cotizaciones y alertas en tiempo real, por favor permita las notificaciones en la configuración de su navegador.");
        }
      } else {
        alert("Su navegador no soporta notificaciones push.");
      }
    } catch (error) {
      console.error("Error al activar notificaciones:", error);
    } finally {
      setActivando(false);
    }
  };

  if (!mostrarModal) return null;

  return (
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
      zIndex: 9999,
      fontFamily: "sans-serif",
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "#080808",
        border: "2px solid #DAA520",
        borderRadius: "20px",
        padding: "40px",
        maxWidth: "500px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 0 30px rgba(218, 165, 32, 0.4)"
      }}>
        <h2 style={{ color: "#DAA520", fontSize: "1.4rem", marginBottom: "15px", textTransform: "uppercase" }}>
          Socio Comercial Trulink Fiber
        </h2>

        <p style={{ color: "#ccc", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "30px" }}>
          Para recibir cotizaciones de fábrica en tiempo real, alertas de inventario y estado de despacho, es necesario activar las alertas del portal.
        </p>

        <button
          onClick={handleActivarAlertas}
          disabled={activando}
          style={{
            backgroundColor: "#DAA520",
            color: "#000",
            border: "none",
            borderRadius: "12px",
            padding: "15px 30px",
            fontWeight: "bold",
            fontSize: "1rem",
            cursor: "pointer",
            width: "100%",
            boxShadow: "0 0 15px rgba(218, 165, 32, 0.6)",
            transition: "transform 0.2s"
          }}
        >
          {activando ? "Vinculando Dispositivo..." : "Activar Alertas de Fábrica"}
        </button>

        <p style={{ color: "#666", fontSize: "0.75rem", marginTop: "20px" }}>
          Trulink Fiber LLC – Seguridad y Automatización B2B
        </p>
      </div>
    </div>
  );
}