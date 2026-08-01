// ============================================================
// UI.TSX — Componentes reutilizables del portal
// Importar desde cualquier página: import { Card, Button, Badge, Heading, Input, PageHeader } from "../../lib/ui";
// ============================================================
import React from "react";
import { theme, fontStack } from "./theme";

// ---------- Card ----------
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: theme.navyCard,
        border: `1.5px solid ${theme.gold}`,
        borderRadius: theme.radiusCard,
        padding: "22px 24px",
        boxShadow: `0 0 18px ${theme.goldGlow}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------- Heading (título dorado con glow, para encabezados de sección dentro de una Card) ----------
export function Heading({
  children,
  size = 15,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <h2
      style={{
        color: theme.goldBright,
        textShadow: `0 0 12px ${theme.goldGlow}`,
        fontWeight: 900,
        letterSpacing: "0.5px",
        fontSize: size,
        fontFamily: fontStack.heading,
        textTransform: "uppercase",
        margin: 0,
        marginBottom: 14,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

// ---------- PageHeader (título grande de página, como "VALIDACIÓN DE INSCRIPCIONES") ----------
export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 28,
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <div>
        <h1
          style={{
            color: theme.goldBright,
            textShadow: `0 0 14px ${theme.goldGlow}`,
            fontWeight: 900,
            fontSize: 30,
            fontFamily: fontStack.heading,
            letterSpacing: "0.5px",
            margin: 0,
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: theme.textMuted, margin: 0, fontSize: 14 }}>{subtitle}</p>
        )}
      </div>
      {badge}
    </div>
  );
}

// ---------- Button ----------
type ButtonVariant = "gold" | "outline-green" | "outline-red" | "outline-gold" | "ghost";

export function Button({
  children,
  onClick,
  disabled,
  variant = "gold",
  style,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: React.CSSProperties;
  type?: "button" | "submit";
}) {
  const base: React.CSSProperties = {
    borderRadius: theme.radiusButton,
    padding: "11px 18px",
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: "0.4px",
    cursor: disabled ? "not-allowed" : "pointer",
    textTransform: "uppercase",
    fontFamily: fontStack.heading,
    transition: "all 0.15s ease",
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    gold: {
      background: disabled
        ? "linear-gradient(180deg, #8a752f, #5f4f1f)"
        : `linear-gradient(180deg, ${theme.goldBright}, ${theme.gold})`,
      color: "#1a1200",
      border: `1px solid ${theme.gold}`,
      boxShadow: disabled ? "none" : `0 0 14px ${theme.goldGlow}`,
    },
    "outline-green": {
      background: "transparent",
      border: `1.5px solid ${theme.green}`,
      color: theme.green,
    },
    "outline-red": {
      background: "transparent",
      border: `1.5px solid ${theme.red}`,
      color: theme.red,
    },
    "outline-gold": {
      background: "transparent",
      border: `1.5px solid ${theme.gold}`,
      color: theme.gold,
    },
    ghost: {
      background: "transparent",
      border: "none",
      color: theme.goldBright,
      textDecoration: "underline",
      textTransform: "none",
      fontWeight: 700,
      padding: 0,
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

// ---------- Badge / Pill (para estados: pendiente, aprobado, rechazado, etc.) ----------
type BadgeTone = "gold" | "green" | "red" | "muted";

export function Badge({ children, tone = "gold" }: { children: React.ReactNode; tone?: BadgeTone }) {
  const colors: Record<BadgeTone, string> = {
    gold: theme.gold,
    green: theme.green,
    red: theme.red,
    muted: theme.textMuted,
  };
  const color = colors[tone];
  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${color}`,
        color,
        borderRadius: theme.radiusPill,
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        fontFamily: fontStack.heading,
      }}
    >
      {children}
    </span>
  );
}

// Mapea un estado de texto libre (pendiente/aprobado/rechazado/completado/en_progreso...) a un tono
export function estadoToTone(estado: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    pendiente: "gold",
    en_progreso: "gold",
    aprobado: "green",
    completado: "green",
    rechazado: "red",
  };
  return map[estado] ?? "muted";
}

// ---------- Input / Select / Textarea (estilo unificado) ----------
export const inputStyle: React.CSSProperties = {
  background: theme.navyInput,
  border: `1px solid ${theme.gold}`,
  borderRadius: 8,
  padding: "9px 12px",
  color: theme.textLight,
  fontSize: 13,
  outline: "none",
  fontFamily: fontStack.body,
};

// ---------- Fila de datos (label / valor) para tabs tipo "Perfil" ----------
export function DataRow({ label, valor }: { label: string; valor: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(218,165,32,0.2)",
        paddingBottom: 10,
      }}
    >
      <span style={{ color: theme.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: theme.textLight, fontWeight: 700, fontSize: 13 }}>{valor}</span>
    </div>
  );
}
