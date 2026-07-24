import { NextApiRequest, NextApiResponse } from 'next';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  return process.env.PAYPAL_MODE === 'live'
    ? new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret)
    : new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { orderId, amount } = req.body;

  const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: orderId,
        description: `Cotización Trulink Fiber #${orderId}`,
        amount: {
          currency_code: 'USD',
          value: Number(amount).toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: 'Trulink Fiber LLC',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: `${req.headers.origin}/pago-exitoso?order_id=${orderId}&method=paypal`,
      cancel_url: `${req.headers.origin}/checkout?id=${orderId}`,
    },
  });

  try {
    const paypalClient = client();
    const response = await paypalClient.execute(request);
    
    const approveLink = response.result.links.find((link: any) => link.rel === 'approve');

    return res.status(200).json({ id: response.result.id, url: approveLink?.href });
  } catch (err: any) {
    console.error("Error al crear orden de PayPal:", err);
    return res.status(500).json({ error: err.message || 'Error al conectar con PayPal' });
  }