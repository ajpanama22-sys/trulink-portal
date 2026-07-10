import nodemailer from 'nodemailer';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  let fileData = null;
  let fileName = '';

  busboy.on('field', (fieldname, val) => {
    fields[fieldname] = val;
  });

  busboy.on('file', (fieldname, file, info) => {
    fileName = info.filename;
    const chunks = [];
    file.on('data', (data) => chunks.push(data));
    file.on('end', () => {
      fileData = Buffer.concat(chunks);
    });
  });

  busboy.on('finish', async () => {
    try {
      // 1. Envío de Correos (Notificación interna y confirmación automática)
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      });

      const esInversionista = fields.tipo_registro === 'Inversor Estratégico';
      const saludo = esInversionista ? 'Estimado Inversionista' : 'Estimado Cliente B2B';

      // Notificación Interna a ti
      await transporter.sendMail({
        from: '"Portal B2B" <fred.jurado@trulinkfiber.com>',
        to: 'fred.jurado@trulinkfiber.com',
        replyTo: fields.email,
        subject: `Nueva solicitud: ${fields.empresa || 'Sin nombre'} (${fields.tipo_registro})`,
        text: `Tipo: ${fields.tipo_registro}\nEmpresa: ${fields.empresa}\nEmail: ${fields.email}\nTeléfono: ${fields.telefono}`,
        attachments: fileData ? [{ filename: fileName, content: fileData }] : []
      });

      // Confirmación al solicitante
      await transporter.sendMail({
        from: '"Fred Jurado - Trulink Fiber" <fred.jurado@trulinkfiber.com>',
        to: fields.email,
        subject: 'Confirmación de recepción: Solicitud de acceso - Trulink Fiber',
        text: `${saludo},\n\nHemos recibido exitosamente su solicitud de acceso al Portal B2B de Trulink Fiber. Le informamos que su requerimiento ha sido remitido formalmente a Administración y Operaciones para su debida evaluación. Nos pondremos en contacto con usted a la brevedad.\n\nAtentamente,\nFred Jurado\nCEO & Founder | Trulink Fiber, LLC\nwww.trulinkfiber.com`
      });

      // 2. Integración con Brevo CRM (Base de datos)
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: fields.email,
          attributes: {
            COMPANY: fields.empresa,
            REPRESENTANTE: fields.representante,
            CARGO: fields.cargo,
            TELEFONO: fields.telefono,
            FISCAL_ID: fields.fiscal_id,
            WEBSITE: fields.website,
            INDUSTRIA: fields.industria,
            DIRECCION: fields.direccion,
            TIPO_REGISTRO: fields.tipo_registro
          },
          updateEnabled: true 
        })
      });

      res.status(200).json({ message: 'Éxito total' });
    } catch (error) {
      console.error('Error en proceso:', error);
      res.status(500).json({ error: error.message });
    }
  });

  req.pipe(busboy);
}
