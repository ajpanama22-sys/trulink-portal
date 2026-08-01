import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ⚠️ Este cliente usa la service_role key y puede saltarse RLS por completo.
// SOLO debe usarse en rutas de API (backend, /pages/api/...), NUNCA en
// componentes de React ni en cualquier código que corra en el navegador.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("ERROR CRÍTICO: faltan variables de entorno de Supabase (service role) en Vercel.");
}

let supabaseAdminInstance: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase admin no está configurado. Revisá SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  }

  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseAdminInstance;
};