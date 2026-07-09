import nodemailer from 'nodemailer';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

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
        to: 'fred.jurado@trulinkfiber.com', // Correo donde quieres recibirlo
        subject: `Nueva solicitud: ${fields.empresa}`,
        text: `Empresa: ${fields.empresa}\nEmail: ${fields.email}\nTipo: ${fields.tipo_registro}`,
        attachments: fileData ? [{ filename: fileName, content: fileData }] : []
      });

      res.status(200).json({ message: 'Éxito total' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  req.pipe(busboy);
}
