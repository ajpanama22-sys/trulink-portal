import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Usamos la Service Role Key para poder leer las tablas de destinatarios
// (clientes, colaboradores, solicitudes_acceso) sin depender de las
// políticas RLS del usuario que hace la petición — este endpoint corre
// solo en el servidor, nunca se expone al navegador.
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

type Destinatario = "todos" | "equipo" | "pendientes";

async function obtenerCorreos(destinatario: Destinatario): Promise<string[]> {
  if (destinatario === "todos") {
    // Todos los clientes activos
    const { data, error } = await supabaseAdmin
      .from("clientes")
      .select("email")
      .eq("status", "activo");
    if (error) throw new Error("Error consultando clientes: " + error.message);
    return (data || []).map((c) => c.email).filter(Boolean);
  }

  if (destinatario === "equipo") {
    // Equipo administrativo y de planta
    const { data, error } = await supabaseAdmin
      .from("colaboradores")
      .select("email");
    if (error) throw new Error("Error consultando colaboradores: " + error.message);
    return (data || []).map((c) => c.email).filter(Boolean);
  }

  if (destinatario === "pendientes") {
    // Solicitudes de acceso aún sin aprobar/rechazar
    const { data, error } = await supabaseAdmin
      .from("solicitudes_acceso")
      .select("email")
      .eq("status", "pendiente");
    if (error) throw new Error("Error consultando solicitudes_acceso: " + error.message);
    return (data || []).map((s) => s.email).filter(Boolean);
  }

  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { destinatario, mensaje } = req.body || {};

  if (!mensaje || typeof mensaje !== "string" || !mensaje.trim()) {
    return res.status(400).json({ error: "El mensaje no puede estar vacío" });
  }

  if (!["todos", "equipo", "pendientes"].includes(destinatario)) {
    return res.status(400).json({ error: "Destinatario no válido" });
  }

  if (!serviceRoleKey) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    return res.status(500).json({ error: "Configuración del servidor incompleta." });
  }

  try {
    const correos = await obtenerCorreos(destinatario as Destinatario);

    if (correos.length === 0) {
      return res.status(200).json({
        enviados: 0,
        fallidos: 0,
        total: 0,
        mensaje: "No se encontraron destinatarios para esa categoría.",
      });
    }

    let enviados = 0;
    const fallidos: string[] = [];

    // Enviamos uno por uno (no en batch) para poder reportar exactamente
    // cuáles fallaron, sin que un solo correo malo tumbe todo el envío.
    for (const email of correos) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: "Trulink Fiber LLC — Notificación del sistema",
          html: `
            <div style="background:#0a0a0a;padding:30px;font-family:sans-serif;color:#DAA520;">
              <h2 style="color:#DAA520;">Trulink Fiber LLC</h2>
              <p style="color:#ddd;white-space:pre-wrap;">${mensaje}</p>
              <p style="color:#666;font-size:0.75rem;margin-top:30px;">
                Este es un mensaje automático del sistema. No respondas a este correo.
              </p>
            </div>
          `,
        });
        enviados++;
      } catch (err: any) {
        console.error(`Error enviando a ${email}:`, err.message);
        fallidos.push(email);
      }
    }

    return res.status(200).json({
      enviados,
      fallidos: fallidos.length,
      total: correos.length,
      detalleFallidos: fallidos,
    });
  } catch (err: any) {
    console.error("ERROR INESPERADO en /api/notificar:", err);
    return res.status(500).json({ error: err.message || "Error inesperado del servidor" });
  }
}
