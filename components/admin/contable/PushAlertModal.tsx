import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabaseClient";

export default function PushAlertModal() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<any>(null);
  const [tablaUsuario, setTablaUsuario] = useState<"clientes" | "colaboradores">("clientes");

  useEffect(() => {
    verificarPrimerLogin();
  }, []);

  const verificarPrimerLogin = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return;

      // Consultar rol en la tabla "users" o admin
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .ilike("email", session.user.email)
        .single();

      if (userData && (userData.role === "superuser" || userData.role === "admin")) {
        return; 
      }

      // Buscar en la tabla "clientes"
      let { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .ilike("email", session.user.email)
        .single();

      if (cliente) {
        setUsuarioActual(cliente);
        setTablaUsuario("clientes");
        if (!cliente.notificaciones_configuradas) {
          setMostrarModal(true);
        }
        return;
      }

      // Si no es cliente, buscar en "colaboradores"
      let { data: colaborador } = await supabase
        .from("colaboradores")
        .select("*")
        .ilike("email", session.user.email)
        .single();

      if (colaborador) {
        setUsuarioActual(colaborador);
        setTablaUsuario("colaboradores");
        if (!colaborador.notificaciones_configuradas) {
          setMostrarModal(true);
        }
      }
    } catch (error) {
      console.error("Error verificando configuración de notificaciones:", error);
    }
  };

  const handleGuardarPreferencias = async () => {
    const supabase = getSupabase();
    if (!supabase || !usuarioActual) return;

    setGuardando(true);
    try {
      const { error } = await supabase
        .from(tablaUsuario)
        .update({
          notificaciones_configuradas: true
        })
        .eq("id", usuarioActual.id);

      if (error) {
        alert("Error al guardar preferencias: " + error.message);
      } else {
        setMostrarModal(false);
      }
    } catch (error) {
      console.error("Error al actualizar preferencias en BD:", error);
    } finally {
      setGuardando(false);
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
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 0 30px rgba(218, 165, 32, 0.4)",
        color: "#DAA520"
      }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", textTransform: "uppercase", letterSpacing: "1px" }}>
          Canales de Notificación Activos
        </h2>

        <p style={{ color: "#ccc", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "25px", textAlign: "left" }}>
          Es tu primer acceso. Los avisos y actualizaciones del sistema se enviarán automáticamente a tus medios registrados:
        </p>

        <div style={{ backgroundColor: "#111", border: "1px solid #333", padding: "15px", borderRadius: "10px", marginBottom: "25px", textAlign: "left" }}>
          <p style={{ fontSize: "0.9rem", marginBottom: "8px", color: "#aaa" }}>
            📧 <strong style={{ color: "#DAA520" }}>Correo:</strong> {usuarioActual?.email || "No registrado"}
          </p>
          <p style={{ fontSize: "0.9rem", color: "#aaa" }}>
            📱 <strong style={{ color: "#DAA520" }}>Celular:</strong> {usuarioActual?.telefono_celular || usuarioActual?.telefono || usuarioActual?.phone || "No registrado"}
          </p>
        </div>

        <button
          onClick={handleGuardarPreferencias}
          disabled={guardando}
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
            transition: "transform 0.2s",
            letterSpacing: "0.5px"
          }}
        >
          {guardando ? "Guardando..." : "Entendido y Continuar"}
        </button>

        <p style={{ color: "#666", fontSize: "0.75rem", marginTop: "20px" }}>
          Trulink Fiber LLC – Seguridad y Automatización B2B
        </p>
      </div>
    </div>
  );
}
