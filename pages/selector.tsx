import { useRouter } from "next/router";

export default function Selector() {
  const router = useRouter();

  // Mantenemos tu estilo base de botones para consistencia
  const cardStyle: React.CSSProperties = {
    padding: "20px",
    backgroundColor: "#000",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "20px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "18px",
    transition: "all 0.3s ease",
    boxShadow: "0 0 10px #DAA520",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "300px"
  };

  const imageStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: "15px",
    marginBottom: "15px",
    transition: "transform 0.3s ease"
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
      fontFamily: "Arial, sans-serif"
    }}>
      <style jsx>{`
        .card-option:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px #DAA520;
          background-color: #111;
        }
        .card-option:hover img {
          transform: scale(1.05);
        }
      `}</style>

      <h1 style={{ color: "#DAA520", marginBottom: "60px" }}>Seleccione la unidad operativa</h1>
      
      <div style={{ display: "flex", gap: "50px", flexWrap: "wrap", justifyContent: "center" }}>
        
        {/* Opción Fábrica */}
        <div 
          className="card-option" 
          onClick={() => router.push("/fabricacion")}
          style={cardStyle}
        >
          <img src="/images/fabrica.png" alt="Fabricación" style={imageStyle} />
          <span>Fabricación de Cables</span>
        </div>

        {/* Opción Productos */}
        <div 
          className="card-option" 
          onClick={() => router.push("/productos")}
          style={cardStyle}
        >
          <img src="/images/terminado.png" alt="Productos" style={imageStyle} />
          <span>Productos Terminados</span>
        </div>
      </div>

      <p style={{ marginTop: "80px", fontSize: "12px", color: "#DAA520" }}>
        © 2026 Marca registrada – Trulink Fiber LLC
      </p>
    </div>
  );
}
