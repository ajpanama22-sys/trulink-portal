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

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520",
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "space-between", 
      position: "relative", 
      padding: "40px 20px",
      fontFamily: "'Inter', sans-serif",
      overflowX: "hidden"
    }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        .trulink-card {
          background: linear-gradient(145deg, rgba(15,15,15,0.9), rgba(5,5,5,0.95));
          border: 1px solid rgba(218, 165, 32, 0.3);
          border-radius: 16px;
          padding: 22px;
          width: 270px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.9);
          position: relative;
          z-index: 2;
          overflow: hidden;
          box-sizing: border-box;
          text-align: center;
          backdrop-filter: blur(5px);
        }
        .trulink-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(218, 165, 32, 0.12), transparent);
          transition: 0.5s;
        }
        .trulink-card:hover::before {
          left: 100%;
        }
        .trulink-card:hover { 
          transform: translateY(-8px); 
          border-color: #DAA520; 
          box-shadow: 0 0 35px rgba(218, 165, 32, 0.35), 0 15px 35px rgba(0,0,0,0.9); 
        }
        .card-img-container {
          width: 100%;
          height: 155px;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 18px;
          border: 1px solid rgba(218, 165, 32, 0.15);
        }
        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .trulink-card:hover .card-img {
          transform: scale(1.08);
        }
        .logout-btn {
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(5px);
          color: #DAA520;
          border: 1px solid rgba(218, 165, 32, 0.4);
          padding: 10px 22px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.8rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: all 0.3s ease;
          z-index: 2;
          position: relative;
        }
        .logout-btn:hover { 
          background-color: #DAA520; 
          color: #000; 
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .modal-content {
          animation: fadeInScale 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Modal de Notificaciones */}
      {mostrarModalNotif && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div className="modal-content" style={{
            backgroundColor: "#070707",
            border: "1px solid rgba(218, 165, 32, 0.5)",
            padding: "40px 30px",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "460px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 30px rgba(218, 165, 32, 0.15)",
            color: "#DAA520",
            boxSizing: "border-box"
          }}>
            <h2 style={{ marginBottom: "12px", textAlign: "center", fontSize: "1.1rem", fontWeight: "600", letterSpacing: "1.5px", textTransform: "uppercase" }}>
              Canales de Notificación Activos
            </h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.65)", marginBottom: "25px", textAlign: "center", lineHeight: "1.6" }}>
              Es tu primer acceso. Las alertas de pedidos y actualizaciones del sistema se enviarán automáticamente a tus medios registrados:
            </p>

            <div style={{ backgroundColor: "#030303", border: "1px solid rgba(218, 165, 32, 0.2)", padding: "18px", borderRadius: "10px", marginBottom: "25px" }}>
              <p style={{ fontSize: "0.88rem", marginBottom: "10px", color: "rgba(255, 255, 255, 0.85)" }}>
                📧 <strong style={{ color: "#DAA520", marginLeft: "6px" }}>Correo:</strong> {userEmail || "Cargando..."}
              </p>
              <p style={{ fontSize: "0.88rem", color: "rgba(255, 255, 255, 0.85)", margin: 0 }}>
                📱 <strong style={{ color: "#DAA520", marginLeft: "6px" }}>Celular:</strong> {userCelular || "No registrado"}
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
                <label htmlFor="pushCheck" style={{ fontSize: "0.83rem", cursor: "pointer", color: "rgba(255, 255, 255, 0.85)" }}>
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
                  borderRadius: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(218, 165, 32, 0.3)"
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

      {/* Encabezado Superior */}
      <div style={{ width: "100%", maxWidth: "1200px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", zIndex: 2, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src="/images/trulink-logo.png" alt="Trulink Fiber" style={{ height: "36px", objectFit: "contain" }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          <span style={{ fontSize: "0.75rem", letterSpacing: "3px", color: "rgba(218, 165, 32, 0.6)", textTransform: "uppercase" }}>Portal B2B</span>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          Cerrar Sesión
        </button>
      </div>

      {/* Contenido Principal */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", margin: "auto 0", zIndex: 2, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: "45px" }}>
          <h1 style={{ 
            color: "#DAA520", 
            margin: "0 0 10px 0", 
            letterSpacing: "3px", 
            fontSize: "1.7rem", 
            fontWeight: "400", 
            textTransform: "uppercase"
          }}>
            Seleccione Servicio
          </h1>
          <div style={{ width: "60px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto", opacity: "0.6" }}></div>
        </div>

        <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1200px" }}>
          <div className="trulink-card" onClick={() => router.push("/especiales")}>
            <div className="card-img-container">
              <img src="/images/especiales.jpg" alt="Pedidos Especiales" className="card-img" />
            </div>
            <h2 style={{ color: "#DAA520", fontSize: "1rem", margin: 0, fontWeight: "500", letterSpacing: "0.8px" }}>Pedidos Especiales</h2>
          </div>

          <div className="trulink-card" onClick={() => router.push("/fabricacion")}>
            <div className="card-img-container">
              <img src="/images/fabrica.png" alt="Fabricación" className="card-img" />
            </div>
            <h2 style={{ color: "#DAA520", fontSize: "1rem", margin: 0, fontWeight: "500", letterSpacing: "0.8px" }}>Fabricación de Cables</h2>
          </div>

          <div className="trulink-card" onClick={() => router.push("/productos")} >
            <div className="card-img-container">
              <img src="/images/terminado.png" alt="Productos" className="card-img" />
            </div>
            <h2 style={{ color: "#DAA520", fontSize: "1rem", margin: 0, fontWeight: "500", letterSpacing: "0.8px" }}>Productos Terminados</h2>
          </div>

          <div className="trulink-card" onClick={() => router.push("/seguimiento")}>
            <div className="card-img-container">
              <img src="/images/pedidos.png" alt="Control de Pedidos" className="card-img" />
            </div>
            <h2 style={{ color: "#DAA520", fontSize: "1rem", margin: 0, fontWeight: "500", letterSpacing: "0.8px" }}>Control de Pedidos</h2>
          </div>
        </div>
      </div>

      {/* Pie de página discreto */}
      <div style={{ width: "100%", textAlign: "center", marginTop: "40px", fontSize: "0.75rem", color: "rgba(218, 165, 32, 0.4)", letterSpacing: "1px", zIndex: 2, position: "relative" }}>
        © 2026 Trulink Fiber LLC — Excelencia y Vanguardia Tecnológica
      </div>
    </div>
  );
}