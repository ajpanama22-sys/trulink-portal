import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/* ============================================================
   POST /api/proveedores/crear-acceso
   ------------------------------------------------------------
   Crea (o resetea) el login del Vendor Portal para un proveedor
   ya homologado. Usa la SERVICE ROLE KEY — por eso vive en una
   API route de servidor y nunca en el cliente.

   Body: { proveedorId: string, email: string, password: string }

   Variables de entorno requeridas (agregar en .env.local / Vercel):
     NEXT_PUBLIC_SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY   ⚠️ nunca exponer con NEXT_PUBLIC_
   ============================================================ */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { proveedorId, email, password } = req.body || {};

  if (!proveedorId || !email || !password) {
    return res.status(400).json({ error: "Faltan proveedorId, email o password." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
  }

  try {
    // 1. Verificar que el proveedor exista y esté homologado
    const { data: proveedor, error: provError } = await supabaseAdmin
      .from("proveedores")
      .select("id, nombre, estado_homologacion, auth_user_id")
      .eq("id", proveedorId)
      .single();

    if (provError || !proveedor) {
      return res.status(404).json({ error: "Proveedor no encontrado." });
    }
    if (proveedor.estado_homologacion !== "Homologado") {
      return res.status(400).json({ error: "El proveedor debe estar homologado antes de crear su acceso." });
    }

    let authUserId = proveedor.auth_user_id;

    if (!authUserId) {
      // 2a. Crear usuario nuevo en Supabase Auth
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { rol: "proveedor", proveedor_id: proveedorId, nombre: proveedor.nombre },
      });
      if (createError) throw createError;
      authUserId = created.user.id;
    } else {
      // 2b. Ya existe: solo resetea la contraseña
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password });
      if (updateError) throw updateError;
    }

    // 3. Vincular auth_user_id y activar el portal
    const { error: linkError } = await supabaseAdmin
      .from("proveedores")
      .update({ auth_user_id: authUserId, portal_activo: true })
      .eq("id", proveedorId);
    if (linkError) throw linkError;

    return res.status(200).json({ ok: true, auth_user_id: authUserId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Error creando el acceso." });
  }
}
