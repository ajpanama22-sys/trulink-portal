import { theme } from "../lib/theme";
import { Card, Heading, Button } from "../lib/ui";

export default function SmartQuote() {
  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.textLight,
      minHeight: "100vh",
      textAlign: "center",
      padding: "40px",
      fontFamily: theme.fontFamily,
    }}>

      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.textLight};
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px ${theme.gold}; }
          50% { box-shadow: 0 0 30px ${theme.gold}; }
          100% { box-shadow: 0 0 10px ${theme.gold}; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
        .hover-frame:hover {
          box-shadow: 0 0 30px ${theme.gold} !important;
          transform: scale(1.05);
        }
      `}</style>

      {/* Logo */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      {/* Nombre institucional */}
      <Heading style={{ fontSize: "2rem", marginBottom: "40px", justifyContent: "center" }}>
        SmartQuote - Trulink Fiber LLC
      </Heading>

      {/* Opciones principales en columnas */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "60px",
        flexWrap: "wrap",
        marginTop: "20px"
      }}>

        {/* Opción Fabricación */}
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: theme.sidebarBg,
            borderRadius: "30px",
            border: `2px solid ${theme.gold}`,
            width: "300px",
          }}
        >
          <div className="container-fiber" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img
              src="/images/fabrica.png"
              alt="Fabricación de Cables"
              className="hover-frame"
              style={{
                width: "100%",
                marginBottom: "20px",
                border: `2px solid ${theme.gold}`,
                borderRadius: "15px",
                transition: "all 0.3s ease-in-out"
              }}
            />
            <a href="/fabricacion" style={{ textDecoration: "none" }}>
              <Button variant="gold" style={{ padding: "15px 30px", borderRadius: "15px", fontSize: "16px" }}>
                Fabricación de Cables
              </Button>
            </a>
          </div>
        </Card>

        {/* Opción Productos Terminados */}
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: theme.sidebarBg,
            borderRadius: "30px",
            border: `2px solid ${theme.gold}`,
            width: "300px",
          }}
        >
          <div className="container-fiber" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img
              src="/images/terminado.png"
              alt="Productos Terminados"
              className="hover-frame"
              style={{
                width: "100%",
                marginBottom: "20px",
                border: `2px solid ${theme.gold}`,
                borderRadius: "15px",
                transition: "all 0.3s ease-in-out"
              }}
            />
            <a href="/productos" style={{ textDecoration: "none" }}>
              <Button variant="gold" style={{ padding: "15px 30px", borderRadius: "15px", fontSize: "16px" }}>
                Productos Terminados
              </Button>
            </a>
          </div>
        </Card>
      </div>

      {/* Footer institucional */}
      <p style={{ marginTop: "60px", fontSize: "12px", color: theme.gold }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
