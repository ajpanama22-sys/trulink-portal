// =============================================================
// lib/ui.tsx
// Componentes reutilizables del portal — Tema "Circuito Dorado"
// Contrato compatible con rrhh.tsx (ya en producción):
//   Card, Heading, PageHeader, Button, Badge, estadoToTone,
//   inputStyle, DataRow (con prop `valor`, no `value`).
// =============================================================

import React from "react";
import type { CSSProperties } from "react";
import { theme, goldGradient } from "./theme";

// -------------------------------------------------------------
// Estilos base (algunos también se exportan sueltos, ej. inputStyle,
// porque rrhh.tsx los usa directo en <select>/<input>/<textarea>)
// -------------------------------------------------------------

export const inputStyle: CSSProperties = {
  background: theme.inputBg,
  color: theme.textLight,
  border: `1px solid ${theme.borderGoldInput}`,
  borderRadius: theme.radiusSm,
  padding: "8px 12px",
  fontSize: "0.88rem",
  outline: "none",
};

const cardBaseStyle: CSSProperties = {
  background: theme.panelBg,
  border: `1px solid ${theme.borderGoldLight}`,
  borderRadius: theme.radiusLg,
  padding: "25px",
  marginBottom: "20px",
  boxShadow: theme.shadowCard,
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "30px",
  borderBottom: `1px solid ${theme.borderGoldLight}`,
  paddingBottom: "20px",
};

const titleStyle: CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  color: theme.gold,
  margin: 0,
  letterSpacing: "2px",
};

// -------------------------------------------------------------
// Card / Heading — aceptan `style` para mezclar con el estilo base
// -------------------------------------------------------------

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...cardBaseStyle, ...style }}>{children}</div>;
}

export function Heading({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <h2
      style={{
        color: theme.gold,
        fontFamily: theme.fontFamily,
        fontWeight: 700,
        fontSize: "1.1rem",
        margin: "0 0 12px 0",
        letterSpacing: "0.5px",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

// -------------------------------------------------------------
// PageHeader — título + subtítulo opcional + contador opcional
// -------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  counterLabel,
}: {
  title: string;
  subtitle?: string;
  counterLabel?: string;
}) {
  return (
    <div style={headerRowStyle}>
      <div>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle ? (
          <p style={{ color: theme.textMuted, fontSize: "0.9rem", margin: "8px 0 0 0" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {counterLabel ? (
        <span
          style={{
            background: "rgba(218,165,32,0.12)",
            border: `1px solid ${theme.borderGoldCounter}`,
            padding: "10px 22px",
            borderRadius: theme.radiusSm,
            color: theme.gold,
            fontWeight: 700,
            fontSize: "0.9rem",
            letterSpacing: "1px",
          }}
        >
          {counterLabel}
        </span>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------
// Button — variantes usadas por las páginas actuales:
// "gold" (sólido, acción primaria / tab activo)
// "outline-gold" (tab inactivo)
// "outline-green" / "outline-red" (acciones semánticas, ej. Marcaje)
// "ghost" (acción secundaria discreta)
// -------------------------------------------------------------

type ButtonVariant = "gold" | "outline-gold" | "outline-green" | "outline-red" | "ghost";

const btnBase: CSSProperties = {
  padding: "10px 24px",
  borderRadius: theme.radiusSm,
  fontWeight: 700,
  fontSize: "0.85rem",
  letterSpacing: "0.5px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  gold: {
    ...btnBase,
    background: goldGradient,
    color: "#1A1400",
    border: `1px solid ${theme.gold}`,
    boxShadow: "0 2px 10px rgba(218,165,32,0.3)",
  },
  "outline-gold": {
    ...btnBase,
    background: theme.goldSoft,
    color: theme.gold,
    border: `1px solid ${theme.borderGoldLight}`,
  },
  "outline-green": {
    ...btnBase,
    background: theme.greenBg,
    color: theme.green,
    border: `1px solid ${theme.greenBorder}`,
  },
  "outline-red": {
    ...btnBase,
    background: theme.redBg,
    color: theme.red,
    border: `1px solid ${theme.redBorder}`,
  },
  ghost: {
    ...btnBase,
    background: "transparent",
    color: theme.gold,
    border: "1px solid transparent",
    padding: "6px 12px",
  },
};

export function Button({
  children,
  variant = "gold",
  onClick,
  type = "button",
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variantStyles[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// -------------------------------------------------------------
// Badge + estadoToTone
// -------------------------------------------------------------

type Tone = "gold" | "success" | "danger" | "neutral";

export function Badge({ children, tone = "gold" }: { children: React.ReactNode; tone?: Tone }) {
  const toneMap: Record<Tone, { bg: string; border: string; color: string }> = {
    gold: { bg: theme.goldSoft, border: theme.borderGoldLight, color: theme.gold },
    success: { bg: theme.greenBg, border: theme.greenBorder, color: theme.green },
    danger: { bg: theme.redBg, border: theme.redBorder, color: theme.red },
    neutral: { bg: theme.neutralBg, border: theme.neutralBorder, color: theme.neutral },
  };
  const t = toneMap[tone];
  return (
    <span
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        borderRadius: theme.radiusSm,
        padding: "4px 12px",
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </span>
  );
}

// Traduce un estado de texto (español, como viene de la base de datos)
// al `tone` visual correspondiente. Ajusta esta lista si aparecen
// nuevos valores de `estado` en otras tablas/módulos.
export function estadoToTone(estado: string | undefined | null): Tone {
  const e = (estado ?? "").toLowerCase().trim();
  if (["aprobado", "aprobada", "completado", "activo", "aceptado", "activado", "pagado", "confirmado", "liquidado"].includes(e)) {
    return "success";
  }
  if (["rechazado", "rechazada", "cancelado", "cancelada", "vencido", "inactivo", "anulado"].includes(e)) {
    return "danger";
  }
  if (["pendiente", "en_progreso", "en progreso", "en curso", "por cobrar", "pasivo operativo"].includes(e)) {
    return "gold";
  }
  return "neutral";
}

// -------------------------------------------------------------
// DataRow — nota: la prop es `valor` (no `value`), para calzar con
// cómo ya la usa rrhh.tsx: <DataRow label="Nombre" valor={...} />
// -------------------------------------------------------------

export function DataRow({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: theme.textMuted, fontSize: "0.75rem", marginRight: 8 }}>
        {label}:
      </span>
      <span style={{ color: theme.textLight, fontSize: "0.88rem" }}>{valor}</span>
    </div>
  );
}