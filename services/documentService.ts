import { getSupabase } from "../lib/supabaseClient";

export const uploadAndLinkDocument = async (file: File, categoria: string, recordId: string, tabla: string) => {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error("Cliente de Supabase no inicializado");
  }

  const rutaArchivo = file.name;
  
  const { data: storageData, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(rutaArchivo, file);

  if (uploadError) throw uploadError;

  return storageData;
};