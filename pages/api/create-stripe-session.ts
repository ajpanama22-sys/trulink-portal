import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { orderId, amount } = req.body;
    const unitAmountInCents = Math.round(Number(amount) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Cotización Trulink Fiber #${orderId}`,
              description: `Pago de orden de productos/fabricación de fibra óptica.`,
            },
            unit_amount: unitAmountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${req.headers.origin}/checkout?id=${orderId}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error("Error al crear sesión de Stripe:", err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
}