// =============================================================
// lib/cotizadorEngine.ts
// Motor de cálculo de cotizaciones — fuente única de verdad.
//
// Extraído de pages/fabricacion.tsx (cables a medida) y
// pages/productos.tsx (catálogo de productos terminados), para que
// tanto el portal del cliente como el módulo manual de admin
// (Marketing > Cotizaciones) usen EXACTAMENTE la misma lógica de
// precios y de código de configuración. Si el día de mañana cambia
// un precio base o un recargo, se cambia acá una sola vez.
// =============================================================

export type TipoCable = "ASU" | "ADSS" | "FTTX";

export interface ItemCable {
  tipo: TipoCable;
  hilos: number;
  longitudKm: number;
  cantidad: number;
  precioMetro: number;
  precioCarrete: number;
  vano: number | null;
  conMensajero: boolean;
  configuracionCodigo: string;
}

export interface ItemProducto {
  SKU: string;
  nombre: string;
  cantidad: number;
  precio: number;
  descripcion?: string;
}

// Precios base por metro para fabricación — idénticos a fabricacion.tsx
export const PRECIOS_CABLE: Record<TipoCable, number> = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

// Recargos por configuración — en cero a propósito hasta definir costos
// reales (ver nota original en fabricacion.tsx).
export const RECARGO_VANO: Record<number, number> = { 100: 0, 120: 0, 150: 0 };
export const RECARGO_MENSAJERO = 0;

/**
 * Traduce la selección del cliente/admin al código de configuración que
 * usa la planta para saber qué receta aplicar y qué materia prima
 * descontar. Debe coincidir siempre con producto_configuraciones.
 */
export function codigoConfiguracion(tipo: TipoCable, vano: number | null, conMensajero: boolean): string {
  if (tipo === "FTTX") return conMensajero ? "FTTH-CM" : "FTTH-SM";
  return `${tipo}-${vano || 100}`;
}

/** Arma un ItemCable calculando precio por metro y por carrete. */
export function calcularItemCable(
  tipo: TipoCable,
  hilos: number,
  longitudKm: number,
  cantidad: number,
  vano: number | null = null,
  conMensajero: boolean = false
): ItemCable {
  const base = PRECIOS_CABLE[tipo] || 0;
  const precioMetro =
    base +
    (vano ? (RECARGO_VANO[vano] || 0) : 0) +
    (conMensajero ? RECARGO_MENSAJERO : 0);
  const precioCarrete = precioMetro * (longitudKm * 1000);

  return {
    tipo,
    hilos,
    longitudKm,
    cantidad,
    precioMetro,
    precioCarrete,
    vano,
    conMensajero,
    configuracionCodigo: codigoConfiguracion(tipo, vano, conMensajero),
  };
}

/** Texto corto de la configuración, igual al usado en fabricacion.tsx. */
export function detalleConfigCable(item: ItemCable): string {
  const partes: string[] = [`${item.longitudKm} km/carrete`];
  if (item.vano) partes.push(`vano ${item.vano} m`);
  if (item.conMensajero) partes.push("con mensajero");
  return partes.join(" · ");
}

/** Total de una lista de items de cable. */
export function totalItemsCable(items: ItemCable[]): number {
  return items.reduce((acc, item) => acc + item.precioCarrete * item.cantidad, 0);
}

/** Total de una lista de items de producto terminado. */
export function totalItemsProducto(items: ItemProducto[]): number {
  return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
}

/** Formatea los items de cable al mismo shape que guarda quotes.items. */
export function formatearItemsCableParaQuotes(items: ItemCable[]) {
  return items.map((item) => ({
    SKU: item.tipo,
    descripcion:
      `Cable ${item.tipo} - ${item.hilos} hilos (${item.longitudKm}km)` +
      (item.vano ? ` - vano ${item.vano}m` : "") +
      (item.conMensajero ? " - con mensajero" : ""),
    cantidad: item.cantidad,
    precioUnitario: item.precioCarrete,
    total: item.precioCarrete * item.cantidad,
    hilos: item.hilos,
    longitudKm: item.longitudKm,
    vano: item.vano,
    con_mensajero: item.conMensajero,
    configuracion_codigo: item.configuracionCodigo,
  }));
}

/** Formatea los items de producto terminado al shape de quotes.items. */
export function formatearItemsProductoParaQuotes(items: ItemProducto[]) {
  return items.map((item) => ({
    SKU: item.SKU,
    descripcion: item.nombre || item.descripcion,
    cantidad: item.cantidad,
    precioUnitario: item.precio,
    total: item.precio * item.cantidad,
  }));
}

/** Calcula la fecha estimada de entrega (hoy + 3 días), igual al resto del sistema. */
export function calcularFechaEntrega(): string {
  const hoy = new Date();
  hoy.setDate(hoy.getDate() + 3);
  return hoy.toISOString().split("T")[0];
}

/** Genera una referencia única con el mismo formato QT-XXXXXX-NNN. */
export function generarReferencia(): string {
  const timestamp = Date.now().toString().slice(-6);
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `QT-${timestamp}-${randomNum}`;
}