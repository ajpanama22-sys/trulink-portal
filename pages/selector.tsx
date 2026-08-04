import type { CSSProperties } from "react";
import { useRouter } from "next/router";
import { theme } from "../lib/theme";
import { Button } from "../lib/ui";

// Estilo de las tarjetas de selección (se apoya en el Button del
// sistema de diseño, sólo se agranda para que luzca como opción grande)
const optionButtonStyle: CSSProperties = {
  padding: "40px",
  borderRadius: theme.radiusLg,
  width: "350px",
  fontSize: "22px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

export default function Selector() {
  const router = useRouter();

  return (
    <div
      style={{
        backgroundColor: theme.background,
        color: theme.textLight,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px",
        fontFamily: theme.fontFamily,
      }}
    >
      {/* Estilos globales y efectos de interacción */}
      <style jsx>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
        }
        .card-option {
          transition: transform 0.4s ease, box-shadow 0.4s ease, background-color 0.4s ease;
        }
        .card-option:hover {
          transform: scale(1.08);
          box-shadow: 0 0 40px ${theme.gold};
          background-color: ${theme.panelBg};
        }
      `}</style>

      {/* Título Institucional */}
      <h1
        style={{
          color: theme.gold,
          marginBottom: "80px",
          fontSize: "3rem",
          textTransform: "uppercase",
          letterSpacing: "2px",
        }}
      >
        Unidad Operativa
      </h1>

      {/* Contenedor de Selección */}
      <div
        style={{
          display: "flex",
          gap: "60px",
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {/* Nivel Administrativo */}
        <div className="card-option">
          <Button
            variant="outline-gold"
            onClick={() => router.push("/admin")}
            style={optionButtonStyle}
          >
            Unidad Administrativa
          </Button>
        </div>

        {/* Nivel Usuario / Cliente */}
        <div className="card-option">
          <Button
            variant="outline-gold"
            onClick={() => router.push("/portal-cliente")}
            style={optionButtonStyle}
          >
            Unidad de Usuario / Cliente
          </Button>
        </div>
      </div>

      {/* Footer Institucional */}
      <p
        style={{
          marginTop: "120px",
          fontSize: "12px",
          color: theme.gold,
          borderTop: `1px solid ${theme.gold}`,
          paddingTop: "20px",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        © 2026 Marca registrada – Trulink Fiber LLC – Acceso exclusivo Superuser
      </p>
    </div>
  );
}
