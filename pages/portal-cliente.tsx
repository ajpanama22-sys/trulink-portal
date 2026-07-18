import { useRouter } from "next/router";

export default function PortalCliente() {
  const router = useRouter();

  const cardStyle: React.CSSProperties = {
    padding: "20px",
    backgroundColor: "#000",
    border: "2px solid #DAA520",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 0 10px #DAA520",
    width: "300px",
    textAlign: "center"
  };

  const imgStyle: React.CSSProperties = { width: "100%", borderRadius: "15px", marginBottom: "15px" };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style jsx>{`
        .card:hover { transform: scale(1.05); box-shadow: 0 0 30px #DAA520; }
      `}</style>

      <h1 style={{ color: "#DAA520", marginBottom: "50px" }}>Seleccione Servicio</h1>

      <div style={{ display: "flex", gap: "40px" }}>
        {/* Fabricación */}
        <div className="card" style={cardStyle} onClick={() => router.push("/fabricacion")}>
          <img src="/images/fabrica.png" alt="Fabricación" style={imgStyle} />
          <h2 style={{ color: "#DAA520" }}>Fabricación de Cables</h2>
        </div>

        {/* Productos */}
        <div className="card" style={cardStyle} onClick={() => router.push("/productos")}>
          <img src="/images/terminado.png" alt="Productos" style={imgStyle} />
          <h2 style={{ color: "#DAA520" }}>Productos Terminados</h2>
        </div>
      </div>
    </div>
  );
}
