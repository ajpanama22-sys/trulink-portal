@AGENTS.md

# Sistema de diseño — Trulink Fiber Portal ("Circuito Dorado")

Estado: **migración completa**. Los 41 módulos del portal + `pages/admin/rrhh.tsx` (referencia original) ya usan el sistema de diseño compartido en `lib/theme.ts` y `lib/ui.tsx`. No hay órdenes de trabajo pendientes de estandarización — cualquier página nueva que se agregue de acá en adelante debe construirse directamente con estos componentes, no con estilos hardcodeados.

## Dónde vive

- `lib/theme.ts` — exporta `theme` (objeto de colores/tipografía/radios) y `pageWrapStyle()` (estilo del contenedor principal para páginas con Sidebar tipo admin).
- `lib/ui.tsx` — exporta los componentes: `Card`, `Heading`, `PageHeader`, `Button`, `Badge`, `estadoToTone`, `inputStyle`, `DataRow`.
- `pages/admin/rrhh.tsx` sigue siendo la referencia canónica de cómo se usan estos componentes en una página con Sidebar.

## `estadoToTone` — lista completa vigente

Traduce un string de estado (español, tal como viene de Supabase) al `tone` visual de `Badge`. Vive en `lib/ui.tsx`. Si aparece un estado nuevo en algún módulo, agregalo a la lista que corresponda ahí (no lo resuelvas con un `tone` hardcodeado en la página, salvo que genuinamente no sea un "estado" sino una categoría).

- **`success`**: `aprobado`, `aprobada`, `completado`, `activo`, `aceptado`, `activado`, `pagado`, `confirmado`, `liquidado`
- **`danger`**: `rechazado`, `rechazada`, `cancelado`, `cancelada`, `vencido`, `inactivo`, `anulado`
- **`gold`**: `pendiente`, `en_progreso`, `en progreso`, `en curso`, `por cobrar`, `pasivo operativo`
- **`neutral`**: cualquier otro valor (fallback)

## Excepciones documentadas (no son deuda pendiente, son a propósito)

- **`Card` no acepta prop `className`, solo `style`.** Si una página necesita `className` en el contenedor (por ejemplo para animaciones CSS vía `<style jsx global>`, como el pulso dorado de `checkout.tsx`/`fabricacion.tsx`), no fuerces `Card` — dejá un `<div>` nativo con el estilo base replicado o envolvé el `Card` en un `<div className="...">` externo. Es una limitación real del componente, no un error de migración.
- **`pages/admin/Sidebar.tsx` y `pages/colaborador/Sidebar.tsx`** tienen su propio negro/dorado hardcodeado a propósito y **no** importan `lib/theme.ts`. Está bien así — no migrarlos.
- **`pages/_app.tsx`** es un wrapper sin UI propia (solo monta el árbol de la app). El sistema de diseño no aplica ahí.
- Las páginas públicas standalone (checkout, portal-cliente, productos, etc., sin Sidebar de admin) usan los tokens de `theme` y los componentes de `lib/ui.tsx` directamente, pero **no** usan `pageWrapStyle()` (esa función asume el layout de dos columnas con Sidebar).
- Las tablas (`<table>`) no tienen componente equivalente en `lib/ui.tsx` — se dejan nativas, coloreadas con tokens de `theme.*`.
