import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/* ============================================================
   /api/cron/recordatorio-pagos
   ------------------------------------------------------------
   Corre una vez al día (Vercel Cron -- ver vercel.json). Busca
   las cuentas por cobrar cuya fecha_vencimiento es HOY (que ya
   está calculada como "3 días antes del despacho estimado" --
   ver CuentasPorCobrar.tsx) y les manda un correo + SMS
   profesional al cliente para que cancele el saldo.

   Reutiliza /api/notificar.ts (mismo Nodemailer + SMS Gateway
   que ya usa Marketing) para no duplicar lógica de envío, y deja
   un registro en marketing_envios para que el aviso aparezca en
   el Historial de Comunicaciones de Marketing, tal como se pidió.
   ============================================================ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://portal.trulinkfiber.org";

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hoyISO = () => new Date().toISOString().slice(0, 10);

function construirMensajes(params: {
  nombre: string;
  referencia: string;
  saldo: number;
  fechaDespacho: string | null;
  link: string;
}) {
  const { nombre, referencia, saldo, fechaDespacho, link } = params;
  const fechaTexto = fechaDespacho
    ? new Date(fechaDespacho).toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })
    : "la fecha programada";

  const email = `Estimado/a ${nombre},

Le escribimos de parte de Trulink Fiber LLC para recordarle que el saldo pendiente de su pedido #${referencia} debe quedar cancelado antes de la fecha de despacho estimada (${fechaTexto}).

Monto pendiente: ${fmt(saldo)} USD

Puede completar su pago de forma segura desde el siguiente enlace:
${link}

Si ya realizó su pago, por favor descarte este mensaje. Ante cualquier consulta, quedamos atentos para ayudarle.

Atentamente,
Departamento de Administración y Operaciones
Trulink Fiber LLC`;

  const sms = `Trulink Fiber: su saldo de ${fmt(saldo)} para el pedido #${referencia} vence antes del despacho (${fechaTexto}). Complete su pago aqui: ${link}`;

  return { email, sms };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel Cron llama con GET; se acepta también POST para poder probarlo a mano.
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // Protección: solo Vercel Cron (o quien tenga el secreto) puede disparar esto.
  const secretoEsperado = process.env.CRON_SECRET;
  if (secretoEsperado) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${secretoEsperado}`) {
      return res.status(401).json({ error: "No autorizado" });
    }
  }

  if (!serviceRoleKey) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    return res.status(500).json({ error: "Configuración del servidor incompleta." });
  }

  try {
    const hoy = hoyISO();

    // 1. Cuentas que vencen HOY, siguen abiertas, y no se les avisó todavía.
    const { data: cuentas, error: errCuentas } = await supabaseAdmin
      .from("cuentas_por_cobrar")
      .select("*")
      .eq("fecha_vencimiento", hoy)
      .not("estado", "in", '("Cobrada","Anulada")')
      .eq("recordatorio_enviado", false)
      .gt("saldo_pendiente", 0);

    if (errCuentas) throw new Error("Error consultando cuentas_por_cobrar: " + errCuentas.message);

    if (!cuentas || cuentas.length === 0) {
      return res.status(200).json({ procesadas: 0, mensaje: "No hay cuentas que venzan hoy." });
    }

    const resultados: any[] = [];

    for (const cuenta of cuentas) {
      try {
        // 2. Resolver email/teléfono reales: primero por cliente_id, si no
        //    aparece se cae a la cotización original (quotes.email/teléfono).
        let email: string | null = null;
        let telefono: string | null = null;
        let nombre = cuenta.cliente_nombre || "Cliente";
        let fechaDespacho: string | null = null;

        if (cuenta.cliente_id) {
          const { data: cli } = await supabaseAdmin
            .from("clientes")
            .select("email, telefono_celular, telefono_oficina, razon_social")
            .eq("id", cuenta.cliente_id)
            .maybeSingle();
          if (cli) {
            email = cli.email || null;
            telefono = cli.telefono_celular || cli.telefono_oficina || null;
            nombre = cli.razon_social || nombre;
          }
        }

        if ((!email || !telefono) && cuenta.quote_id) {
          const { data: quote } = await supabaseAdmin
            .from("quotes")
            .select("email, telefono_celular, empresa, fecha_estimada_entrega")
            .eq("id", cuenta.quote_id)
            .maybeSingle();
          if (quote) {
            email = email || quote.email || null;
            telefono = telefono || quote.telefono_celular || null;
            nombre = nombre === "Cliente" ? (quote.empresa || nombre) : nombre;
            fechaDespacho = quote.fecha_estimada_entrega || null;
          }
        }

        if (!email && !telefono) {
          resultados.push({ cuenta_id: cuenta.id, estado: "sin_contacto" });
          continue;
        }

        const link = `${SITE_URL}/checkout?id=${cuenta.quote_referencia || cuenta.numero_factura}`;
        const { email: textoEmail, sms: textoSms } = construirMensajes({
          nombre,
          referencia: cuenta.quote_referencia || cuenta.numero_factura || String(cuenta.id),
          saldo: Number(cuenta.saldo_pendiente),
          fechaDespacho,
          link,
        });

        // 3. Reenvía al mismo /api/notificar que ya usa Marketing -- mismo
        //    Nodemailer + SMS Gateway, sin duplicar esa lógica de envío.
        const respuestaNotificar = await fetch(`${SITE_URL}/api/notificar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinatarios: [{ nombre, email, telefono }],
            asunto: `Recordatorio de pago — Pedido #${cuenta.quote_referencia || cuenta.numero_factura}`,
            mensaje: textoEmail,
            canales: ["email", "sms"],
          }),
        });

        const dataNotificar = await respuestaNotificar.json();

        // El SMS usa un texto más corto que el email; se reenvía aparte solo
        // si el canal SMS tuvo éxito en el envío anterior (mismo teléfono).
        if (telefono && dataNotificar?.sms?.enviados > 0) {
          await fetch(`${SITE_URL}/api/notificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              destinatarios: [{ nombre, email: null, telefono }],
              mensaje: textoSms,
              canales: ["sms"],
            }),
          });
        }

        // 4. Marcar la cuenta para no volver a avisar hoy ni mañana.
        await supabaseAdmin
          .from("cuentas_por_cobrar")
          .update({ recordatorio_enviado: true, recordatorio_enviado_at: new Date().toISOString() })
          .eq("id", cuenta.id);

        // 5. Dejar rastro en el historial de Marketing, para que el aviso
        //    se vea junto con las demás comunicaciones enviadas.
        await supabaseAdmin.from("marketing_envios").insert([{
          asunto: `Recordatorio de pago — Pedido #${cuenta.quote_referencia || cuenta.numero_factura}`,
          mensaje: textoEmail,
          canales: "email,sms",
          segmento_descripcion: `Recordatorio automático (3 días antes del despacho) — ${nombre}`,
          total_destinatarios: 1,
          enviados_email: dataNotificar?.email?.enviados || 0,
          fallidos_email: dataNotificar?.email?.fallidos || 0,
          enviados_sms: dataNotificar?.sms?.enviados || 0,
          fallidos_sms: dataNotificar?.sms?.fallidos || 0,
          autor: "Sistema (recordatorio automático)",
        }]);

        resultados.push({ cuenta_id: cuenta.id, estado: "enviado", email: !!email, telefono: !!telefono });
      } catch (errCuenta: any) {
        console.error(`Error procesando recordatorio de cuenta ${cuenta.id}:`, errCuenta.message);
        resultados.push({ cuenta_id: cuenta.id, estado: "error", detalle: errCuenta.message });
      }
    }

    return res.status(200).json({ procesadas: resultados.length, resultados });
  } catch (err: any) {
    console.error("ERROR INESPERADO en /api/cron/recordatorio-pagos:", err);
    return res.status(500).json({ error: err.message || "Error inesperado del servidor" });
  }
}