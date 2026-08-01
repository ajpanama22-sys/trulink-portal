import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../lib/theme";
import { Button, inputStyle as baseInputStyle } from "../lib/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Se conserva el borderRadius "15px" distintivo de esta página vía override.
  const inputStyle: React.CSSProperties = {
    ...baseInputStyle,
    width: "100%",
    marginBottom: "15px",
    padding: "12px",
    borderRadius: "15px",
    transition: "all 0.3s ease",
    boxSizing: "border-box"
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!supabase) {
      setMensaje("Error: Cliente de Supabase no inicializado.");
      return;
    }

    setMensaje("Verificando...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMensaje("Acceso denegado: " + error.message);
      return;
    } 

    setMensaje("Acceso concedido");

    // Verificar si el usuario está registrado en la tabla de clientes
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('email')
      .eq('email', email)
      .single();

    if (clienteData) {
      // Si es cliente, redirigir directo a portal-cliente
      window.location.href = '/portal-cliente'; 
      return;
    }

    // Verificar si es colaborador (Unidad Administrativa)
    const { data: colaboradorData } = await supabase
      .from('colaboradores')
      .select('email')
      .eq('email', email)
      .single();

    if (colaboradorData) {
      // Todo colaborador entra al panel /admin. Dentro del panel, el módulo
      // "RRHH Self-Service" (pages/admin/rrhh.tsx) es su ficha personal;
      // el resto de módulos los ve según lo que decidan mostrar/ocultar
      // más adelante en el Sidebar según su rol.
      window.location.href = '/admin';
      return;
    }

    // Por defecto si no está explícitamente en ninguna de las dos tablas
    window.location.href = '/selector';
  };

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
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
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px ${theme.gold}; }
          50% { box-shadow: 0 0 30px ${theme.gold}; }
          100% { box-shadow: 0 0 10px ${theme.gold}; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <h1 style={{ color: theme.gold, marginBottom: "30px" }}>
        Trulink Fiber LLC
      </h1>

      {/* Formulario de acceso */}
      {/* Nota: se mantiene como <form> (no <Card>, que sólo acepta `style`, no
          `className`) para conservar la clase .container-fiber y su animación
          de pulso dorado. */}
      <form
        onSubmit={handleLogin}
        className="container-fiber"
        style={{
          maxWidth: "400px",
          width: "100%",
          margin: "0 auto",
          border: `2px solid ${theme.gold}`,
          padding: "30px",
          borderRadius: "30px",
          backgroundColor: theme.sidebarBg
        }}
      >
        <h2 style={{ color: theme.gold, marginBottom: "25px" }}>Acceso Portal B2B</h2>

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px", color: theme.textMuted }}>Usuario</label>
        <input
          type="email"
          placeholder="correo@empresa.com"
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px", color: theme.textMuted }}>Contraseña</label>
        <input
          type="password"
          placeholder="********"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Botón biselado */}
        <Button
          type="submit"
          variant="gold"
          style={{
            padding: "15px",
            borderRadius: "15px",
            width: "100%",
            fontSize: "16px",
            marginTop: "10px"
          }}
        >
          Acceder
        </Button>

        {/* Mensaje dinámico */}
        {mensaje && (
          <p style={{ marginTop: "15px", color: mensaje.includes("concedido") ? theme.green : theme.red }}>
            {mensaje}
          </p>
        )}
      </form>

      {/* Footer institucional */}
      <p style={{ marginTop: "40px", fontSize: "12px", color: theme.gold }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
