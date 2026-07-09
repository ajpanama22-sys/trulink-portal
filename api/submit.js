import nodemailer from 'nodemailer';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import os from 'os';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

  // Configuramos el directorio temporal permitido por Vercel
  const form = new IncomingForm({
    uploadDir: os.tmpdir(),
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error de parseo:', err);
      return res.status(500).json({ message: 'Error procesando el formulario' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      });

      const f = (val) => (Array.isArray(val) ? val[0] : val);
      
      // Preparamos los adjuntos si existen
      const attachments = [];
      const file = files.archivo_adjunto ? f(files.archivo_adjunto) : null;
      
      if (file) {
        attachments.push({
          filename: file.originalFilename,
          path: file.filepath // Ruta temporal en /tmp
        });
      }

      await transporter.sendMail({
        from: '"Portal B2B" <no-reply@trulinkfiber.org>',
        to: 'contacto@trulinkfiber.org',
        subject: `Nueva solicitud con archivo: ${f(fields.tipo_registro)}`,
        text: `Empresa: ${f(fields.empresa)} | Email: ${f(fields.email)}`,
        attachments: attachments
      });

      // Limpieza: Borrar archivo temporal después de enviar
      if (file) fs.unlinkSync(file.filepath);

      return res.status(200).json({ message: 'Enviado con archivo' });
    } catch (error) {
      console.error('Error en envío:', error);
      return res.status(500).json({ message: 'Error al enviar email' });
    }
  });
}
