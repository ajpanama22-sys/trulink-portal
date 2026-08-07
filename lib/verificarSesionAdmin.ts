// lib/verificarSesionAdmin.ts
//
// Helper de autenticación para rutas /api/* del panel admin.
// A diferencia de useRequiereRol.ts (que es un guard de UX en el navegador),
// esto SÍ es la barrera de seguridad real: valida el token de sesión contra
// Supabase del lado del servidor y confirma que el colaborador esté activo
// y tenga uno de los roles permitidos.
//
// Uso dentro de cualquier pages/api/*.ts:
//
//   const auth = await verificarSesionAdmin(req, ["Super Administrador", "Administrador"]);
//   if (!auth.autorizado) {
//     return res.status(auth.status).json({ error: auth.mensaje });
//   }
//   // auth.email, auth.rol disponibles de aquí en adelante

import type { NextApiRequest } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Cliente con service role: necesario para validar el token de OTRO usuario
// y para leer la tabla colaboradores sin depender de RLS del lado cliente.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface ResultadoAuth {
  autorizado: boolean;
  status: number;
  mensaje: string;
  email: string | null;
  rol: string | null;
}

export async function verificarSesionAdmin(
  req: NextApiRequest,
  rolesPermitidos: string[]
): Promise<ResultadoAuth> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { autorizado: false, status: 401, mensaje: "Falta token de sesión", email: null, rol: null };
  }

  // 1. Validar el token contra Supabase Auth
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData?.user?.email) {
    return { autorizado: false, status: 401, mensaje: "Sesión inválida o expirada", email: null, rol: null };
  }

  const email = userData.user.email;

  // 2. Confirmar que es colaborador activo con rol permitido
  const { data: colaborador, error: colaboradorError } = await supabaseAdmin
    .from("colaboradores")
    .select("rol, activo")
    .eq("email", email)
    .single();

  if (colaboradorError || !colaborador) {
    return { autorizado: false, status: 403, mensaje: "No es un colaborador registrado", email, rol: null };
  }

  if (colaborador.activo === false) {
    return { autorizado: false, status: 403, mensaje: "Colaborador suspendido", email, rol: colaborador.rol };
  }

  if (!rolesPermitidos.includes(colaborador.rol)) {
    return { autorizado: false, status: 403, mensaje: "Rol sin permiso para esta acción", email, rol: colaborador.rol };
  }

  return { autorizado: true, status: 200, mensaje: "OK", email, rol: colaborador.rol };
}