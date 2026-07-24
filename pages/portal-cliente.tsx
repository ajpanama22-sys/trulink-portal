import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function PortalCliente() {
  const router = useRouter();

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/");
  };

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
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "40px" }}>
      <style jsx>{`
        .card:hover { transform: scale(1.05); box-shadow: 0 0 30px #DAA520; }
        .logout-btn:hover { background-color: #DAA520 !important; color: #000 !important; }
      `}</style>

      {/* Botón de Cerrar Sesión */}
      <button
        onClick={handleLogout}
        className="logout-btn"
        style={{
          position: "absolute",
          top: "20px",
          right: "30px",
          backgroundColor: "transparent",
          color: "#DAA520",
          border: "1px solid #DAA520",
          padding: "8px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
          transition: "all 0.3s ease"
        }}
      >
        Cerrar Sesión
      </button>

      <h1 style={{ color: "#DAA520", marginBottom: "50px" }}>Seleccione Servicio</h1>

      <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Pedidos Especiales (Lado Izquierdo) */}
        <div className="card" style={cardStyle} onClick={() => router.push("/especiales")}>
          <img src="/images/especiales.jpg" alt="Pedidos Especiales" style={imgStyle} />
          <h2 style={{ color: "#DAA520" }}>Pedidos Especiales</h2>
        </div>

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