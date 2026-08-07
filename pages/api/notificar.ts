import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { verificarSesionAdmin } from "../../lib/verificarSesionAdmin";

/* ============================================================
   /api/notificar — Envío de comunicaciones por Email y SMS
   ------------------------------------------------------------
   Acepta DOS formas de indicar a quién enviar:

   A) Segmento fijo (compatibilidad con notificaciones.tsx):
        { destinatario: "todos" | "equipo" | "pendientes", ... }

   B) Lista explícita (marketing.tsx — segmentación fina):
        { destinatarios: [{ nombre, email, telefono }, ...], ... }

   Si vienen las dos, manda la lista explícita.
   La respuesta tiene el mismo formato en ambos casos, para que
   los dos módulos del portal la lean igual.

   AUTENTICACIÓN:
   Este endpoint puede enviar a "todos" los clientes activos, así
   que antes NO tenía ningún guard — cualquiera podía spamear la
   base completa. Ahora exige UNA de estas dos cosas:
     - Un token de sesión de colaborador admin/super-admin (uso
       normal desde marketing.tsx / notificaciones.tsx).
     - El header "x-internal-key" con el mismo valor de
       CRON_SECRET (uso servidor-a-servidor desde
       /api/cron/recordatorio-pagos.ts, que no tiene sesión de
       usuario).
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

type Destinatario = "todos" | "equipo" | "pendientes";
type Canal = "email" | "sms";

type PersonaContacto = {
  nombre?: string | null;
  email: string | null;
  telefono: string | null;
};

/** Tope de seguridad: evita que un filtro mal armado dispare miles de envíos. */
const MAX_DESTINATARIOS = 500;

/** Cuántos envíos se hacen en paralelo. Sube la velocidad sin saturar al proveedor. */
const TAMANO_LOTE = 5;

/**
 * Normaliza un teléfono al formato internacional que exige SMS Gateway.
 *
 * Reglas:
 *  - Si ya trae "+", se respeta tal cual.
 *  - Si son 8 dígitos, es un número local panameño -> se le antepone +507.
 *  - Si trae más de 8 dígitos, ya incluye código de país (ej: 50277777777
 *    de Guatemala) -> solo se le antepone "+", sin duplicar el 507.
 *
 * Esto corrige el comportamiento anterior, que le ponía +507 a todo y
 * rompía los envíos a clientes de Honduras, Guatemala y demás.
 */
function formatearTelefono(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const limpio = String(telefono).trim();
  if (!limpio) return null;
  if (limpio.startsWith("+")) return limpio;

  const soloDigitos = limpio.replace(/\D/g, "");
  if (!soloDigitos) return null;

  const codigoLocal = process.env.SMS_CODIGO_PAIS || "507";

  // Ya viene con código de país incluido
  if (soloDigitos.length > 8) return `+${soloDigitos}`;

  // Número local
  return `+${codigoLocal}${soloDigitos}`;
}

/** Evita que caracteres sueltos rompan el HTML del correo. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sustituye {{nombre}} por el nombre real del destinatario.
 * Si el mensaje no usa la etiqueta, no pasa nada.
 */
function personalizar(mensaje: string, nombre?: string | null): string {
  if (!nombre) return mensaje.replace(/\{\{\s*nombre\s*\}\}/gi, "");
  return mensaje.replace(/\{\{\s*nombre\s*\}\}/gi, nombre);
}

async function obtenerDestinatarios(destinatario: Destinatario): Promise<PersonaContacto[]> {
  if (destinatario === "todos") {
    const { data, error } = await supabaseAdmin
      .from("clientes")
      .select("razon_social, email, telefono_celular")
      .eq("status", "activo");
    if (error) throw new Error("Error consultando clientes: " + error.message);
    return (data || []).map((c) => ({
      nombre: c.razon_social || null,
      email: c.email || null,
      telefono: c.telefono_celular || null,
    }));
  }

  if (destinatario === "equipo") {
    const { data, error } = await supabaseAdmin
      .from("colaboradores")
      .select("*");
    if (error) throw new Error("Error consultando colaboradores: " + error.message);
    return (data || []).map((c: any) => ({
      nombre: c.nombre || c.nombre_completo || null,
      email: c.email || null,
      telefono: c.telefono || c.telefono_celular || c.celular || null,
    }));
  }

  if (destinatario === "pendientes") {
    const { data, error } = await supabaseAdmin
      .from("solicitudes_acceso")
      .select("razon_social, email, telefono_celular")
      .eq("status", "pendiente");
    if (error) throw new Error("Error consultando solicitudes_acceso: " + error.message);
    return (data || []).map((s: any) => ({
      nombre: s.razon_social || null,
      email: s.email || null,
      telefono: s.telefono_celular || null,
    }));
  }

  return [];
}

async function enviarEmail(email: string, mensaje: string, asunto: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: asunto,
    html: `
      <div style="background:#0a0a0a;padding:30px;font-family:sans-serif;color:#DAA520;">
        <h2 style="color:#DAA520;">Trulink Fiber LLC</h2>
        <p style="color:#ddd;white-space:pre-wrap;">${escaparHtml(mensaje)}</p>
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

  // --- Guard de autenticación ---
  // Camino 1: llamada interna del cron de recordatorios, con el secreto compartido.
  const claveInterna = req.headers["x-internal-key"];
  const esLlamadaInterna =
    !!process.env.CRON_SECRET && claveInterna === process.env.CRON_SECRET;

  // Camino 2: sesión de colaborador admin/super-admin.
  if (!esLlamadaInterna) {
    const auth = await verificarSesionAdmin(req, ["Super Administrador", "Administrador"]);
    if (!auth.autorizado) {
      return res.status(auth.status).json({ error: auth.mensaje });
    }
  }

  const { destinatario, destinatarios, mensaje, canales, asunto } = req.body || {};

  if (!mensaje || typeof mensaje !== "string" || !mensaje.trim()) {
    return res.status(400).json({ error: "El mensaje no puede estar vacío" });
  }

  const usaListaExplicita = Array.isArray(destinatarios) && destinatarios.length > 0;

  if (!usaListaExplicita && !["todos", "equipo", "pendientes"].includes(destinatario)) {
    return res.status(400).json({
      error: "Indica un segmento válido (todos/equipo/pendientes) o una lista de destinatarios.",
    });
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

  const asuntoFinal =
    typeof asunto === "string" && asunto.trim()
      ? asunto.trim()
      : "Trulink Fiber LLC — Notificación del sistema";

  try {
    // --- Resolver a quién se le envía ---
    let personas: PersonaContacto[];

    if (usaListaExplicita) {
      personas = (destinatarios as any[])
        .map((d) => ({
          nombre: d?.nombre || null,
          email: d?.email ? String(d.email).trim() : null,
          telefono: d?.telefono ? String(d.telefono).trim() : null,
        }))
        .filter((p) => p.email || p.telefono);
    } else {
      personas = await obtenerDestinatarios(destinatario as Destinatario);
    }

    // Un mismo contacto no debe recibir el mensaje dos veces
    const vistos = new Set<string>();
    personas = personas.filter((p) => {
      const huella = (p.email || p.telefono || "").toLowerCase();
      if (!huella || vistos.has(huella)) return false;
      vistos.add(huella);
      return true;
    });

    if (personas.length === 0) {
      return res.status(200).json({
        enviados: 0,
        fallidos: 0,
        total: 0,
        mensaje: "No se encontraron destinatarios con datos de contacto válidos.",
      });
    }

    if (personas.length > MAX_DESTINATARIOS) {
      return res.status(400).json({
        error: `El envío supera el límite de ${MAX_DESTINATARIOS} destinatarios (${personas.length}). Afina el segmento y envía por partes.`,
      });
    }

    let enviadosEmail = 0;
    let enviadosSms = 0;
    const fallidosEmail: string[] = [];
    const fallidosSms: string[] = [];

    /** Procesa a una persona: intenta email y/o SMS. Un canal que falla no bloquea al otro. */
    const procesarPersona = async (persona: PersonaContacto) => {
      const textoPersonalizado = personalizar(mensaje, persona.nombre);

      if (enviarPorEmail) {
        if (persona.email) {
          try {
            await enviarEmail(persona.email, textoPersonalizado, asuntoFinal);
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
            await enviarSms(telefonoFormateado, textoPersonalizado);
            enviadosSms++;
          } catch (err: any) {
            console.error(`Error enviando SMS a ${telefonoFormateado}:`, err.message);
            fallidosSms.push(telefonoFormateado);
          }
        } else {
          fallidosSms.push("(sin teléfono registrado)");
        }
      }
    };

    // Se envía en lotes pequeños en paralelo: mucho más rápido que uno por
    // uno, sin llegar a saturar el SMTP ni el gateway de SMS.
    for (let i = 0; i < personas.length; i += TAMANO_LOTE) {
      const lote = personas.slice(i, i + TAMANO_LOTE);
      await Promise.all(lote.map(procesarPersona));
    }

    return res.status(200).json({
      total: personas.length,
      canales: canalesSeleccionados,
      email: enviarPorEmail
        ? { enviados: enviadosEmail, fallidos: fallidosEmail.length, detalleFallidos: fallidosEmail }
        : null,
      sms: enviarPorSms
        ? { enviados: enviadosSms, fallidos: fallidosSms.length, detalleFallidos: fallidosSms }
        : null,
    });
  } catch (err: any) {
    console.error("ERROR INESPERADO en /api/notificar:", err);
    return res.status(500).json({ error: err.message || "Error inesperado del servidor" });
  }
}