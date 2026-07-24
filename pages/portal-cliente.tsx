import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function PortalCliente() {
  const router = useRouter();
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

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.clear();
    localStorage.clear();
    router.push("/");
  };

  const cardStyle: React.CSSProperties = {
    padding: "20px",
    backgroundColor: "#000",
    border: "2px solid #DAA520",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 0 10px #DAA520",
    width: "300px",
    textAlign: "center"
  };

  const imgStyle: React.CSSProperties = { width: "100%", borderRadius: "15px", marginBottom: "15px" };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "40px" }}>
      <style jsx>{`
        .card:hover { transform: scale(1.05); box-shadow: 0 0 30px #DAA520; }
        .logout-btn:hover { background-color: #DAA520 !important; color: #000 !important; }
      `}</style>

      {/* MODAL DE CONFIGURACIÓN DE NOTIFICACIONES (Primer Login) */}
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
            color: "#DAA520"
          }}>
            <h2 style={{ marginBottom: "15px", textAlign: "center", fontSize: "1.3rem" }}>Configuración de Notificaciones</h2>
            <p style={{ fontSize: "0.9rem", color: "#ccc", marginBottom: "20px", textAlign: "center" }}>
              Es tu primer acceso. Por favor, configure sus preferencias para recibir alertas de pedidos y actualizaciones del sistema.
            </p>

            <form onSubmit={handleGuardarNotificaciones}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>Correo para notificaciones:</label>
              <input
                type="email"
                placeholder="correo@empresa.com"
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
                  id="pushCheck"
                  checked={pushNotif}
                  onChange={(e) => setPushNotif(e.target.checked)}
                  style={{ accentColor: "#DAA520", width: "18px", height: "18px" }}
                />
                <label htmlFor="pushCheck" style={{ fontSize: "0.9rem", cursor: "pointer" }}>Habilitar notificaciones Push en navegador</label>
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

      {/* Botón de Cerrar Sesión */}
      <button
        onClick={handleLogout}
        className="logout-btn"
        style={{
          position: "absolute",
          top: "20px",
          right: "30px",
          backgroundColor: "transparent",
          color: "#DAA520",
          border: "1px solid #DAA520",
          padding: "8px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
          transition: "all 0.3s ease"
        }}
      >
        Cerrar Sesión
      </button>

      <h1 style={{ color: "#DAA520", marginBottom: "50px" }}>Seleccione Servicio</h1>

      <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Pedidos Especiales */}
        <div className="card" style={cardStyle} onClick={() => router.push("/especiales")}>
          <img src="/images/especiales.jpg" alt="Pedidos Especiales" style={imgStyle} />
          <h2 style={{ color: "#DAA520" }}>Pedidos Especiales</h2>
        </div>

        {/* Fabricación */}
        <div className="card" style={cardStyle} onClick={() => router.push("/fabricacion")}>
          <img src="/images/fabrica.png" alt="Fabricación" style={imgStyle} />
          <h2 style={{ color: "#DAA520" }}>Fabricación de Cables</h2>
        </div>

        {/* Productos */}
        <div className="card" style={cardStyle} onClick={() => router.push("/productos")}>
          <img src="/images/terminado.png" alt="Productos" style={imgStyle} />
          <h2 style={{ color: "#DAA520" }}>Productos Terminados</h2>
        </div>
      </div>
    </div>
  );
}