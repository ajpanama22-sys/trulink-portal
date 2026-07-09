import nodemailer from 'nodemailer';
import Busboy from 'busboy';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'No permitido' });

  console.log("Iniciando procesamiento..."); // <--- ESTO APARECERÁ EN LOS LOGS
  
  const busboy = Busboy({ headers: req.headers });
  const fields = {};

  busboy.on('field', (fieldname, val) => { 
    fields[fieldname] = val; 
    console.log(`Campo recibido: ${fieldname}`); 
  });

  busboy.on('finish', async () => {
    console.log("Busboy finalizado. Campos:", fields);
    
    // Aquí solo probaremos si nodemailer puede crear el transporter
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      });
      
      console.log("Transporter creado correctamente.");
      return res.status(200).json({ message: 'Éxito' });
    } catch (error) {
      console.error("Error en transporter:", error);
      return res.status(500).json({ message: 'Error de servidor' });
    }
  });

  busboy.on('error', (err) => {
    console.error("Error en Busboy:", err);
    res.status(500).json({ message: 'Error en busboy' });
  });

  req.pipe(busboy);
}
