import { createClient } from '@supabase/supabase-js';
import Busboy from 'busboy';
import nodemailer from 'nodemailer';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  let fileBuffer = null;
  let fileName = '';
  let mimeType = '';

  busboy.on('field', (name, val) => { fields[name] = val; });
  busboy.on('file', (name, file, info) => {
    fileName = `${Date.now()}_${info.filename}`;
    mimeType = info.mimeType;
    const chunks = [];
    file.on('data', (data) => chunks.push(data));
    file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
  });

  busboy.on('finish', async () => {
    try {
      // 1. Subir archivo a Storage
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, fileBuffer, { contentType: mimeType });
      if (uploadError) throw uploadError;

      // 2. Insertar datos en la tabla
      const { error: dbError } = await supabase.from('solicitudes_acceso').insert([{
        tipo_solicitud: fields.tipo_registro,
        razon_social: fields.empresa,
        email: fields.email,
        estado: 'PENDIENTE',
        documento_url: fileName,
        datos_completos: fields 
      }]);
      if (dbError) throw dbError;

      // 3. ENVIAR CORREO (Añadido nuevamente)
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_API_KEY,
        },
      });

      await transporter.sendMail({
        from: '"Portal B2B" <fred.jurado@trulinkfiber.com>',
        to: fields.email,
        subject: 'Confirmación de solicitud - Trulink Fiber',
        text: `Estimado/a ${fields.representante}, hemos recibido su solicitud correctamente.`
      });

      res.status(200).json({ message: 'Solicitud guardada y correo enviado con éxito' });
      
    } catch (err) {
      console.error('Error detallado:', err);
      res.status(500).json({ error: err.message });
    }
  });

  req.pipe(busboy);
}
