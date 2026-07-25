import { getSupabase } from "../lib/supabaseClient";

export const uploadAndLinkDocument = async (
  file: File, 
  categoria: string, 
  recordId: string, 
  tabla: string, 
  bucketName: string = "registros" // Por defecto usará "registros", protegiendo a "documentos"
) => {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error("Cliente de Supabase no inicializado");
  }

  // Limpiar el nombre del archivo para evitar caracteres extraños y asegurar unicidad
  const fileExt = file.name.split('.').pop() || '';
  const cleanNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const cleanFileName = cleanNameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Ruta organizada dentro del bucket correspondiente (ej: b2b/12_cedula_1719321.pdf)
  const rutaArchivo = `${categoria}/${recordId}_${cleanFileName}_${uniqueSuffix}.${fileExt}`;
  
  const { data: storageData, error: uploadError } = await supabase.storage
    .from(bucketName) // <--- Usa dinámicamente "registros" (o el que le pases) sin tocar "documentos"
    .upload(rutaArchivo, file, { upsert: false });

  if (uploadError) throw uploadError;

  return {
    path: storageData.path,
    fullPath: rutaArchivo,
    name: file.name
  };
};