import { buffer } from "micro";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";
import { generarYEnviarDocumento } from "../../lib/generarYEnviarDocumento";

// Desactivamos el bodyParser nativo de Next.js para poder leer el buffer crudo (requerido por Stripe)
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-28.acacia" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET no está configurado en las variables de entorno.");
    }
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Error de verificación de firma Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento cuando el pago se completa con éxito
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Obtenemos la referencia y el monto pagado (Stripe maneja los montos en centavos)
    const referencia = session.metadata?.referencia;
    const montoPagado = session.amount_total ? session.amount_total / 100 : 0;
    const customerEmail = session.customer_details?.email || session.customer_email;

    if (referencia && montoPagado > 0) {
      console.log(`✅ Pago recibido exitosamente en Stripe para la cotización: ${referencia} ($${montoPagado})`);

      // 1. Buscar la cotización en la tabla 'quotes'
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("referencia", referencia)
        .single();

      if (quoteError || !quote) {
        console.error(`❌ Cotización ${referencia} no encontrada en Supabase.`);
        return res.status(404).json({ error: "Cotización no encontrada" });
      }

      // 2. Validar vigencia estricta de 15 días corridos
      const fechaCreacion = new Date(quote.created_at || quote.fecha || Date.now());
      const hoy = new Date();
      const diferenciaDias = Math.floor((hoy.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));

      if (diferenciaDias > 15) {
        console.warn(`⚠️ Intento de pago para cotización expirada (${referencia}). Días transcurridos: ${diferenciaDias}`);
      }

      // 3. Calcular saldos y acumulados financieros
      const totalCotizacion = parseFloat(quote.total || "0");
      const pagadoAnterior = parseFloat(quote.monto_pagado || "0");
      const acumuladoTotal = pagadoAnterior + montoPagado;
      const saldoPendiente = totalCotizacion - acumuladoTotal;

      const esPagoTotal = saldoPendiente <= 0;
      const nuevoEstado = esPagoTotal ? "paid" : "partial";

      // 4. Actualizar la cotización en Supabase
      const { error: updateError } = await supabase
        .from("quotes")
        .update({
          monto_pagado: acumuladoTotal,
          saldo_pendiente: saldoPendiente > 0 ? saldoPendiente : 0,
          status: nuevoEstado,
          metodo_pago: "Stripe"
        })
        .eq("referencia", referencia);

      if (updateError) {
        console.error(`❌ Error al actualizar la cotización ${referencia} en Supabase:`, updateError.message);
        return res.status(500).json({ error: "Error actualizando base de datos" });
      }

      // 5. Generar el PDF y enviarlo automáticamente por Brevo
      try {
        await generarYEnviarDocumento({ referencia });
        console.log(`📧 PDF generado y enviado por Brevo para la referencia ${referencia} (${customerEmail})`);
      } catch (emailErr: any) {
        console.error("⚠️ Error generando/enviando documento post-pago:", emailErr.message);
      }
    } else {
      console.warn("⚠️ La sesión de Stripe no contiene metadatos con la referencia o el monto es inválido.");
    }
  }

  return res.status(200).json({ received: true });
}