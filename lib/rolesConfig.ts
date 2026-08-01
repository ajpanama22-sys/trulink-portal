// lib/rolesConfig.ts
//
// Fuente única de verdad para roles, jerarquías y permisos.
// Usado por: pages/admin/admin-usuarios.tsx, pages/Login.tsx,
// pages/colaborador/* (portal self-service).
//
// Nivel más bajo = más privilegios (1 = máximo).
// Jerarquía 1-2 -> acceso al panel /admin
// Jerarquía 3-4 -> acceso al portal self-service /colaborador

export const ROLES_CONFIG: Record<
  string,
  { jerarquia: number; permisos: string[]; descripcion: string }
> = {
  "Super Administrador": {
    jerarquia: 1,
    permisos: ["gestionar_usuarios", "gestionar_roles", "ver_auditoria", "acceso_total"],
    descripcion: "Acceso total, incluida la gestión de otros administradores",
  },
  "Administrador": {
    jerarquia: 2,
    permisos: ["gestionar_usuarios", "ver_auditoria", "gestionar_pedidos", "gestionar_cotizaciones"],
    descripcion: "Gestión operativa completa: usuarios, pedidos, cotizaciones y reportes",
  },
  "Ventas": {
    jerarquia: 3,
    permisos: ["ver_pedidos", "gestionar_cotizaciones"],
    descripcion: "Cotizaciones, pedidos y seguimiento de clientes",
  },
  "Soporte Técnico": {
    jerarquia: 3,
    permisos: ["ver_pedidos", "soporte_clientes"],
    descripcion: "Atención a clientes y resolución de incidencias",
  },
  "Producción": {
    jerarquia: 3,
    permisos: ["ver_manufactura", "actualizar_manufactura"],
    descripcion: "Órdenes de manufactura y estado de producción",
  },
  "Bodega": {
    jerarquia: 3,
    permisos: ["ver_despachos", "actualizar_despachos"],
    descripcion: "Despachos e inventario",
  },
  "Utility": {
    jerarquia: 4,
    permisos: ["acceso_basico"],
    descripcion: "Acceso básico de solo lectura",
  },
};

// Jerarquía máxima (inclusive) que todavía tiene acceso al panel /admin.
// Cualquier rol con jerarquía mayor a esta constante va al portal /colaborador.
export const JERARQUIA_MAXIMA_ADMIN = 2;

export function obtenerJerarquia(rol: string | null | undefined): number {
  if (!rol) return 99;
  return ROLES_CONFIG[rol]?.jerarquia ?? 99;
}

export function tieneAccesoAdmin(rol: string | null | undefined): boolean {
  return obtenerJerarquia(rol) <= JERARQUIA_MAXIMA_ADMIN;
}

export function destinoSegunRol(rol: string | null | undefined): "/admin" | "/colaborador" {
  return tieneAccesoAdmin(rol) ? "/admin" : "/colaborador";
}
