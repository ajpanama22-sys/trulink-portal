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
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      });

      // Lógica de detección: Identifica si es inversor o cliente B2B
      // El valor viene de <input name="tipo_registro" value="Inversor Estratégico" ...>
      const saludo = fields.tipo_registro === 'Inversor Estratégico' ? 'Estimado Inversionista' : 'Estimado Cliente B2B';

      // 1. Notificación Interna (para ti)
      await transporter.sendMail({
        from: '"Portal B2B" <fred.jurado@trulinkfiber.com>',
        to: 'fred.jurado@trulinkfiber.com',
        replyTo: fields.email, // Para que al dar "Responder" vayas al email del solicitante
        subject: `Nueva solicitud: ${fields.empresa || 'Sin nombre'}`,
        text: `Empresa: ${fields.empresa}\nEmail: ${fields.email}\nTipo: ${fields.tipo_registro}\nTeléfono: ${fields.telefono}`,
        attachments: fileData ? [{ filename: fileName, content: fileData }] : []
      });

      // 2. Correo de Confirmación Automático (para el solicitante)
      await transporter.sendMail({
        from: '"Fred Jurado - Trulink Fiber" <fred.jurado@trulinkfiber.com>',
        to: fields.email,
        subject: 'Confirmación de recepción: Solicitud de acceso - Trulink Fiber',
        text: `${saludo},\n\nHemos recibido exitosamente su solicitud de acceso al Portal B2B de Trulink Fiber.\n\nLe informamos que su requerimiento ha sido remitido formalmente a nuestros departamentos de Administración y Operaciones para su debida evaluación y procesamiento. Nuestro equipo revisará la información proporcionada y le contactaremos a la brevedad posible para darle seguimiento.\n\nAgradecemos su interés en nuestra plataforma.\n\nAtentamente,\nFred Jurado\nCEO & Founder | Trulink Fiber, LLC\nwww.trulinkfiber.com`
      });

      res.status(200).json({ message: 'Éxito total' });
    } catch (error) {
      console.error('Error enviando correo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  req.pipe(busboy);
}
