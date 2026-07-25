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

    const tablasAConsultar = [tablaSesion, "clientes", "clients"].filter(Boolean) as string[];
    const tablasUnicas = Array.from(new Set(tablasAConsultar));

    let telefonoEncontrado = "";
    let emailEncontrado = emailSession || "";

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
    padding: "24px 20px",
    backgroundColor: "#080808",
    border: "1px solid rgba(218, 165, 32, 0.4)",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
    width: "280px",
    textAlign: "center" as const,
    boxSizing: "border-box"
  };

  const imgStyle: React.CSSProperties = { 
    width: "100%", 
    height: "160px",
    objectFit: "cover",
    borderRadius: "8px", 
    marginBottom: "15px",
    border: "1px solid rgba(218, 165, 32, 0.2)"
  };

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520",
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      position: "relative", 
      padding: "50px 20px",
      fontFamily: "sans-serif",
      overflowX: "hidden"
    }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        .card:hover { 
          transform: translateY(-5px); 
          border-color: #DAA520 !important;
          box-shadow: 0 0 30px rgba(218, 165, 32, 0.3) !important; 
        }
        .logout-btn:hover { 
          background-color: #DAA520 !important; 
          color: #000 !important; 
          box-shadow: 0 0 15px rgba(218, 165, 32, 0.4);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .modal-content {
          animation: fadeIn 0.3s ease forwards;
        }
      `}</style>

      {mostrarModalNotif && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(5px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div className="modal-content" style={{
            backgroundColor: "#080808",
            border: "1px solid rgba(218, 165, 32, 0.6)",
            padding: "35px 30px",
            borderRadius: "12px",
            width: "100%",
            maxWidth: "460px",
            boxShadow: "0 15px 40px rgba(0,0,0,0.9), 0 0 25px rgba(218, 165, 32, 0.2)",
            color: "#DAA520",
            boxSizing: "border-box"
          }}>
            <h2 style={{ marginBottom: "15px", textAlign: "center", fontSize: "1.2rem", fontWeight: "500", letterSpacing: "1px", textTransform: "uppercase" }}>
              Canales de Notificación Activos
            </h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.7)", marginBottom: "25px", textAlign: "center", lineHeight: "1.5" }}>
              Es tu primer acceso. Las alertas de pedidos y actualizaciones del sistema se enviarán automáticamente a tus medios registrados:
            </p>

            <div style={{ backgroundColor: "#050505", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "18px", borderRadius: "8px", marginBottom: "25px" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "10px", color: "rgba(255, 255, 255, 0.8)" }}>
                📧 <strong style={{ color: "#DAA520", marginLeft: "5px" }}>Correo:</strong> {userEmail || "Cargando..."}
              </p>
              <p style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.8)", margin: 0 }}>
                📱 <strong style={{ color: "#DAA520", marginLeft: "5px" }}>Celular:</strong> {userCelular || "No registrado"}
              </p>
            </div>

            <form onSubmit={handleGuardarNotificaciones}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", gap: "12px" }}>
                <input
                  type="checkbox"
                  id="pushCheck"
                  checked={pushNotif}
                  onChange={(e) => setPushNotif(e.target.checked)}
                  style={{ accentColor: "#DAA520", width: "18px", height: "18px", cursor: "pointer" }}
                />
                <label htmlFor="pushCheck" style={{ fontSize: "0.85rem", cursor: "pointer", color: "rgba(255, 255, 255, 0.9)" }}>
                  Habilitar notificaciones Push adicionales en navegador
                </label>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: "#DAA520",
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  transition: "opacity 0.2s ease"
                }}
              >
                Entendido y Continuar
              </button>

              {mensajeModal && (
                <p style={{ marginTop: "15px", color: "#e74c3c", textAlign: "center", fontSize: "0.85rem" }}>{mensajeModal}</p>
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
          top: "30px",
          right: "35px",
          backgroundColor: "transparent",
          color: "#DAA520",
          border: "1px solid rgba(218, 165, 32, 0.5)",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "0.85rem",
          letterSpacing: "0.5px",
          transition: "all 0.3s ease"
        }}
      >
        Cerrar Sesión
      </button>

      <h1 style={{ 
        color: "#DAA520", 
        marginBottom: "45px", 
        letterSpacing: "2px", 
        fontSize: "1.6rem", 
        fontWeight: "300", 
        textTransform: "uppercase",
        textAlign: "center"
      }}>
        Seleccione Servicio
      </h1>

      <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1200px" }}>
        <div className="card" style={cardStyle} onClick={() => router.push("/especiales")}>
          <img src="/images/especiales.jpg" alt="Pedidos Especiales" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", margin: "10px 0 0 0", fontWeight: "500", letterSpacing: "0.5px" }}>Pedidos Especiales</h2>
        </div>

        <div className="card" style={cardStyle} onClick={() => router.push("/fabricacion")}>
          <img src="/images/fabrica.png" alt="Fabricación" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", margin: "10px 0 0 0", fontWeight: "500", letterSpacing: "0.5px" }}>Fabricación de Cables</h2>
        </div>

        <div className="card" style={cardStyle} onClick={() => router.push("/productos")}>
          <img src="/images/terminado.png" alt="Productos" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", margin: "10px 0 0 0", fontWeight: "500", letterSpacing: "0.5px" }}>Productos Terminados</h2>
        </div>

        <div className="card" style={cardStyle} onClick={() => router.push("/seguimiento")}>
          <img src="/images/pedidos.png" alt="Control de Pedidos" style={imgStyle} />
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", margin: "10px 0 0 0", fontWeight: "500", letterSpacing: "0.5px" }}>Control de Pedidos</h2>
        </div>
      </div>
    </div>
  );
}