import type { NextApiRequest, NextApiResponse } from "next";
import { procesarPagoConfirmado } from "../../lib/contabilidad";

const PAYPAL_API_BASE =
  (process.env.PAYPAL_MODE || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function obtenerAccessTokenPayPal(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID || "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
  const credenciales = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resp = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credenciales}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) {
    throw new Error(`No se pudo obtener access token de PayPal (${resp.status})`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function verificarFirmaWebhook(req: NextApiRequest): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("Falta configurar PAYPAL_WEBHOOK_ID en las variables de entorno");
  }

  const accessToken = await obtenerAccessTokenPayPal();

  const payload = {
    transmission_id: req.headers["paypal-transmission-id"],
    transmission_time: req.headers["paypal-transmission-time"],
    cert_url: req.headers["paypal-cert-url"],
    auth_algo: req.headers["paypal-auth-algo"],
    transmission_sig: req.headers["paypal-transmission-sig"],
    webhook_id: webhookId,
    webhook_event: req.body,
  };

  const resp = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    console.error(`❌ Error consultando verify-webhook-signature: ${resp.status}`);
    return false;
  }

  const data = await resp.json();
  return data.verification_status === "SUCCESS";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const firmaValida = await verificarFirmaWebhook(req);

    if (!firmaValida) {
      console.error("❌ Webhook de PayPal con firma inválida — evento rechazado");
      return res.status(401).json({ error: "Firma de webhook inválida" });
    }

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