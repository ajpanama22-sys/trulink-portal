import { useState } from "react";

export default function Login() {
  const [mensaje, setMensaje] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    // Aquí más adelante puedes conectar con tu backend o base de datos.
    // Ejemplo simple:
    const usuarioValido = false; // 👈 cambia esto cuando tengas validación real
    if (usuarioValido) {
      setMensaje("Acceso concedido");
    } else {
      setMensaje("Acceso denegado");
    }
  };

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", textAlign: "center", padding: "40px" }}>
      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <h1 style={{ color: "#DAA520", marginBottom: "30px" }}>
        Trulink Fiber LLC
      </h1>

      {/* Formulario de acceso */}
      <form 
        onSubmit={handleLogin} 
        style={{ maxWidth: "400px", margin: "0 auto", border: "1px solid #DAA520", padding: "20px", borderRadius: "12px" }}
      >
        <h2 style={{ color: "#DAA520", marginBottom: "20px" }}>Acceso Portal B2B</h2>

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px" }}>Usuario</label>
        <input 
          type="email" 
          placeholder="correo@empresa.com" 
          style={{ width: "100%", marginBottom: "15px", padding: "8px", borderRadius: "8px", border: "1px solid #DAA520", backgroundColor: "#111", color: "#DAA520" }} 
        />

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px" }}>Contraseña</label>
        <input 
          type="password" 
          placeholder="********" 
          style={{ width: "100%", marginBottom: "20px", padding: "8px", borderRadius: "8px", border: "1px solid #DAA520", backgroundColor: "#111", color: "#DAA520" }} 
        />

        {/* Botón biselado */}
        <button style={{ 
          backgroundColor: "#DAA520", 
          color: "#000", 
          padding: "12px 24px", 
          border: "none", 
          fontWeight: "bold", 
          borderRadius: "12px",   // 👈 esquinas biseladas
          cursor: "pointer",
          width: "100%"
        }}>
          Acceder
        </button>

        {/* Mensaje dinámico */}
        {mensaje && (
          <p style={{ marginTop: "15px", color: mensaje === "Acceso concedido" ? "#00FF00" : "red" }}>
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
