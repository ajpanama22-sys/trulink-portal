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
    const event = req.body;

    // PayPal envía diferentes tipos de eventos. Nos interesa cuando el pago se completa:
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" || event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const resource = event.resource;
      
      // Extraemos la referencia del custom_id o purchase_units
      const referencia = resource.custom_id || resource.purchase_units?.[0]?.custom_id;
      const montoPagado = parseFloat(resource.amount?.value || resource.amount?.total || "0");
      const customerEmail = resource.payer?.email_address;

      if (referencia && montoPagado > 0) {
        console.log(`✅ Pago de PayPal recibido para la cotización ${referencia}: $${montoPagado}`);

        // 1. Buscar la cotización en la tabla 'quotes'
        const { data: quote, error: quoteError } = await supabase
          .from("quotes")
          .select("*")
          .eq("referencia", referencia)
          .single();

        if (quoteError || !quote) {
          console.error(`❌ Cotización ${referencia} no encontrada en Supabase.`);
          return res.status(404).json({ error: "Cotización no encontrada" });
        }

        // 2. Validar vigencia estricta de 15 días corridos
        const fechaCreacion = new Date(quote.created_at || quote.fecha || Date.now());
        const hoy = new Date();
        const diferenciaDias = Math.floor((hoy.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));

        if (diferenciaDias > 15) {
          console.warn(`⚠️ Intento de pago para cotización expirada (${referencia}). Días transcurridos: ${diferenciaDias}`);
        }

        // 3. Calcular saldos y acumulados financieros
        const totalCotizacion = parseFloat(quote.total || "0");
        const pagadoAnterior = parseFloat(quote.monto_pagado || "0");
        const acumuladoTotal = pagadoAnterior + montoPagado;
        const saldoPendiente = totalCotizacion - acumuladoTotal;

        const esPagoTotal = saldoPendiente <= 0;
        const nuevoEstado = esPagoTotal ? "paid" : "partial";

        // 4. Actualizar la cotización en la tabla 'quotes' de Supabase
        const { error: updateError } = await supabase
          .from("quotes")
          .update({
            monto_pagado: acumuladoTotal,
            saldo_pendiente: saldoPendiente > 0 ? saldoPendiente : 0,
            status: nuevoEstado,
            metodo_pago: "PayPal"
          })
          .eq("referencia", referencia);

        if (updateError) {
          throw new Error(`Error al actualizar Supabase: ${updateError.message}`);
        }

        // -------------------------------------------------------------
        // 4.b ALIMENTAR LA TABLA DE CUENTAS POR COBRAR ('cxc')
        // -------------------------------------------------------------
        const porcentajeAcumulado = totalCotizacion > 0 ? (acumuladoTotal / totalCotizacion) * 100 : 0;
        const esEspecial = pagadoAnterior === 0 && (montoPagado / totalCotizacion) < 0.50;

        let estadoCxC = "ABONADO_PARCIAL";
        let condicionPago = "50/50_ESTANDAR";

        if (esPagoTotal) {
          estadoCxC = "PAGADO_TOTAL";
          condicionPago = "100%_CONTADO";
        } else if (esEspecial) {
          estadoCxC = "CLIENTE_ESPECIAL_PENDIENTE";
          condicionPago = "ESPECIAL_<50%";
        }

        // Revisar si ya existe la cuenta por cobrar registrada
        const { data: cxcExistente } = await supabase
          .from("cxc")
          .select("id")
          .eq("num_factura_ref", referencia)
          .maybeSingle();

        if (cxcExistente) {
          // Si ya existe, actualizamos saldos y porcentaje
          await supabase
            .from("cxc")
            .update({
              saldo_pendiente: saldoPendiente > 0 ? saldoPendiente : 0,
              porcentaje_pagado_actual: porcentajeAcumulado,
              estado: estadoCxC
            })
            .eq("id", cxcExistente.id);
        } else {
          // Si es el primer abono, creamos el registro completo en 'cxc'
          await supabase.from("cxc").insert([{
            quote_id: quote.id,
            num_factura_ref: referencia,
            cliente_nombre: quote.empresa || quote.representante || "Cliente",
            cliente_email: customerEmail || quote.email || "",
            monto_total: totalCotizacion,
            saldo_pendiente: saldoPendiente > 0 ? saldoPendiente : 0,
            porcentaje_pagado_actual: porcentajeAcumulado,
            condicion_pago: condicionPago,
            es_cliente_especial: esEspecial,
            fecha_estimada_despacho: quote.fecha_estimada || null,
            estado: estadoCxC
          }]);
        }
        // -------------------------------------------------------------

        // 5. Determinar el documento contable a emitir
        const tipoDocumentoEmitido = esPagoTotal ? "Factura Comercial" : "Recibo de Pago Parcial";
        console.log(`📄 Documento a emitir para ${referencia}: ${tipoDocumentoEmitido} (Saldo pendiente: $${saldoPendiente > 0 ? saldoPendiente : 0})`);

        // 6. Generar el PDF y enviarlo automáticamente por Brevo
        await generarYEnviarDocumento({ referencia });
        console.log(`✅ PDF generado y enviado por Brevo para la referencia ${referencia}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`❌ Error en Webhook de PayPal: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}