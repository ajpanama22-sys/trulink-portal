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
      // 1. Subir archivo a Supabase
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, fileBuffer, { contentType: mimeType });
      if (uploadError) throw new Error('Error al subir archivo');

      // 2. Guardar en Supabase
      const { error: dbError } = await supabase.from('solicitudes_acceso').insert([{
        tipo_solicitud: fields.tipo_registro,
        razon_social: fields.empresa,
        email: fields.email,
        estado: 'PENDIENTE',
        documento_url: fileName,
        datos_completos: fields 
      }]);
      if (dbError) throw new Error('Error al guardar datos');

      // 3. Enviar correo
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_API_KEY },
      });

      await transporter.sendMail({
        from: '"Portal B2B" <fred.jurado@trulinkfiber.com>',
        to: fields.email,
        subject: 'Confirmación de solicitud - Trulink Fiber',
        text: `Hola ${fields.representante}, hemos recibido su solicitud.`
      });

      res.status(200).json({ message: 'Solicitud guardada y procesada correctamente.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  req.pipe(busboy);
}
