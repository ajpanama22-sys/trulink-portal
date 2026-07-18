import { useRouter } from "next/router";

export default function Selector() {
  const router = useRouter();

  const buttonStyle: React.CSSProperties = {
    padding: "20px 40px",
    backgroundColor: "#000",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "15px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "18px",
    transition: "all 0.3s ease",
    boxShadow: "0 0 10px #DAA520",
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
        .btn-option:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px #DAA520;
          background-color: #DAA520;
          color: #000;
        }
      `}</style>

      <h1 style={{ color: "#DAA520", marginBottom: "60px" }}>Seleccione el acceso</h1>
      
      <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center" }}>
        <button 
          className="btn-option"
          onClick={() => router.push("/admin")}
          style={buttonStyle}
        >
          Administración
        </button>

        <button 
          className="btn-option"
          onClick={() => router.push("/productos")}
          style={buttonStyle}
        >
          Portal de Producción
        </button>
      </div>

      <p style={{ marginTop: "80px", fontSize: "12px", color: "#DAA520" }}>
        © 2026 Marca registrada – Trulink Fiber LLC
      </p>
    </div>
  );
}
