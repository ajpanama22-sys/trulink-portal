import { createClient } from '@supabase/supabase-js';

// Usamos una función para obtener el cliente, no una constante directa
export const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Solo mostramos error si intentamos usarlo, no durante el build
    console.error("Supabase no está configurado");
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = getSupabase();
