import { useState } from "react";
import { supabase } from "../lib/supabaseClient"; 

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "20px",
    padding: "14px 18px",
    backgroundColor: "#050505",
    color: "#DAA520",
    border: "1px solid rgba(218, 165, 32, 0.4)",
    borderRadius: "10px",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
    fontSize: "0.95rem"
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!supabase) {
      setMensaje("Error: Cliente de Supabase no inicializado.");
      return;
    }

    setCargando(true);
    setMensaje("Verificando credenciales...");

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setCargando(false);
      setMensaje("Acceso denegado: " + error.message);
      return;
    } 

    setMensaje("Acceso concedido. Redirigiendo...");

    const userEmail = (authData.user?.email || email).trim().toLowerCase();
    const EMAIL_SUPERUSER = "fred.jurado@trulinkfiber.com";

    const verificarPrimerLoginInteligente = async (tabla: string, columnaId: string, idValor: string) => {
      if (!supabase) return;
      const { data: record } = await supabase
        .from(tabla)
        .select("notificaciones_configuradas")
        .eq(columnaId, idValor)
        .single();

      if (record && !record.notificaciones_configuradas) {
        sessionStorage.setItem("trulink_mostrar_modal_notif", "true");
        sessionStorage.setItem("trulink_usuario_tabla", tabla);
        sessionStorage.setItem("trulink_usuario_id", idValor);
      }
    };

    if (userEmail === EMAIL_SUPERUSER) {
      window.location.href = '/admin';
      return;
    }

    const { data: colaboradorData } = await supabase
      .from('colaboradores')
      .select('id, email')
      .eq('email', userEmail)
      .single();

    if (colaboradorData) {
      await verificarPrimerLoginInteligente('colaboradores', 'id', colaboradorData.id);
      window.location.href = '/admin';
      return;
    }

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('id, email')
      .eq('email', userEmail)
      .single();

    if (clienteData) {
      await verificarPrimerLoginInteligente('clientes', 'id', clienteData.id);
      window.location.href = '/portal-cliente'; 
      return;
    }

    window.location.href = '/selector';
  };

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      textAlign: "center", 
      padding: "40px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      position: "relative",
      overflow: "hidden"
    }}>
      
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        @keyframes pulse-gold {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15); border-color: rgba(218, 165, 32, 0.4); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.4); border-color: #DAA520; }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15); border-color: rgba(218, 165, 32, 0.4); }
        }
        .container-fiber {
          animation: pulse-gold 4s infinite ease-in-out;
        }
        input:focus {
          border-color: #DAA520 !important;
          box-shadow: 0 0 10px rgba(218, 165, 32, 0.3);
        }
      `}</style>

      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "130px", marginBottom: "20px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.3))" }} />

      <h1 style={{ color: "#DAA520", marginBottom: "35px", fontSize: "1.6rem", letterSpacing: "2px", fontWeight: "300", textTransform: "uppercase" }}>
        Trulink Fiber LLC
      </h1>

      <form 
        onSubmit={handleLogin} 
        className="container-fiber"
        style={{ 
          maxWidth: "420px", 
          width: "100%",
          margin: "0 auto", 
          border: "1px solid rgba(218, 165, 32, 0.4)", 
          padding: "40px 35px", 
          borderRadius: "12px",
          backgroundColor: "#080808",
          boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
          boxSizing: "border-box"
        }}
      >
        <h2 style={{ color: "#fff", marginBottom: "30px", fontSize: "1.2rem", letterSpacing: "1px", fontWeight: "500", textTransform: "uppercase" }}>
          Acceso Portal B2B
        </h2>

        <div style={{ textAlign: "left", marginBottom: "5px" }}>
          <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Usuario</label>
        </div>
        <input 
          type="email" 
          placeholder="correo@empresa.com" 
          style={inputStyle} 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div style={{ textAlign: "left", marginBottom: "5px" }}>
          <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contraseña</label>
        </div>
        <input 
          type="password" 
          placeholder="••••••••" 
          style={inputStyle} 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button 
          type="submit" 
          disabled={cargando}
          style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "14px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "8px",
            cursor: cargando ? "wait" : "pointer",
            width: "100%",
            fontSize: "0.9rem",
            marginTop: "10px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            transition: "opacity 0.2s ease",
            opacity: cargando ? 0.7 : 1
          }}
        >
          {cargando ? "Verificando..." : "Acceder"}
        </button>

        {mensaje && (
          <p style={{ 
            marginTop: "20px", 
            fontSize: "0.85rem",
            color: mensaje.includes("concedido") || mensaje.includes("Redirigiendo") ? "#DAA520" : "#e74c3c",
            letterSpacing: "0.5px",
            fontWeight: "500"
          }}>
            {mensaje}
          </p>
        )}
      </form>

      <p style={{ marginTop: "40px", fontSize: "11px", color: "rgba(218, 165, 32, 0.6)", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}