// lib/verificarSesionCliente.ts
//
// Helper de autenticación para rutas /api/* que deben ser llamadas por
// CLIENTES del portal B2B (no colaboradores/admin). Es el equivalente de
// verificarSesionAdmin.ts, pero valida contra la tabla "clientes" en vez
// de "colaboradores", y no exige ningún rol específico — solo que exista
// una sesión válida y que el cliente esté activo.
//
// A diferencia de useRequiereCliente.ts (que es un guard de UX en el
// navegador), esto SÍ es la barrera de seguridad real del lado servidor.
//
// Uso dentro de cualquier pages/api/*.ts que un cliente pueda llamar:
//
//   const auth = await verificarSesionCliente(req);
//   if (!auth.autorizado) {
//     return res.status(auth.status).json({ error: auth.mensaje });
//   }
//   // auth.email, auth.clienteId disponibles de aquí en adelante

import type { NextApiRequest } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Cliente con service role: necesario para validar el token de OTRO usuario
// y para leer la tabla clientes sin depender de RLS del lado cliente.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface ResultadoAuthCliente {
  autorizado: boolean;
  status: number;
  mensaje: string;
  email: string | null;
  clienteId: string | null;
}

export async function verificarSesionCliente(req: NextApiRequest): Promise<ResultadoAuthCliente> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { autorizado: false, status: 401, mensaje: "Falta token de sesión", email: null, clienteId: null };
  }

  // 1. Validar el token contra Supabase Auth
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user?.email) {
    return { autorizado: false, status: 401, mensaje: "Sesión inválida o expirada", email: null, clienteId: null };
  }

  const email = userData.user.email;

  // 2. Confirmar que el email corresponde a un cliente activo
  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from("clientes")
    .select("id, status")
    .ilike("email", email)
    .maybeSingle();

  if (clienteError || !cliente) {
    return { autorizado: false, status: 403, mensaje: "No es un cliente registrado", email, clienteId: null };
  }

  if (cliente.status !== "activo") {
    return { autorizado: false, status: 403, mensaje: "Cuenta de cliente suspendida o pendiente", email, clienteId: String(cliente.id) };
  }

  return { autorizado: true, status: 200, mensaje: "OK", email, clienteId: String(cliente.id) };
}
