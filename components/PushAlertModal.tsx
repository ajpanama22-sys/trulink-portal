import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabaseClient";

export default function PushAlertModal() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<any>(null);
  const [tablaUsuario, setTablaUsuario] = useState<"clientes" | "colaboradores">("clientes");
  
  const [aceptaEmail, setAceptaEmail] = useState(true);
  const [aceptaPush, setAceptaPush] = useState(true);

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
        .eq("email", session.user.email)
        .single();

      if (userData && (userData.role === "superuser" || userData.role === "admin")) {
        return; 
      }

      // Buscar en la tabla "clientes"
      let { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("email", session.user.email)
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
        .eq("email", session.user.email)
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
          acepta_email: aceptaEmail,
          acepta_push: aceptaPush,
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
          Configuración de Notificaciones
        </h2>

        <p style={{ color: "#ccc", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "25px", textAlign: "left" }}>
          Para recibir cotizaciones de fábrica en tiempo real, alertas de inventario y estado de despacho, seleccione sus canales preferidos:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "30px", textAlign: "left" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "0.95rem", color: "#fff" }}>
            <input 
              type="checkbox" 
              checked={aceptaEmail} 
              onChange={(e) => setAceptaEmail(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#DAA520", cursor: "pointer" }}
            />
            Recibir avisos vía <strong style={{ color: "#DAA520" }}>Email</strong>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "0.95rem", color: "#fff" }}>
            <input 
              type="checkbox" 
              checked={aceptaPush} 
              onChange={(e) => setAceptaPush(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#DAA520", cursor: "pointer" }}
            />
            Recibir notificaciones <strong style={{ color: "#DAA520" }}>Push en mi Móvil / Celular</strong>
          </label>
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
          {guardando ? "Guardando Preferencias..." : "GUARDAR Y CONTINUAR"}
        </button>

        <p style={{ color: "#666", fontSize: "0.75rem", marginTop: "20px" }}>
          Trulink Fiber LLC – Seguridad y Automatización B2B
        </p>
      </div>
    </div>
  );
}