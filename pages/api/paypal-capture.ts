import type { NextApiRequest, NextApiResponse } from 'next';
import checkoutNodeJSSDK from '@paypal/checkout-server-sdk';

function ambientePayPal() {
  return process.env.NODE_ENV === 'production'
    ? new checkoutNodeJSSDK.core.LiveEnvironment(
        process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
        process.env.PAYPAL_CLIENT_SECRET || ''
      )
    : new checkoutNodeJSSDK.core.SandboxEnvironment(
        process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
        process.env.PAYPAL_CLIENT_SECRET || ''
      );
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