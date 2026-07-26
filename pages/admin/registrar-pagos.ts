import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { generarYEnviarDocumento } from "../../lib/generarYEnviarDocumento";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { referencia, montoPagado, banco, referenciaBancaria } = req.body;

    if (!referencia || !montoPagado || !banco) {
      return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    // 1. Buscar cotización en Supabase
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("referencia", referencia)
      .single();

    if (quoteError || !quote) {
      return res.status(404).json({ error: "No se encontró la cotización especificada." });
    }

    // 2. Validar vigencia estricta de 15 días corridos
    const fechaCreacion = new Date(quote.created_at || quote.fecha || Date.now());
    const hoy = new Date();
    const diferenciaDias = Math.floor((hoy.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));

    if (diferenciaDias > 15) {
      console.warn(`⚠️ Intento de registro de transferencia para cotización expirada (${referencia}). Días transcurridos: ${diferenciaDias}`);
    }

    // 3. Calcular montos y estatus
    const totalCotizacion = parseFloat(quote.total || "0");
    const pagadoAnterior = parseFloat(quote.monto_pagado || "0");
    const abonoActual = parseFloat(montoPagado);
    const acumuladoTotal = pagadoAnterior + abonoActual;
    const saldoPendiente = totalCotizacion - acumuladoTotal;
    const esPagoTotal = saldoPendiente <= 0;
    const nuevoEstado = esPagoTotal ? "paid" : "partial";

    // 4. Actualizar la base de datos
    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        monto_pagado: acumuladoTotal,
        saldo_pendiente: saldoPendiente > 0 ? saldoPendiente : 0,
        status: nuevoEstado,
        metodo_pago: `Transferencia - ${banco} (${referenciaBancaria || 'Sin Ref'})`
      })
      .eq("referencia", referencia);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // 5. Ejecutar el motor de PDF y Brevo automáticamente
    try {
      await generarYEnviarDocumento({ referencia });
      console.log(`📧 PDF generado y enviado por Brevo para la transferencia de la referencia ${referencia}`);
    } catch (docErr: any) {
      console.error("⚠️ Error generando/enviando documento para transferencia:", docErr.message);
    }

    return res.status(200).json({
      success: true,
      resumen: {
        documentoEmitido: esPagoTotal ? "Factura Comercial" : "Recibo de Pago Parcial",
        referencia,
        montoTotalCotizacion: totalCotizacion.toFixed(2),
        abonoActualRegistrado: abonoActual.toFixed(2),
        acumuladoPagado: acumuladoTotal.toFixed(2),
        saldoPendiente: saldoPendiente > 0 ? saldoPendiente.toFixed(2) : "0.00",
        estatusActualizado: nuevoEstado
      }
    });

  } catch (err: any) {
    console.error("❌ Error registrando transferencia:", err.message);
    return res.status(500).json({ error: err.message });
  }
}