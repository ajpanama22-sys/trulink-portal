import { createClient } from '@supabase/supabase-js';

// Obtenemos los valores de forma segura. 
// Si no están, devolvemos un string vacío para que el build no explote.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.url';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Inicializamos el cliente. Si las variables son falsas (placeholder), 
// el cliente se creará pero fallará en tiempo de ejecución (que es lo que queremos para el build).
export const getSupabase = () => {
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Exportamos una instancia para uso general
export const supabase = getSupabase();
