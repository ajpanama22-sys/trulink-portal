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
type Canal = "email" | "sms";

type PersonaContacto = {
  email: string | null;
  telefono: string | null;
};

// Normaliza números guardados como locales (ej: "66403720") al formato
// internacional que exige SMS Gateway (ej: "+50766403720"). Si el número
// ya viene con "+", lo dejamos tal cual.
function formatearTelefono(telefono: string | null): string | null {
  if (!telefono) return null;
  const limpio = telefono.trim();
  if (!limpio) return null;
  if (limpio.startsWith("+")) return limpio;
  const soloDigitos = limpio.replace(/\D/g, "");
  if (!soloDigitos) return null;
  return `+507${soloDigitos}`;
}

async function obtenerDestinatarios(destinatario: Destinatario): Promise<PersonaContacto[]> {
  if (destinatario === "todos") {
    // Todos los clientes activos
    const { data, error } = await supabaseAdmin
      .from("clientes")
      .select("email, telefono_celular")
      .eq("status", "activo");
    if (error) throw new Error("Error consultando clientes: " + error.message);
    return (data || []).map((c) => ({
      email: c.email || null,
      telefono: c.telefono_celular || null,
    }));
  }

  if (destinatario === "equipo") {
    // Equipo administrativo y de planta
    const { data, error } = await supabaseAdmin
      .from("colaboradores")
      .select("email, telefono");
    if (error) throw new Error("Error consultando colaboradores: " + error.message);
    return (data || []).map((c) => ({
      email: c.email || null,
      telefono: c.telefono || null,
    }));
  }

  if (destinatario === "pendientes") {
    // Solicitudes de acceso aún sin aprobar/rechazar
    const { data, error } = await supabaseAdmin
      .from("solicitudes_acceso")
      .select("email, telefono_celular")
      .eq("status", "pendiente");
    if (error) throw new Error("Error consultando solicitudes_acceso: " + error.message);
    return (data || []).map((s) => ({
      email: s.email || null,
      telefono: s.telefono_celular || null,
    }));
  }

  return [];
}

async function enviarEmail(email: string, mensaje: string) {
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
}

async function enviarSms(telefono: string, mensaje: string) {
  const usuario = process.env.SMSGATE_USER;
  const contrasena = process.env.SMSGATE_PASS;

  if (!usuario || !contrasena) {
    throw new Error("Faltan configurar SMSGATE_USER y SMSGATE_PASS en el servidor.");
  }

  const credenciales = Buffer.from(`${usuario}:${contrasena}`).toString("base64");

  const respuesta = await fetch("https://api.sms-gate.app/3rdparty/v1/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credenciales}`,
    },
    body: JSON.stringify({
      textMessage: { text: mensaje },
      phoneNumbers: [telefono],
    }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos?.message || "Error al enviar el SMS");
  }

  return datos;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { destinatario, mensaje, canales } = req.body || {};

  if (!mensaje || typeof mensaje !== "string" || !mensaje.trim()) {
    return res.status(400).json({ error: "El mensaje no puede estar vacío" });
  }

  if (!["todos", "equipo", "pendientes"].includes(destinatario)) {
    return res.status(400).json({ error: "Destinatario no válido" });
  }

  const canalesSeleccionados: Canal[] = Array.isArray(canales) ? canales : ["email"];
  const enviarPorEmail = canalesSeleccionados.includes("email");
  const enviarPorSms = canalesSeleccionados.includes("sms");

  if (!enviarPorEmail && !enviarPorSms) {
    return res.status(400).json({ error: "Debes elegir al menos un canal (email o SMS)." });
  }

  if (!serviceRoleKey) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    return res.status(500).json({ error: "Configuración del servidor incompleta." });
  }

  try {
    const personas = await obtenerDestinatarios(destinatario as Destinatario);

    if (personas.length === 0) {
      return res.status(200).json({
        enviados: 0,
        fallidos: 0,
        total: 0,
        mensaje: "No se encontraron destinatarios para esa categoría.",
      });
    }

    let enviadosEmail = 0;
    let enviadosSms = 0;
    const fallidosEmail: string[] = [];
    const fallidosSms: string[] = [];

    // Recorremos una sola vez la lista de personas y, por cada una,
    // intentamos email y/o SMS según lo que se haya elegido. Un canal
    // que falla no bloquea al otro.
    for (const persona of personas) {
      if (enviarPorEmail) {
        if (persona.email) {
          try {
            await enviarEmail(persona.email, mensaje);
            enviadosEmail++;
          } catch (err: any) {
            console.error(`Error enviando email a ${persona.email}:`, err.message);
            fallidosEmail.push(persona.email);
          }
        } else {
          fallidosEmail.push("(sin email registrado)");
        }
      }

      if (enviarPorSms) {
        const telefonoFormateado = formatearTelefono(persona.telefono);
        if (telefonoFormateado) {
          try {
            await enviarSms(telefonoFormateado, mensaje);
            enviadosSms++;
          } catch (err: any) {
            console.error(`Error enviando SMS a ${telefonoFormateado}:`, err.message);
            fallidosSms.push(telefonoFormateado);
          }
        } else {
          fallidosSms.push("(sin teléfono registrado)");
        }
      }
    }

    return res.status(200).json({
      total: personas.length,
      canales: canalesSeleccionados,
      email: enviarPorEmail ? { enviados: enviadosEmail, fallidos: fallidosEmail.length, detalleFallidos: fallidosEmail } : null,
      sms: enviarPorSms ? { enviados: enviadosSms, fallidos: fallidosSms.length, detalleFallidos: fallidosSms } : null,
    });
  } catch (err: any) {
    console.error("ERROR INESPERADO en /api/notificar:", err);
    return res.status(500).json({ error: err.message || "Error inesperado del servidor" });
  }
}
