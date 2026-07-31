import type { NextApiRequest, NextApiResponse } from 'next';
import checkoutNodeJSSDK from '@paypal/checkout-server-sdk';

// Mismo criterio que create-paypal-order.ts: usamos PAYPAL_CLIENT_ID y
// PAYPAL_CLIENT_SECRET (los nombres reales configurados en Vercel), y el
// ambiente se decide con PAYPAL_MODE, nunca con NODE_ENV.
function ambientePayPal() {
  const modo = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

  return modo === 'live'
    ? new checkoutNodeJSSDK.core.LiveEnvironment(clientId, clientSecret)
    : new checkoutNodeJSSDK.core.SandboxEnvironment(clientId, clientSecret);
}

function clientePayPal() {
  return new checkoutNodeJSSDK.core.PayPalHttpClient(ambientePayPal());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // PayPal redirige aquí con "token" (el id de la orden de PayPal) y "PayerID"
  const { token, order_id } = req.query;

  if (!token) {
    return res.redirect(`/checkout?id=${order_id}&error=paypal`);
  }

  try {
    const client = clientePayPal();
    const request = new checkoutNodeJSSDK.orders.OrdersCaptureRequest(token as string);
    (request as any).requestBody({});

    const capture = await client.execute(request);

    if (capture.result.status === 'COMPLETED') {
      const montoCapturado =
        capture.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '';

      return res.redirect(
        `/pago-exitoso?order_id=${order_id}&method=paypal&amount=${montoCapturado}`
      );
    }

    return res.redirect(`/checkout?id=${order_id}&error=paypal_no_completado`);
  } catch (err: any) {
    console.error('Error al capturar orden de PayPal:', err);
    return res.redirect(`/checkout?id=${order_id}&error=paypal_captura`);
  }
}
