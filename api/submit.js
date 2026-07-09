import nodemailer from 'nodemailer';
import { IncomingForm } from 'formidable';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: "Error al procesar" });

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });

    try {
      await transporter.sendMail({
        from: 'no-reply@trulinkfiber.org',
        to: 'contacto@trulinkfiber.org',
        subject: `Nueva solicitud: ${fields.tipo_registro}`,
        text: `Nueva solicitud recibida de: ${fields.empresa} (${fields.email})`
      });
      res.status(200).json({ message: "Éxito" });
    } catch (e) {
      res.status(500).json({ message: "Error de envío" });
    }
  });
}
