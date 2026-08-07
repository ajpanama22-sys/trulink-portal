import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

/* ============================================================
   /api/notificar-pedido-especial
   ------------------------------------------------------------
   Endpoint angosto y de un solo propósito: avisarle al equipo
   comercial (tabla colaboradores) que llegó una solicitud nueva
   de pedido especial.

   Por qué no reusa /api/notificar directamente:
   Ese endpoint exige sesión de Administrador/Super Administrador
   porque puede mandar correo a TODA la base de clientes — abrirlo
   a sesiones de cliente sería debilitar ese guard para todos los
   demás usos (envíos masivos de marketing, etc).

   Este endpoint en cambio:
     - Exige una sesión válida de Supabase Auth (CUALQUIER usuario
       autenticado, no necesariamente admin) — así el cliente que
       acaba de enviar su solicitud puede dispararlo.
     - Solo puede notificar al segmento fijo "colaboradores".
       No acepta destinatarios arbitrarios ni segmentos masivos.
     - No permite mensaje libre: arma el cuerpo del correo él
       mismo a partir de referencia/empresa/email/especificaciones,
       para que no se pueda usar como un mailer genérico.
   ============================================================ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // --- Guard: exige sesión válida de Supabase Auth, sin importar el rol ---
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Falta sesión. Inicia sesión e intenta de nuevo." });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }

  const { referencia, empresa, email, especificaciones } = req.body || {};

  if (!referencia || typeof referencia !== "string") {
    return res.status(400).json({ error: "Falta la referencia de la solicitud." });
  }

  if (!serviceRoleKey) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    return res.status(500).json({ error: "Configuración del servidor incompleta." });
  }

  try {
    const { data: colaboradores, error } = await supabaseAdmin
      .from("colaboradores")
      .select("*");

    if (error) throw new Error("Error consultando colaboradores: " + error.message);

    const destinatarios = (colaboradores || [])
      .map((c: any) => c.email)
      .filter((e: any) => typeof e === "string" && e.trim());

    if (destinatarios.length === 0) {
      return res.status(200).json({
        enviados: 0,
        fallidos: 0,
        total: 0,
        mensaje: "No hay colaboradores con email registrado para notificar.",
      });
    }

    const empresaTexto = empresa || "(sin nombre de empresa)";
    const emailTexto = email || "(sin email)";
    const especTexto = especificaciones || "(sin descripción, ver adjunto en el panel de Cotizaciones)";

    const asunto = `Nuevo pedido especial — Ref. ${referencia}`;
    const cuerpoHtml = `
      <div style="background:#0a0a0a;padding:30px;font-family:sans-serif;color:#DAA520;">
        <h2 style="color:#DAA520;">Trulink Fiber LLC</h2>
        <p style="color:#ddd;">Llegó una nueva solicitud de pedido especial.</p>
        <table style="color:#ddd;font-size:0.9rem;margin:16px 0;">
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Referencia</td><td>${escaparHtml(referencia)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Empresa</td><td>${escaparHtml(String(empresaTexto))}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Email</td><td>${escaparHtml(String(emailTexto))}</td></tr>
        </table>
        <p style="color:#ddd;white-space:pre-wrap;">${escaparHtml(String(especTexto))}</p>
        <p style="color:#666;font-size:0.75rem;margin-top:30px;">
          Revísala y cotízala desde Admin → Marketing → Cotizaciones → Pedido Especial.
        </p>
      </div>
    `;

    let enviados = 0;
    const fallidos: string[] = [];

    await Promise.all(
      destinatarios.map(async (destino: string) => {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: destino,
            subject: asunto,
            html: cuerpoHtml,
          });
          enviados++;
        } catch (err: any) {
          console.error(`Error enviando notificación de pedido especial a ${destino}:`, err.message);
          fallidos.push(destino);
        }
      })
    );

    return res.status(200).json({
      total: destinatarios.length,
      enviados,
      fallidos: fallidos.length,
      detalleFallidos: fallidos,
    });
  } catch (err: any) {
    console.error("ERROR INESPERADO en /api/notificar-pedido-especial:", err);
    return res.status(500).json({ error: err.message || "Error inesperado del servidor" });
  }
}