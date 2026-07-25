import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Desactivar para manejar multipart/form-data con formidable
  },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const form = new IncomingForm({ keepExtensions: true, multiples: true });

  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) {
      return res.status(500).json({ error: 'Error al procesar el formulario: ' + err.message });
    }

    try {
      const recordId = fields.recordId ? fields.recordId[0] : '';
      const categoria = fields.categoria ? fields.categoria[0] : 'b2b';
      
      // Manejar tanto si viene un archivo único como un arreglo de archivos
      let uploadedFiles = files.files;
      if (!uploadedFiles) {
        uploadedFiles = [];
      } else if (!Array.isArray(uploadedFiles)) {
        uploadedFiles = [uploadedFiles];
      }

      let rutasArchivos: string[] = [];

      for (const file of uploadedFiles) {
        const fileBuffer = fs.readFileSync(file.filepath);
        const timestamp = Date.now();
        const originalName = file.originalFilename || 'archivo';
        const limpiarNombre = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = `${categoria}/${recordId}_${timestamp}_${limpiarNombre}`;

        // Sube utilizando credenciales de servidor (evita bloqueos de RLS)
        const { error: uploadError } = await supabase.storage
          .from('registros')
          .upload(filePath, fileBuffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error al subir en servidor:', uploadError);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('registros')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          rutasArchivos.push(publicUrlData.publicUrl);
        }
      }

      // Actualizamos directamente la tabla solicitudes_acceso con las URLs
      if (rutasArchivos.length > 0 && recordId) {
        await supabase
          .from('solicitudes_acceso')
          .update({ documento_url: rutasArchivos.join(', ') })
          .eq('id', recordId);
      }

      return res.status(200).json({ success: true, urls: rutasArchivos });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });
}