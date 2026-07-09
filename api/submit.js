import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { email, empresa, tipo_registro } = req.body;

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: 'b05854001@smtp-brevo.com',
      pass: process.env.BREVO_SMTP_KEY // Vercel leerá esto de tu configuración
    }
  });

  try {
    await transporter.sendMail({
      from: 'noreply@trulinkfiber.com',
      to: 'operaciones@trulinkfiber.com',
      subject: `Nueva solicitud: ${tipo_registro}`,
      text: `Empresa: ${empresa}\nContacto: ${email}`
    });
    return res.status(200).json({ message: 'Solicitud enviada' });
  } catch (error) {
    return res.status(500).json({ message: 'Error de envío' });
  }
}
