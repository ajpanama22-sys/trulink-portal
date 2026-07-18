export default function SmartQuote() {
  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      textAlign: "center", 
      padding: "40px",
      fontFamily: "sans-serif"
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
        .hover-frame:hover {
          box-shadow: 0 0 30px #DAA520 !important;
          transform: scale(1.05);
        }
      `}</style>

      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <h1 style={{ color: "#DAA520", marginBottom: "40px" }}>
        SmartQuote - Trulink Fiber LLC
      </h1>

      {/* Opciones principales en columnas */}
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        gap: "60px", 
        flexWrap: "wrap",
        marginTop: "20px" 
      }}>
        
        {/* Opción Fabricación */}
        <div className="container-fiber" style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center",
          backgroundColor: "#050505",
          padding: "30px",
          borderRadius: "30px",
          border: "2px solid #DAA520",
          width: "300px"
        }}>
          <img 
            src="/images/fabrica.png" 
            alt="Fabricación de Cables" 
            className="hover-frame"
            style={{ 
              width: "100%", 
              marginBottom: "20px", 
              border: "2px solid #DAA520", 
              borderRadius: "15px", 
              transition: "all 0.3s ease-in-out" 
            }} 
          />
          <a href="/fabricacion" style={{ textDecoration: "none" }}>
            <button style={{ 
              backgroundColor: "#DAA520", 
              color: "#000", 
              padding: "15px 30px", 
              border: "none", 
              fontWeight: "bold", 
              borderRadius: "15px", 
              cursor: "pointer",
              fontSize: "16px"
            }}>
              Fabricación de Cables
            </button>
          </a>
        </div>

        {/* Opción Productos Terminados */}
        <div className="container-fiber" style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center",
          backgroundColor: "#050505",
          padding: "30px",
          borderRadius: "30px",
          border: "2px solid #DAA520",
          width: "300px"
        }}>
          <img 
            src="/images/terminado.png" 
            alt="Productos Terminados" 
            className="hover-frame"
            style={{ 
              width: "100%", 
              marginBottom: "20px", 
              border: "2px solid #DAA520", 
              borderRadius: "15px", 
              transition: "all 0.3s ease-in-out" 
            }} 
          />
          <a href="/productos" style={{ textDecoration: "none" }}>
            <button style={{ 
              backgroundColor: "#DAA520", 
              color: "#000", 
              padding: "15px 30px", 
              border: "none", 
              fontWeight: "bold", 
              borderRadius: "15px", 
              cursor: "pointer",
              fontSize: "16px"
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
    </div>
  );
}