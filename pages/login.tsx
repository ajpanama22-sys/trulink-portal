import { useState } from "react";
import { supabase } from "../lib/supabaseClient"; 

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "15px",
    padding: "12px",
    backgroundColor: "#111",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "15px",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box"
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje("Verificando...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMensaje("Acceso denegado: " + error.message);
    } else {
      setMensaje("Acceso concedido");
      // Aquí puedes añadir la lógica de redirección, ej: window.location.href = '/dashboard';
    }
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
      justifyContent: "center"
    }}>
      
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px #DAA520; }
          50% { box-shadow: 0 0 30px #DAA520; }
          100% { box-shadow: 0 0 10px #DAA520; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <h1 style={{ color: "#DAA520", marginBottom: "30px" }}>
        Trulink Fiber LLC
      </h1>

      {/* Formulario de acceso */}
      <form 
        onSubmit={handleLogin} 
        className="container-fiber"
        style={{ 
          maxWidth: "400px", 
          width: "100%",
          margin: "0 auto", 
          border: "2px solid #DAA520", 
          padding: "30px", 
          borderRadius: "30px",
          backgroundColor: "#050505"
        }}
      >
        <h2 style={{ color: "#DAA520", marginBottom: "25px" }}>Acceso Portal B2B</h2>

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px" }}>Usuario</label>
        <input 
          type="email" 
          placeholder="correo@empresa.com" 
          style={inputStyle} 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px" }}>Contraseña</label>
        <input 
          type="password" 
          placeholder="********" 
          style={inputStyle} 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Botón biselado */}
        <button type="submit" style={{ 
          backgroundColor: "#DAA520", 
          color: "#000", 
          padding: "15px", 
          border: "none", 
          fontWeight: "bold", 
          borderRadius: "15px",
          cursor: "pointer",
          width: "100%",
          fontSize: "16px",
          marginTop: "10px"
        }}>
          Acceder
        </button>

        {/* Mensaje dinámico */}
        {mensaje && (
          <p style={{ marginTop: "15px", color: mensaje.includes("concedido") ? "#00FF00" : "red" }}>
            {mensaje}
          </p>
        )}
      </form>

      {/* Footer institucional */}
      <p style={{ marginTop: "40px", fontSize: "12px", color: "#DAA520" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
