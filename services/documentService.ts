// services/documentService.ts
import { supabase } from "../lib/supabaseClient";

export const uploadAndLinkDocument = async (
  file: File, 
  categoria: string, 
  idEntidad: string, 
  tabla: string
) => {
  // 1. Crear ruta única
  const rutaArchivo = `${categoria}/${idEntidad}/${Date.now()}_${file.name}`;

  // 2. Subir a Storage
  const { data: storageData, error: uploadError } = await supabase.storage
    .from('registros')
    .upload(rutaArchivo, file);

  if (uploadError) throw uploadError;

  // 3. Vincular (Amarrar) en la base de datos
  const { error: dbError } = await supabase
    .from(tabla) // 'clientes' o 'inversores'
    .update({ documento_url: rutaArchivo })
    .eq('id', idEntidad);

  if (dbError) throw dbError;

  return { success: true, path: rutaArchivo };
};