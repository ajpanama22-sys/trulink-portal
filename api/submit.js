import nodemailer from 'nodemailer';
import { IncomingForm } from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error al parsear el formulario:', err);
      return res.status(500).json({ message: 'Error al procesar el archivo' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });

    try {
      // Preparar el cuerpo del correo
      const mailOptions = {
        from: '"Portal B2B" <no-reply@trulinkfiber.org>',
        to: 'contacto@trulinkfiber.org',
        subject: `Nueva solicitud de registro: ${fields.tipo_registro}`,
        text: `Se ha recibido una nueva solicitud con los siguientes datos:\n
        Empresa: ${fields.empresa}\n
        Representante: ${fields.representante}\n
        Email: ${fields.email}\n
        Teléfono: ${fields.telefono}\n
        Web: ${fields.website}\n
        ID Fiscal: ${fields.fiscal_id || 'N/A'}`,
      };

      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: 'Solicitud enviada correctamente' });
    } catch (error) {
      console.error('Error al enviar correo con Brevo:', error);
      res.status(500).json({ message: 'Error interno al enviar el correo' });
    }
  });
}
