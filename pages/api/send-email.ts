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

  const { 
    tipo, 
    email, 
    razon_social, 
    link, 
    forma_pago_texto, 
    porcentaje_inicial, 
    porcentaje_saldo, 
    to, 
    subject, 
    htmlContent 
  } = req.body;

  let destinatario = '';
  let asunto = '';
  let contenidoHtml = '';

  // Caso 1: Envío directo genérico
  if (to && subject && htmlContent) {
    destinatario = to;
    asunto = subject;
    contenidoHtml = htmlContent;
  } 
  // Caso 2: Envío por tipo (activación de cuentas)
  else if (tipo === 'ACTIVACION') {
    destinatario = email;
    asunto = '¡Tu cuenta ha sido activada - Trulink Fiber!';
    
    // Respaldo usando tu dominio real si el link viene vacío
    const enlaceFinal = link || `https://portal.trulinkfiber.org/auth/crear-password`;

    contenidoHtml = `
      <div style="font-family: Arial, sans-serif; background-color: #080808; color: #ffffff; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(218, 165, 32, 0.3);">
        <h2 style="color: #DAA520; margin-top: 0; font-size: 1.5rem; letter-spacing: 0.5px;">¡Tu cuenta ha sido activada!</h2>
        <p style="font-size: 0.95rem; color: #e0e0e0;">Estimado/a <strong>${razon_social}</strong>,</p>
        <p style="color: #ccc; line-height: 1.5; font-size: 0.9rem;">Nos complace informarte que tu solicitud de acceso al portal de clientes de <strong>Trulink Fiber LLC</strong> ha sido aprobada con éxito.</p>
        
        ${forma_pago_texto ? `
        <div style="background-color: #111111; border: 1px solid #222; border-left: 4px solid #DAA520; padding: 16px 20px; margin: 25px 0; border-radius: 6px;">
          <h4 style="color: #DAA520; margin: 0 0 8px 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">Condiciones Comerciales de Pago Asignadas:</h4>
          <p style="margin: 0; font-size: 0.9rem; color: #ddd; line-height: 1.4;">${forma_pago_texto}</p>
          
          ${(porcentaje_inicial !== undefined && porcentaje_saldo !== undefined) ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #222; font-size: 0.85rem; color: #aaa; display: flex; gap: 20px;">
            <span>Anticipo Inicial: <strong style="color: #DAA520;">${porcentaje_inicial}%</strong></span>
            <span>Saldo Final: <strong style="color: #2ecc71;">${porcentaje_saldo}%</strong></span>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <p style="color: #ccc; font-size: 0.9rem;">Para establecer tu contraseña de acceso y habilitar tu cuenta comercial, por favor haz clic en el siguiente botón:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${enlaceFinal}" style="background-color: #DAA520; color: #000000; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 0.9rem; letter-spacing: 0.5px;">Crear Mi Contraseña</a>
        </div>

        <p style="font-size: 0.78rem; color: #777; line-height: 1.4;">Si el botón no funciona, copia y pega la siguiente URL en tu navegador:<br><a href="${enlaceFinal}" style="color: #DAA520; word-break: break-all;">${enlaceFinal}</a></p>
        
        <hr style="border: none; border-top: 1px solid #222; margin: 30px 0 20px 0;" />
        <p style="color: #888; font-size: 0.8rem; margin: 0;">Atentamente,<br><strong style="color: #fff;">Equipo Comercial — Trulink Fiber LLC</strong></p>
      </div>
    `;
  } 
  // Caso 3: Envío por tipo (rechazo de cuentas)
  else if (tipo === 'RECHAZO') {
    destinatario = email;
    asunto = 'Actualización sobre tu solicitud - Trulink Fiber';
    contenidoHtml = `
      <div style="font-family: Arial, sans-serif; background-color: #080808; color: #ffffff; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(231, 76, 60, 0.3);">
        <h2 style="color: #DAA520; margin-top: 0; font-size: 1.3rem;">Estimado/a ${razon_social},</h2>
        <p style="color: #ccc; line-height: 1.5; font-size: 0.9rem;">Lamentamos informarte que en este momento tu solicitud de registro no pudo ser aprobada debido a que no cumple con todos los parámetros de validación o documentación requerida.</p>
        <p style="color: #888; font-size: 0.85rem; margin-top: 25px;">Si consideras que se trata de un error, puedes comunicarte con nuestro equipo comercial.</p>
        <hr style="border: none; border-top: 1px solid #222; margin: 30px 0 20px 0;" />
        <p style="color: #888; font-size: 0.8rem; margin: 0;">Atentamente,<br><strong style="color: #fff;">Trulink Fiber LLC</strong></p>
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

    console.log("Correo enviado con éxito vía Brevo:", info.messageId);
    return res.status(200).json({ success: true, message: 'Correo enviado correctamente', messageId: info.messageId });
  } catch (error: any) {
    console.error('Error enviando correo SMTP:', error);
    return res.status(500).json({ error: error.message || 'Error al enviar el correo' });
  }
}