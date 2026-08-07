import type { NextApiRequest, NextApiResponse } from 'next';
import checkoutNodeJSSDK from '@paypal/checkout-server-sdk';
import { createClient } from '@supabase/supabase-js';

// IMPORTANTE: las variables en Vercel se llaman PAYPAL_CLIENT_ID y
// PAYPAL_CLIENT_SECRET (sin el prefijo NEXT_PUBLIC_). El código anterior
// leía NEXT_PUBLIC_PAYPAL_CLIENT_ID, que no existe como variable en el
// proyecto, así que el Client ID enviado a PayPal siempre estaba vacío y
// PayPal respondía "invalid_client". Como esta función corre en el
// servidor (API route), no necesita el prefijo NEXT_PUBLIC_ de todos
// modos: ese prefijo solo es necesario para variables usadas en el
// navegador.
//
// El ambiente (Sandbox vs Live) se controla con PAYPAL_MODE, no con
// NODE_ENV, porque en Vercel NODE_ENV siempre es "production" en el sitio
// en vivo aunque estés usando credenciales de Sandbox.
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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Método ${req.method} no permitido`);
  }

  const { orderId, amount } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ error: 'Falta el monto o el identificador de la orden' });
  }

  // Validación server-side del monto contra la cotización real.
  // Antes se confiaba ciegamente en el "amount" mandado por el navegador,
  // lo que permitía a cualquiera pagar cualquier monto arbitrario (ej. $1)
  // para una orden real. Ahora se verifica contra "quotes" en Supabase.
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('id, total, monto_abonado, saldo_pendiente, pagado_total')
    .eq('id', orderId)
    .maybeSingle();

  if (quoteError) {
    console.error('Error consultando la cotización:', quoteError);
    return res.status(500).json({ error: 'Error al validar la orden' });
  }

  if (!quote) {
    return res.status(404).json({ error: 'La orden/cotización indicada no existe' });
  }

  if (quote.pagado_total) {
    return res.status(400).json({ error: 'Esta orden ya fue pagada en su totalidad' });
  }

  const montoMaximo =
    quote.saldo_pendiente !== null && quote.saldo_pendiente !== undefined
      ? Number(quote.saldo_pendiente)
      : Number(quote.total || 0) - Number(quote.monto_abonado || 0);

  const montoSolicitado = Number(amount);

  if (!Number.isFinite(montoSolicitado) || montoSolicitado <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  // Tolerancia de 1 centavo por redondeo.
  if (montoSolicitado > montoMaximo + 0.01) {
    return res.status(400).json({ error: 'El monto excede el saldo pendiente de la orden' });
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
          value: montoSolicitado.toString(),
        },
      },
    ],
    application_context: {
      // IMPORTANTE: se agrega "amount" al return_url para que
      // /api/paypal-capture.ts lo pueda reenviar a /pago-exitoso.
      // Sin esto, pago-exitoso.tsx no sabe cuánto pagó realmente el
      // cliente y cae en el fallback (usa el total de la cotización),
      // mostrando siempre "pagado al 100%" aunque haya sido un anticipo.
      return_url: `${req.headers.origin}/api/paypal-capture?order_id=${orderId}&amount=${montoSolicitado}`,
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