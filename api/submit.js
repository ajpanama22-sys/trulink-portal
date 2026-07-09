import nodemailer from 'nodemailer';
import { IncomingForm } from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

  const form = new IncomingForm({ multiples: false });

  form.parse(req, async (err, fields) => {
    if (err) {
      console.error('Error de parseo:', err);
      return res.status(500).json({ message: 'Error en parseo' });
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

      // Extracción simple
      const f = (val) => (Array.isArray(val) ? val[0] : val);

      await transporter.sendMail({
        from: '"Portal B2B" <no-reply@trulinkfiber.org>',
        to: 'contacto@trulinkfiber.org',
        subject: `Nueva solicitud: ${f(fields.tipo_registro)}`,
        text: `Empresa: ${f(fields.empresa)} | Email: ${f(fields.email)}`
      });

      return res.status(200).json({ message: 'Enviado correctamente' });
    } catch (error) {
      console.error('Error final:', error);
      return res.status(500).json({ message: 'Error de envío' });
    }
  });
}
