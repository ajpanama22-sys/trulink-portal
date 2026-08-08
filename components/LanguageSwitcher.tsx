import { useI18n } from "../lib/i18n/LanguageContext";
import { theme } from "../lib/theme";

// ============================================================
// SELECTOR DE IDIOMA — pill ES | EN, mismo lenguaje visual que
// los sellos de confianza del Home (borde dorado, fondo oscuro).
// Usalo en cualquier página: <LanguageSwitcher />
// ============================================================

export default function LanguageSwitcher({ style }: { style?: React.CSSProperties }) {
  const { idioma, setIdioma } = useI18n();

  const btnBase: React.CSSProperties = {
    padding: "4px 10px",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.5px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: "999px",
    transition: "all 0.2s ease",
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        border: `1px solid ${theme.borderGold || "rgba(218,165,32,0.4)"}`,
        borderRadius: "999px",
        padding: "3px",
        background: "rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setIdioma("es")}
        style={{
          ...btnBase,
          color: idioma === "es" ? "#000" : theme.gold,
          background: idioma === "es" ? theme.gold : "transparent",
        }}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setIdioma("en")}
        style={{
          ...btnBase,
          color: idioma === "en" ? "#000" : theme.gold,
          background: idioma === "en" ? theme.gold : "transparent",
        }}
      >
        EN
      </button>
    </div>
  );
}
