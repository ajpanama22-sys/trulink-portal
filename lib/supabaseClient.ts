import { createClient } from '@supabase/supabase-js';

// Si esto falla, es porque Vercel no tiene las variables en su configuración
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR CRÍTICO: Las variables de entorno de Supabase no están definidas en Vercel.");
}

export const getSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no está configurado. Revisa tus variables en Vercel.");
  }
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
