// lib/accesoModulos.ts
//
// Controla qué ítems del Sidebar admin puede VER cada rol.
// No es autenticación (eso lo hace Supabase Auth) ni autorización de
// backend (eso debe reforzarse con RLS en Supabase) -- esto solo decide
// qué botones se muestran en el menú para no confundir/exponer módulos
// que no le corresponden a cada colaborador.
//
// "*" significa "visible para cualquier rol reconocido".
// Los roles deben escribirse EXACTAMENTE igual que en la columna `rol`
// de la tabla `colaboradores` (mayúsculas y tildes incluidas).

export const ACCESO_ITEMS: Record<string, string[] | "*"> = {
  // COMERCIAL
  validaciones: ["Super Administrador", "Administrador", "Ventas", "Soporte Técnico"],
  crm: ["Super Administrador", "Administrador", "Ventas"],
  marketing: ["Super Administrador", "Administrador", "Ventas"],

  // OPERACIONES & CADENA DE SUMINISTRO
  proveedores: ["Super Administrador", "Administrador"],
  manufactura: ["Super Administrador", "Administrador", "Producción"],
  inventario: ["Super Administrador", "Administrador", "Producción", "Bodega"],
  despachos: ["Super Administrador", "Administrador", "Bodega"],

  // FINANZAS (solo administración)
  "modulo-contable": ["Super Administrador", "Administrador"],
  "estado-cuenta": ["Super Administrador", "Administrador"],
  planilla: ["Super Administrador", "Administrador"],
  "planilla-empleados": ["Super Administrador", "Administrador"],
  "planilla-dispersion": ["Super Administrador", "Administrador"],

  // RECURSOS HUMANOS -- self-service, visible para TODOS los colaboradores
  rrhh: "*",

  // POSTVENTA
  rmas: ["Super Administrador", "Administrador", "Soporte Técnico"],

  // INTELIGENCIA DE NEGOCIO (solo administración)
  analitica: ["Super Administrador", "Administrador"],
  reportes: ["Super Administrador", "Administrador"],

  // CONFIGURACIÓN
  usuarios: ["Super Administrador", "Administrador"],
};

export function puedeVerItem(rol: string | null | undefined, itemKey: string): boolean {
  const regla = ACCESO_ITEMS[itemKey];
  if (!regla) return false; // ítem sin regla definida: oculto por defecto (seguro)
  if (regla === "*") return true;
  if (!rol) return false;
  return regla.includes(rol);
}