import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

// Configurar el transporte SMTP con Brevo
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { tipo, email, razon_social, link, to, subject, htmlContent } = req.body;

  let destinatario = '';
  let asunto = '';
  let contenidoHtml = '';

  // Caso 1: Envío directo genérico (usado por la página de pago exitoso)
  if (to && subject && htmlContent) {
    destinatario = to;
    asunto = subject;
    contenidoHtml = htmlContent;
  } 
  // Caso 2: Envío por tipo (activación o rechazo de cuentas)
  else if (tipo === 'ACTIVACION') {
    destinatario = email;
    asunto = '¡Tu cuenta ha sido activada - Trulink Fiber!';
    contenidoHtml = `
      <div style="font-family: sans-serif; background-color: #000; color: #fff; padding: 20px; border-radius: 10px;">
        <h2 style="color: #DAA520;">Hola, ${razon_social}</h2>
        <p>Tu solicitud de acceso ha sido aprobada con éxito.</p>
        <p>Para configurar tu contraseña y acceder al portal, haz clic en el siguiente enlace:</p>
        <a href="${link}" style="background-color: #DAA520; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block; margin-top: 15px;">Crear Contraseña</a>
        <p style="margin-top: 30px; color: #888; font-size: 0.9rem;">Trulink Fiber LLC</p>
      </div>
    `;
  } else if (tipo === 'RECHAZO') {
    destinatario = email;
    asunto = 'Actualización sobre tu solicitud - Trulink Fiber';
    contenidoHtml = `
      <div style="font-family: sans-serif; background-color: #000; color: #fff; padding: 20px; border-radius: 10px;">
        <h2 style="color: #DAA520;">Estimado/a, ${razon_social}</h2>
        <p>Lamentamos informarte que en este momento tu solicitud no pudo ser aprobada debido a que no cumple con todos los parámetros o documentación requerida.</p>
        <p style="margin-top: 30px; color: #888; font-size: 0.9rem;">Trulink Fiber LLC</p>
      </div>
    `;
  } else {
    return res.status(400).json({ error: 'Parámetros o tipo de correo no válido' });
  }

  try {
    const info = await transporter.sendMail({
      from: `"Trulink Fiber LLC" <${process.env.SMTP_FROM || 'fred.jurado@trulinkfiber.com'}>`,
      to: destinatario,
      subject: asunto,
      html: contenidoHtml,
    });

    console.log("Correo enviado con éxito via Brevo:", info.messageId);
    return res.status(200).json({ success: true, message: 'Correo enviado correctamente', messageId: info.messageId });
  } catch (error: any) {
    console.error('Error enviando correo SMTP:', error);
    return res.status(500).json({ error: error.message || 'Error al enviar el correo' });
  }
}