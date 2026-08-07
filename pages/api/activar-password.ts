import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Este endpoint corre SOLO en el servidor (nunca en el navegador).
// Usa la Service Role Key, que tiene permisos de administrador sobre Supabase Auth.
// NUNCA se debe exponer esta llave con el prefijo NEXT_PUBLIC_.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { token, password } = req.body || {};

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token no válido o ausente" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  if (!serviceRoleKey) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
    return res.status(500).json({ error: "Configuración del servidor incompleta. Contacta al administrador." });
  }

  try {
    // 1. Buscar al cliente por su password_token pendiente
    const { data: cliente, error: fetchError } = await supabaseAdmin
      .from("clientes")
      .select("id, email, status, password_token, password_token_expira")
      .eq("password_token", token)
      .maybeSingle();

    if (fetchError) {
      console.error("Error buscando cliente por token:", fetchError);
      return res.status(500).json({ error: "Error al validar el token" });
    }

    if (!cliente) {
      return res.status(400).json({ error: "Token inválido, expirado o ya utilizado" });
    }

    // Verificar expiración del token (72h desde su generación)
    if (cliente.password_token_expira && new Date(cliente.password_token_expira) < new Date()) {
      return res.status(400).json({ error: "El link de activación expiró. Solicita uno nuevo." });
    }

    if (cliente.status === "activo" && !cliente.password_token) {
      return res.status(400).json({ error: "Esta cuenta ya fue activada anteriormente. Inicia sesión normalmente." });
    }

    if (!cliente.email) {
      return res.status(400).json({ error: "El registro del cliente no tiene un email asociado" });
    }

    // 2. Verificar si el usuario ya existe en Supabase Auth (por si se reintenta el flujo)
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("Error listando usuarios de Auth:", listError);
    }
    const yaExisteEnAuth = existingUsers?.users?.some(
      (u) => (u.email || "").toLowerCase() === cliente.email.toLowerCase()
    );

    if (!yaExisteEnAuth) {
      // 3. Crear el usuario en Supabase Auth, ya confirmado (sin enviar correo de verificación)
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cliente.email,
        password,
        email_confirm: true,
      });

      if (createError) {
        console.error("Error creando usuario en Supabase Auth:", createError);
        return res.status(500).json({ error: "Error al crear la cuenta de acceso: " + createError.message });
      }
    } else {
      // Si ya existía en Auth (caso raro/reintento), actualizamos su password
      const existingUser = existingUsers!.users.find(
        (u) => (u.email || "").toLowerCase() === cliente.email.toLowerCase()
      );
      if (existingUser) {
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
        });
        if (updateAuthError) {
          console.error("Error actualizando password en Auth:", updateAuthError);
          return res.status(500).json({ error: "Error al actualizar la contraseña: " + updateAuthError.message });
        }
      }
    }

    // 4. Marcar al cliente como activo y limpiar el token
    const { error: updateError } = await supabaseAdmin
      .from("clientes")
      .update({ status: "activo", password_token: null, password_token_expira: null })
      .eq("id", cliente.id);

    if (updateError) {
      console.error("Error actualizando status del cliente:", updateError);
      return res.status(500).json({ error: "Cuenta creada, pero hubo un error actualizando el estado. Contacta soporte." });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("ERROR INESPERADO en activar-password:", err);
    return res.status(500).json({ error: err.message || "Error inesperado del servidor" });
  }
}
