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

// Este endpoint es público (lo usa el formulario de registro, antes de que
// el visitante tenga cuenta), así que no puede exigir sesión. Pero antes
// tampoco validaba nada: cualquiera podía mandar un "recordId" ajeno y
// sobreescribir los documentos de la solicitud de otra persona, incluso
// una ya aprobada o rechazada. Ahora se exige que el recordId corresponda
// a una solicitud real en estado "pendiente".
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB por archivo
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const form = new IncomingForm({
    keepExtensions: true,
    multiples: true,
    maxFileSize: TAMANO_MAXIMO_BYTES,
  });

  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) {
      return res.status(500).json({ error: 'Error al procesar el formulario: ' + err.message });
    }

    try {
      const recordId = fields.recordId ? fields.recordId[0] : '';
      const categoria = fields.categoria ? fields.categoria[0] : 'b2b';

      if (!recordId) {
        return res.status(400).json({ error: 'Falta el identificador de la solicitud' });
      }

      // Validar que el recordId corresponde a una solicitud real y pendiente.
      const { data: solicitud, error: solicitudError } = await supabase
        .from('solicitudes_acceso')
        .select('id, status')
        .eq('id', recordId)
        .maybeSingle();

      if (solicitudError) {
        console.error('Error validando la solicitud:', solicitudError);
        return res.status(500).json({ error: 'Error al validar la solicitud' });
      }

      if (!solicitud) {
        return res.status(404).json({ error: 'La solicitud indicada no existe' });
      }

      const estado = String(solicitud.status || '').trim().toLowerCase();
      if (estado && estado !== 'pendiente' && estado !== 'pending') {
        return res.status(400).json({ error: 'Esta solicitud ya fue procesada y no admite más documentos' });
      }

      // Manejar tanto si viene un archivo único como un arreglo de archivos
      let uploadedFiles = files.files;
      if (!uploadedFiles) {
        uploadedFiles = [];
      } else if (!Array.isArray(uploadedFiles)) {
        uploadedFiles = [uploadedFiles];
      }

      let rutasArchivos: string[] = [];

      for (const file of uploadedFiles) {
        // Validar tipo de archivo antes de subirlo.
        if (file.mimetype && !TIPOS_PERMITIDOS.includes(file.mimetype)) {
          console.warn(`Archivo rechazado por tipo no permitido: ${file.mimetype}`);
          continue;
        }

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

      if (rutasArchivos.length === 0) {
        return res.status(400).json({ error: 'Ningún archivo pudo subirse (tipo no permitido o error de almacenamiento)' });
      }

      // Actualizamos directamente la tabla solicitudes_acceso con las URLs
      await supabase
        .from('solicitudes_acceso')
        .update({ documento_url: rutasArchivos.join(', ') })
        .eq('id', recordId);

      return res.status(200).json({ success: true, urls: rutasArchivos });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });
}