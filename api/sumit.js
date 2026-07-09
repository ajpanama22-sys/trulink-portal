import nodemailer from 'nodemailer';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const busboy = Busboy({ headers: req.headers });
  const fields = {};

  busboy.on('field', (fieldname, val) => { fields[fieldname] = val; });
  busboy.on('finish', async () => {
    try {
      console.log("Intentando enviar correo a:", fields.email);
      
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      });

      const info = await transporter.sendMail({
        from: 'no-reply@trulinkfiber.org',
        to: fields.email || 'fred.jurado@trulinkfiber.com',
        subject: 'Prueba de envío',
        text: 'Si recibes esto, el backend funciona.'
      });

      console.log("Respuesta de Brevo:", info.messageId);
      return res.status(200).json({ message: 'Enviado a: ' + (fields.email || 'defecto') });
    } catch (error) {
      console.error("ERROR CRÍTICO:", error);
      return res.status(500).json({ message: 'Error interno: ' + error.message });
    }
  });

  req.pipe(busboy);
}
