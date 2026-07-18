import { createClient } from '@supabase/supabase-js';

// ESTO ES SOLO PARA PROBAR. SI FUNCIONA, EL PROBLEMA SON LAS VARIABLES DE VERCEL.
// CAMBIA LOS VALORES POR TUS LLAVES REALES (BORRA ESTO DESPUÉS DE PROBAR)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "TU_URL_AQUÍ";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "TU_KEY_AQUÍ";

export const getSupabase = () => {
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = getSupabase();
