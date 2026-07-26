// lib/pricing.ts

export interface Producto {
  id: string;
  nombre: string;
  precio_lista_a?: number; // Precio para ISP
  precio_lista_b?: number; // Precio para Mayorista
  precio_lista_c?: number; // Precio para Integrador
  precio_lista_d?: number; // Precio Cliente Final
  precio_base?: number;
  [key: string]: any;
}

/**
 * Obtiene el precio aplicable al usuario activo.
 * Si no tiene lista asignada o falta la tarifa específica, 
 * recurre transparentemente a la LISTA D o precio_base.
 */
export function getPrecioCliente(producto: Producto): number {
  if (typeof window === "undefined") return producto.precio_base || 0;

  const storedUser = sessionStorage.getItem("trulink_user");
  let lista = "LISTA_D";

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      // Los super-administradores verán por defecto la LISTA A o precio base
      if (user.tipo === "admin") {
        lista = "LISTA_A";
      } else if (user.lista_precio) {
        lista = user.lista_precio;
      }
    } catch (e) {
      console.error("Error al obtener datos de sesión:", e);
    }
  }

  switch (lista) {
    case "LISTA_A":
      return producto.precio_lista_a ?? producto.precio_base ?? 0;
    case "LISTA_B":
      return producto.precio_lista_b ?? producto.precio_base ?? 0;
    case "LISTA_C":
      return producto.precio_lista_c ?? producto.precio_base ?? 0;
    case "LISTA_D":
    default:
      return producto.precio_lista_d ?? producto.precio_base ?? 0;
  }
}

/**
 * Formatea el número a formato moneda USD
 */
export function formatPrecioUSD(monto: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(monto);
}