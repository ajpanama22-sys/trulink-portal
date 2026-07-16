export default function SmartQuote() {
  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", textAlign: "center", padding: "40px" }}>
      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <h1 style={{ color: "#DAA520", marginBottom: "40px" }}>
        SmartQuote - Trulink Fiber LLC
      </h1>

      {/* Opciones principales en columnas */}
      <div style={{ display: "flex", justifyContent: "center", gap: "100px" }}>
        
        {/* Opción Fabricación */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img 
            src="/images/fabrica.png" 
            alt="Fabricación de Cables" 
            style={{ 
              width: "50%",   // 👈 duplicado respecto al ajuste anterior
              marginBottom: "20px", 
              border: "4px solid #DAA520", 
              borderRadius: "12px", 
              transition: "all 0.3s ease-in-out" 
            }} 
            className="hover-frame"
          />
          <a href="/fabricacion">
            <button style={{ 
              backgroundColor: "#DAA520", 
              color: "#000", 
              padding: "20px 40px", 
              border: "none", 
              fontWeight: "bold", 
              borderRadius: "12px", 
              cursor: "pointer"
            }}>
              Fabricación de Cables
            </button>
          </a>
        </div>

        {/* Opción Productos Terminados */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img 
            src="/images/terminado.png" 
            alt="Productos Terminados" 
            style={{ 
              width: "50%",   // 👈 duplicado respecto al ajuste anterior
              marginBottom: "20px", 
              border: "4px solid #DAA520", 
              borderRadius: "12px", 
              transition: "all 0.3s ease-in-out" 
            }} 
            className="hover-frame"
          />
          <a href="/productos">
            <button style={{ 
              backgroundColor: "#DAA520", 
              color: "#000", 
              padding: "20px 40px", 
              border: "none", 
              fontWeight: "bold", 
              borderRadius: "12px", 
              cursor: "pointer"
            }}>
              Productos Terminados
            </button>
          </a>
        </div>
      </div>

      {/* Footer institucional */}
      <p style={{ marginTop: "60px", fontSize: "12px", color: "#DAA520" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>

      {/* Animación CSS */}
      <style>{`
        .hover-frame:hover {
          box-shadow: 0 0 20px #DAA520, 0 0 40px #DAA520;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
