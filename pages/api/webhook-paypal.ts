import type { NextApiRequest, NextApiResponse } from "next";
import { procesarPagoConfirmado } from "../../lib/contabilidad";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const event = req.body;

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" || event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const resource = event.resource;

      const referencia = resource.custom_id || resource.purchase_units?.[0]?.custom_id || "";
      const montoPagado = parseFloat(resource.amount?.value || resource.amount?.total || "0");
      const customerEmail = resource.payer?.email_address;
      const idTransaccionPaypal = resource.id;

      if (referencia && montoPagado > 0) {
        const resultado = await procesarPagoConfirmado({
          referencia,
          montoPagado,
          metodoPago: "PayPal",
          customerEmail,
          referenciaBancaria: idTransaccionPaypal,
        });
        console.log(`✅ PayPal → CxC actualizada: ${referencia} — ${resultado.estatusActualizado}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`❌ Error en Webhook de PayPal: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
