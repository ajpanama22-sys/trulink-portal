import { getSupabase } from "../lib/supabaseClient";

export const uploadAndLinkDocument = async (file: File, categoria: string, recordId: string, tabla: string) => {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error("Cliente de Supabase no inicializado");
  }

  // Ahora TypeScript sabe que si llega aquí, supabase NO es null
  const rutaArchivo = `${categoria}/${recordId}/${file.name}`;
  
  const { data: storageData, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(rutaArchivo, file);

  if (uploadError) throw uploadError;

  // ... resto de tu código de inserción en base de datos
};
