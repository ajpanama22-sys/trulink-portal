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
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Método ${req.method} no permitido`);
  }

  const { orderId, amount } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ error: 'Falta el monto o el identificador de la orden' });
  }

  const request = new checkoutNodeJSSDK.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: orderId,
        amount: {
          currency_code: 'USD',
          value: amount.toString(),
        },
      },
    ],
    application_context: {
      return_url: `${req.headers.origin}/api/paypal-capture?order_id=${orderId}`,
      cancel_url: `${req.headers.origin}/checkout?id=${orderId}`,
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
    },
  });

  try {
    const client = clientePayPal();
    const response = await client.execute(request);

    const approvalUrl = response.result.links.find(
      (link: any) => link.rel === 'approve'
    )?.href;

    return res.status(200).json({
      id: response.result.id,
      url: approvalUrl,
    });
  } catch (err: any) {
    console.error('Error al crear orden de PayPal:', err);
    return res.status(500).json({ error: err.message || 'Error al conectar con PayPal' });
  }
}