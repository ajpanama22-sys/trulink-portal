import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR CRÍTICO: Las variables de entorno de Supabase no están definidas en Vercel.");
}

// Variable para almacenar la instancia única
let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no está configurado. Revisa tus variables en Vercel.");
  }
  
  // Si la instancia ya existe, se reutiliza (Singleton)
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  
  return supabaseInstance;
};

// Exportación directa segura reutilizando la misma instancia
export const supabase = (supabaseUrl && supabaseAnonKey) ? getSupabase() : null;