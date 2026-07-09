// api/submit.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { email, empresa, tipo_registro } = req.body;

  // 1. Filtro de seguridad: Bloquear correos públicos
  const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  const emailDomain = email.split('@')[1];
  
  if (publicDomains.includes(emailDomain)) {
    return res.status(400).json({ message: 'Por favor, utiliza un correo corporativo válido.' });
  }

  // 2. Aquí es donde conectaremos con tu SMTP (Brevo) más adelante
  // Por ahora, vamos a registrar que la solicitud llegó
  console.log(`Nueva solicitud de ${tipo_registro} desde: ${empresa}`);

  return res.status(200).json({ message: 'Solicitud recibida correctamente. Nuestro equipo la revisará.' });
}
