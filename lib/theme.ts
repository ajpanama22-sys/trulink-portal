// ============================================================
// THEME.TS — Fuente única de verdad para el look del portal
// Navy + circuitos + dorado metálico (estilo "Admin Panel" Trulink)
// Importar desde cualquier página: import { theme, circuitBg } from "../../lib/theme";
// ============================================================

export const theme = {
  // Fondo
  navyDark: "#0a1526",
  navyMid: "#0f1f3d",
  navyCard: "rgba(13, 27, 51, 0.88)",
  navyCardHover: "rgba(18, 35, 64, 0.95)",
  navyInput: "rgba(6, 14, 28, 0.8)",

  // Dorado
  gold: "#DAA520",
  goldBright: "#FFD700",
  goldGlow: "rgba(218, 165, 32, 0.35)",

  // Texto
  textLight: "#E8ECF5",
  textMuted: "#9FB0C9",

  // Estados / semántica
  green: "#2ecc71",
  red: "#e74c3c",

  // Radios y espaciados estándar
  radiusCard: 14,
  radiusButton: 10,
  radiusPill: 999,
} as const;

// Tipografía estándar del portal — usar en _app.tsx o globals.css:
// Encabezados: Montserrat / Poppins (bold, letter-spacing amplio, mayúsculas)
// Cuerpo: Inter / system-ui (regular)
// Si el portal ya tiene una fuente definida en _app.tsx, mantenerla; esto es solo
// una recomendación si aún no hay una elegida.
export const fontStack = {
  heading: `"Poppins", "Montserrat", sans-serif`,
  body: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
};

// Patrón de circuitos hexagonales de fondo, en dorado muy tenue
const circuitPatternSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'><g fill='none' stroke='rgba(218,165,32,0.10)' stroke-width='1'><path d='M30 0 L60 17.3 L60 51.9 L30 69.2 L0 51.9 L0 17.3 Z'/><path d='M90 0 L120 17.3 L120 51.9 L90 69.2 L60 51.9 L60 17.3 Z'/><path d='M30 69.2 L60 86.5 L60 121 L30 138 L0 121 L0 86.5 Z'/></g></svg>`;
export const circuitBg = `url("data:image/svg+xml,${encodeURIComponent(circuitPatternSVG)}")`;

// Estilo base para el contenedor de cada página (al lado del Sidebar)
export function pageWrapStyle(): React.CSSProperties {
  return {
    flex: 1,
    minHeight: "100vh",
    backgroundImage: `${circuitBg}, linear-gradient(160deg, ${theme.navyDark} 0%, ${theme.navyMid} 100%)`,
    backgroundRepeat: "repeat, no-repeat",
    color: theme.textLight,
    padding: "36px 40px",
    boxSizing: "border-box",
    fontFamily: fontStack.body,
  };
}
