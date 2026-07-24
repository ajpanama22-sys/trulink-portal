import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function PortalCliente() {
  const router = useRouter();
  const [mostrarModalNotif, setMostrarModalNotif] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userCelular, setUserCelular] = useState("");
  const [mensajeModal, setMensajeModal] = useState("");

  useEffect(() => {
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
      console.error("Error obteniendo usuario auth:", e);
    }

    const tablaSesion = sessionStorage.getItem("trulink_usuario_tabla");
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");
    const emailSession = authEmail || sessionStorage.getItem("trulink_usuario_email") || sessionStorage.getItem("userEmail");

    // Lista de tablas posibles en tu base de datos para buscar el celular en cualquiera de las dos tablas
    const tablasAConsultar = [tablaSesion, "clientes", "clients"].filter(Boolean) as string[];
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

    // 3. Si no se encontró el teléfono por ID, buscar de forma estricta por correo en todas las tablas posibles ("clientes", "clients", etc.)
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
            break; // Encontrado, salimos del ciclo
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
    boxShadow: "0 0 15px rgba(218, 165, 32, 0.3)",
    width: "280px",
    textAlign: "center"
  };

  const imgStyle: React.CSSProperties = { width: "100%", borderRadius: "15px", marginBottom: "15px" };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "40px 20px" }}>
      <style jsx>{`
        .card:hover { transform: scale(1.03); box-shadow: 0 0 30px #DAA520; }
        .logout-btn:hover { background-color: #DAA520 !important; color: #000 !important; }
      `}</style>

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
              Es tu primer acceso. Las alertas de pedidos y actualizaciones del sistema se enviarán automáticamente a tus medios registrados:
            </p>

            <div style={{ backgroundColor: "#111", border: "1px solid #333", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "8px", color: "#aaa" }}>
                📧 <strong style={{ color: "#DAA520" }}>Correo:</strong> {userEmail || "Cargando..."}
              </p>
              <p style={{ fontSize: "0.9rem", color: "#aaa" }}>
                📱 <strong style={{ color: "#DAA520" }}>Celular:</strong> {userCelular || "No registrado"}
              </p>
            </div>

            <form onSubmit={handleGuardarNotificaciones}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="pushCheck"
                  checked={pushNotif}
                  onChange={(e) => setPushNotif(e.target.checked)}
                  style={{ accentColor: "#DAA520", width: "18px", height: "18px" }}
                />
                <label htmlFor="pushCheck" style={{ fontSize: "0.9rem", cursor: "pointer", color: "#ddd" }}>Habilitar notificaciones Push adicionales en navegador</label>
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

      <h1 style={{ color: "#DAA520", marginBottom: "40px", letterSpacing: "1px" }}>Seleccione Servicio</h1>

      <div style={{ display: "flex", gap: "30px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1300px" }}>
        <div className="card" style={cardStyle} onClick={() => router.push("/especiales")}>
          <img src="/images/especiales.jpg" alt="Pedidos Especiales" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.2rem", margin: "10px 0" }}>Pedidos Especiales</h2>
        </div>

        <div className="card" style={cardStyle} onClick={() => router.push("/fabricacion")}>
          <img src="/images/fabrica.png" alt="Fabricación" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.2rem", margin: "10px 0" }}>Fabricación de Cables</h2>
        </div>

        <div className="card" style={cardStyle} onClick={() => router.push("/productos")}>
          <img src="/images/terminado.png" alt="Productos" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.2rem", margin: "10px 0" }}>Productos Terminados</h2>
        </div>

        <div className="card" style={cardStyle} onClick={() => router.push("/seguimiento")}>
          <img src="/images/pedidos.png" alt="Control de Pedidos" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.2rem", margin: "10px 0" }}>Control de Pedidos</h2>
        </div>
      </div>
    </div>
  );
}