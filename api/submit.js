import nodemailer from 'nodemailer';
import Busboy from 'busboy';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  let fileData = null;
  let fileName = '';

  busboy.on('field', (fieldname, val) => { fields[fieldname] = val; });
  busboy.on('file', (fieldname, file, info) => {
    fileName = info.filename;
    const chunks = [];
    file.on('data', (data) => chunks.push(data));
    file.on('end', () => { fileData = Buffer.concat(chunks); });
  });

  busboy.on('finish', async () => {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      });

      await transporter.sendMail({
        from: '"Portal B2B" <no-reply@trulinkfiber.org>',
        to: 'contacto@trulinkfiber.org',
        subject: `Nueva solicitud: ${fields.tipo_registro}`,
        text: `Empresa: ${fields.empresa} | Email: ${fields.email}`,
        attachments: fileData ? [{ filename: fileName, content: fileData }] : []
      });

      return res.status(200).json({ message: 'Éxito' });
    } catch (error) {
      return res.status(500).json({ message: 'Error de envío' });
    }
  });

  req.pipe(busboy);
}
   
