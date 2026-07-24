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

  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'Falta el monto total de la orden' });
  }

  const request = new checkoutNodeJSSDK.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount.toString(),
        },
      },
    ],
  });

  try {
    const client = clientePayPal();
    const response = await client.execute(request);
    
    const approvalUrl = response.result.links.find(
      (link: any) => link.rel === 'approve'
    )?.href;

    return res.status(200).json({
      id: response.result.id,
      approvalUrl,
    });
  } catch (err: any) {
    console.error('Error al crear orden de PayPal:', err);
    return res.status(500).json({ error: err.message || 'Error al conectar con PayPal' });
  }
}