import { buffer } from "micro";
import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";
import { procesarPagoConfirmado } from "../../lib/contabilidad";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-28.acacia" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET no está configurado.");
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Firma inválida: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const referencia = session.metadata?.referencia || "";
    const montoPagado = session.amount_total ? session.amount_total / 100 : 0;
    const customerEmail = session.customer_details?.email || session.customer_email || undefined;

    if (referencia && montoPagado > 0) {
      try {
        const resultado = await procesarPagoConfirmado({
          referencia,
          montoPagado,
          metodoPago: "Stripe",
          customerEmail,
          referenciaBancaria: session.id,
        });
        console.log(`✅ Stripe → CxC actualizada: ${referencia} — ${resultado.estatusActualizado}`);
      } catch (err: any) {
        console.error(`❌ Error procesando pago Stripe para ${referencia}: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
    } else {
      console.warn("⚠️ Sesión de Stripe sin referencia o monto inválido.");
    }
  }

  return res.status(200).json({ received: true });
}
