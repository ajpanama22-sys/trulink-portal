// ===============================================
// Landing Page Trulink Fiber
// Estilo corporativo premium: fondo negro, botones dorados, tipografía blanca
// Mostrar 3 opciones principales:
//   1. Registro Cliente B2B
//   2. Registro Inversor Estratégico
//   3. Acceso con USER + PASS
// Logo centrado (logo.png)
// Botones con bordes redondeados, sombra ligera, hover blanco
// ===============================================
export default function Home() {
  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", textAlign: "center", padding: "40px" }}>
      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <h1 style={{ color: "#DAA520", marginBottom: "40px" }}>
        Trulink Fiber LLC
      </h1>

      {/* Botones principales */}
      <div style={{ display: "flex", justifyContent: "center", gap: "30px" }}>
        <a href="/clientes">
          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "15px 30px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px",   // 👈 esquinas biseladas
            cursor: "pointer"
          }}>
            Registro Cliente / Inversor
          </button>
        </a>
        <a href="/login">
          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "15px 30px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px",   // 👈 esquinas biseladas
            cursor: "pointer"
          }}>
            Acceso con User + Pass
          </button>
        </a>
      </div>

      {/* Footer institucional */}
      <p style={{ marginTop: "60px", fontSize: "12px", color: "#DAA520" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
