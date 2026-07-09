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
      return res.status(500).json({ message: 'Error al procesar los datos' });
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

      // Extraer valores de forma segura si vienen como arrays
      const getValue = (val) => (Array.isArray(val) ? val[0] : val);

      const mailOptions = {
        from: '"Portal B2B" <no-reply@trulinkfiber.org>',
        to: 'contacto@trulinkfiber.org',
        subject: `Nueva solicitud: ${getValue(fields.tipo_registro)}`,
        text: `Nueva solicitud recibida:\n
        Empresa: ${getValue(fields.empresa)}\n
        Representante: ${getValue(fields.representante)}\n
        Email: ${getValue(fields.email)}\n
        Teléfono: ${getValue(fields.telefono)}\n
        Web: ${getValue(fields.website)}\n
        ID Fiscal: ${getValue(fields.fiscal_id) || 'N/A'}`
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: 'Enviado correctamente' });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Error al enviar el correo' });
    }
  });
}
