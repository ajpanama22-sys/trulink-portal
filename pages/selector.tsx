import { useRouter } from "next/router";

export default function Selector() {
  const router = useRouter();

  // Definición de estilos base para mantener el estándar institucional
  const cardStyle: React.CSSProperties = {
    padding: "40px",
    backgroundColor: "#000",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.4s ease",
    boxShadow: "0 0 15px #DAA520",
    width: "350px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "22px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 20px"
  };

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#FFF", 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      textAlign: "center",
      padding: "40px",
      fontFamily: "Arial, sans-serif"
    }}>
      
      {/* Estilos globales y efectos de interacción */}
      <style jsx>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
        }
        .card-option {
          transition: transform 0.4s ease, box-shadow 0.4s ease, background-color 0.4s ease;
        }
        .card-option:hover {
          transform: scale(1.08);
          box-shadow: 0 0 40px #DAA520;
          background-color: #111;
        }
      `}</style>

      {/* Título Institucional */}
      <h1 style={{ 
        color: "#DAA520", 
        marginBottom: "80px", 
        fontSize: "3rem",
        textTransform: "uppercase",
        letterSpacing: "2px"
      }}>
        Unidad Operativa
      </h1>
      
      {/* Contenedor de Selección */}
      <div style={{ 
        display: "flex", 
        gap: "60px", 
        flexWrap: "wrap", 
        justifyContent: "center",
        width: "100%" 
      }}>
        
        {/* Nivel Administrativo */}
        <div 
          className="card-option"
          onClick={() => router.push("/admin")}
          style={cardStyle}
        >
          Unidad Administrativa
        </div>

        {/* Nivel Usuario / Cliente */}
        <div 
          className="card-option"
          onClick={() => router.push("/portal-cliente")}
          style={cardStyle}
        >
          Unidad de Usuario / Cliente
        </div>
      </div>

      {/* Footer Institucional */}
      <p style={{ 
        marginTop: "120px", 
        fontSize: "12px", 
        color: "#DAA520",
        borderTop: "1px solid #DAA520",
        paddingTop: "20px",
        width: "100%",
        maxWidth: "600px"
      }}>
        © 2026 Marca registrada – Trulink Fiber LLC – Acceso exclusivo Superuser
      </p>
    </div>
  );
}
