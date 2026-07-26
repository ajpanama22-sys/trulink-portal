import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import fetch from "node-fetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

interface ProcesarDocumentoParams {
  referencia: string;
}

export async function generarYEnviarDocumento({ referencia }: ProcesarDocumentoParams) {
  try {
    // 1. Obtener los datos actualizados de la cotización desde Supabase
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("referencia", referencia)
      .single();

    if (quoteError || !quote) {
      throw new Error(`No se encontró la cotización con referencia: ${referencia}`);
    }

    const totalCotizacion = parseFloat(quote.total || "0");
    const montoPagado = parseFloat(quote.monto_pagado || "0");
    const saldoPendiente = parseFloat(quote.saldo_pendiente || (totalCotizacion - montoPagado));
    const esPagoTotal = saldoPendiente <= 0;
    
    const tipoDocumento = esPagoTotal ? "FACTURA COMERCIAL" : "RECIBO DE PAGO PARCIAL";
    const clienteEmail = quote.email || quote.client_email;
    const clienteNombre = quote.nombre_cliente || quote.cliente || "Estimado Cliente";

    if (!clienteEmail) {
      console.warn(`⚠️ La cotización ${referencia} no tiene un correo electrónico asociado para el envío.`);
      return;
    }

    // 2. Generar el PDF en memoria usando PDFKit
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // Encabezado Estilo Trulink (Negro y Dorado)
      doc.rect(0, 0, doc.page.width, 100).fill("#000000");
      doc.fillColor("#DAA520").fontSize(22).font("Helvetica-Bold").text("TRULINK FIBER LLC", 50, 35, { align: "left" });
      doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica").text(tipoDocumento, 50, 65, { align: "left" });

      doc.moveDown(4);

      // Datos del Cliente y Documento
      doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(`Referencia: `, { continued: true });
      doc.font("Helvetica").text(quote.referencia);
      doc.font("Helvetica-Bold").text(`Fecha de Emisión: `, { continued: true });
      doc.font("Helvetica").text(new Date().toLocaleDateString());
      doc.font("Helvetica-Bold").text(`Cliente: `, { continued: true });
      doc.font("Helvetica").text(clienteNombre);

      doc.moveDown(2);

      // Tabla de Resumen Financiero
      doc.rect(50, doc.y, 495, 25).fill("#DAA520");
      doc.fillColor("#000000").font("Helvetica-Bold").text("Concepto", 60, doc.y + 7, { continued: true });
      doc.text("Monto ($ USD)", 400, doc.y, { align: "right" });
      doc.moveDown(1.5);

      doc.font("Helvetica").text(`Total de Cotización (${quote.referencia})`, 60, doc.y);
      doc.text(`$${totalCotizacion.toFixed(2)}`, 400, doc.y, { align: "right" });
      doc.moveDown(1);

      doc.text(`Monto Abonado / Pagado`, 60, doc.y);
      doc.text(`$${montoPagado.toFixed(2)}`, 400, doc.y, { align: "right" });
      doc.moveDown(1);

      doc.font("Helvetica-Bold").text(`Saldo Pendiente`, 60, doc.y);
      doc.text(`$${saldoPendiente > 0 ? saldoPendiente.toFixed(2) : "0.00"}`, 400, doc.y, { align: "right" });
      doc.moveDown(2);

      // Notas y Advertencias Operativas
      doc.fontSize(9).font("Helvetica-Oblique").fillColor("#555555");
      if (!esPagoTotal) {
        doc.text("Aviso Importante: Este documento representa un recibo por abono parcial. El saldo pendiente debe ser liquidado antes de proceder con el despacho de los equipos. Tenga en cuenta que la vigencia de los precios e inventario está sujeta a un plazo máximo de 15 días corridos desde su emisión inicial.");
      } else {
        doc.text("¡Pago completado al 100%! Su orden ha sido validada por el motor financiero y pasará a la cola de preparación logística y de manufactura.");
      }

      doc.end();
    });

    // 3. Enviar el correo con el PDF adjunto utilizando la API de Brevo
    const pdfBase64 = pdfBuffer.toString("base64");
    const nombreArchivo = `${tipoDocumento.toLowerCase().replace(/ /g, "_")}_${referencia}.pdf`;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Trulink Fiber", email: "ventas@trulinkfiber.org" },
        to: [{ email: clienteEmail, name: clienteNombre }],
        subject: `[Trulink Fiber] Su ${tipoDocumento} - Ref: ${referencia}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; background-color: #000; color: #fff; padding: 30px; border-radius: 10px;">
            <h2 style="color: #DAA520; text-align: center;">Trulink Fiber LLC</h2>
            <p>Estimado/a <strong>${clienteNombre}</strong>,</p>
            <p>Adjunto a este correo encontrará su <strong>${tipoDocumento}</strong> correspondiente a la cotización <strong>${referencia}</strong>.</p>
            <div style="background-color: #111; border: 1px solid #DAA520; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Total Cotizado:</strong> $${totalCotizacion.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Acumulado Pagado:</strong> $${montoPagado.toFixed(2)}</p>
              <p style="margin: 5px 0; color: ${saldoPendiente > 0 ? '#e74c3c' : '#2ecc71'};"><strong>Saldo Pendiente:</strong> $${saldoPendiente > 0 ? saldoPendiente.toFixed(2) : '0.00'}</p>
            </div>
            <p>Gracias por confiar en nuestros servicios y productos.</p>
            <hr style="border-color: #333; margin: 20px 0;">
            <p style="font-size: 11px; color: #777; text-align: center;">Trulink Fiber LLC - Portal de Gestión Automatizada</p>
          </div>
        `,
        attachment: [
          {
            content: pdfBase64,
            name: nombreArchivo,
          },
        ],
      }),
    });

    if (!brevoResponse.ok) {
      const errorData: any = await brevoResponse.json();
      throw new Error(`Error en Brevo API: ${JSON.stringify(errorData)}`);
    }

    console.log(`📧 Documento (${tipoDocumento}) generado y enviado con éxito a ${clienteEmail} para la referencia ${referencia}`);
  } catch (err: any) {
    console.error(`❌ Error en el procesamiento del documento para ${referencia}:`, err.message);
  }
}