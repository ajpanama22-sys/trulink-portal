import type { CSSProperties } from "react";

// =============================================================
// lib/theme.ts
// Sistema de diseño Trulink Fiber — Tema "Circuito Dorado"
// Fondo negro profundo + acentos dorados metálicos.
// Exporta `theme` (objeto) y `pageWrapStyle()` (función) porque
// ese es el contrato que ya usan las páginas existentes
// (rrhh.tsx, y en adelante manufactura/despachos/validaciones).
// =============================================================

// Degradado metálico dorado — categoría de menú activa y botones CTA sólidos
export const goldGradient =
  "linear-gradient(135deg, #F4D874 0%, #DAA520 45%, #B8860B 100%)";

export const theme = {
  // Fondos
  background: "#0A0A0A",
  panelBg: "#121212",
  sidebarBg: "#050505",
  inputBg: "#080808",

  // Dorado (marca)
  gold: "#DAA520",
  goldBright: "#F4D874",
  goldSoft: "rgba(218,165,32,0.08)",
  goldGradient,
  borderGold: "rgba(218,165,32,0.2)",
  borderGoldLight: "rgba(218,165,32,0.15)",
  borderGoldInput: "rgba(218,165,32,0.25)",
  borderGoldCounter: "rgba(218,165,32,0.35)",

  // Texto
  textLight: "#F8F8F8",
  textMuted: "#B8B8B8",

  // Semánticos
  green: "#2ECC71",
  greenBg: "rgba(46,204,113,0.1)",
  greenBorder: "rgba(46,204,113,0.4)",

  red: "#E74C3C",
  redBg: "rgba(231,76,60,0.1)",
  redBorder: "rgba(231,76,60,0.4)",

  neutral: "#B8B8B8",
  neutralBg: "rgba(184,184,184,0.08)",
  neutralBorder: "rgba(184,184,184,0.3)",

  // Tipografía / forma
  fontFamily: "'Montserrat', 'Inter', sans-serif",
  radiusSm: "8px",
  radiusMd: "10px",
  radiusLg: "12px",
  shadowCard: "0 6px 24px rgba(0,0,0,0.5)",
};

// Patrón de fondo "circuitos" reutilizable
const circuitBackgroundImage =
  "radial-gradient(circle at 20% 20%, rgba(218,165,32,0.03) 0%, transparent 50%), " +
  "radial-gradient(circle at 80% 80%, rgba(218,165,32,0.03) 0%, transparent 50%)";

// Estilo del contenedor principal de cada página (a la derecha del Sidebar).
// Se llama como función: `<div style={pageWrapStyle()}>`, y admite overrides:
// `pageWrapStyle({ maxWidth: 1100 })`
export function pageWrapStyle(overrides: CSSProperties = {}): CSSProperties {
  return {
    flex: 1,
    minHeight: "100vh",
    padding: "32px 40px",
    boxSizing: "border-box",
    color: theme.textLight,
    fontFamily: theme.fontFamily,
    backgroundColor: theme.background,
    backgroundImage: circuitBackgroundImage,
    ...overrides,
  };
}
