import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

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
    const clienteNombre = quote.nombre_cliente || quote.cliente || "Trulink Fiber Customer";
    const representante = quote.representante || "Fred Jurado";
    const telefonoCliente = quote.telefono || quote.telefono_movil || "+507 66403720";
    const metodoPago = quote.metodo_pago || "Transferencia / Yappy / PayPal";

    if (!clienteEmail) {
      console.warn(`⚠️ La cotización ${referencia} no tiene un correo electrónico asociado para el envío.`);
      return;
    }

    // 2. Generar el PDF en memoria usando PDFKit
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      if (esPagoTotal) {
        // ==========================================
        // LAYOUT 1: FACTURA COMERCIAL (Estilo Cotización Corporativa)
        // ==========================================
        doc.fillColor("#000000").fontSize(18).font("Helvetica-Bold").text("TRULINK FIBER LLC", 40, 40);
        doc.fontSize(9).font("Helvetica").fillColor("#555555");
        doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111");
        doc.text("Tel: +507 6640 3720 | www.trulinkfiber.com");

        doc.moveTo(40, 85).lineTo(555, 85).strokeColor("#DAA520").lineWidth(1.5).stroke();

        doc.y = 95;
        doc.fillColor("#DAA520").fontSize(14).font("Helvetica-Bold").text(tipoDocumento, { align: "right" });
        doc.fillColor("#000000").fontSize(10);
        doc.text(`Referencia: ${quote.referencia}`, { align: "right" });
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, { align: "right" });

        doc.moveDown(1);

        doc.rect(40, doc.y, 515, 65).fillAndStroke("#F9F9F9", "#CCCCCC");
        const clientBoxY = doc.y + 8;
        doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
        doc.text(`Cliente:`, 50, clientBoxY);
        doc.font("Helvetica").text(`${clienteNombre}`, 120, clientBoxY);

        doc.font("Helvetica-Bold").text(`Representante:`, 50, clientBoxY + 14);
        doc.font("Helvetica").text(`${representante}`, 120, clientBoxY + 14);

        doc.font("Helvetica-Bold").text(`Mail:`, 50, clientBoxY + 28);
        doc.font("Helvetica").text(`${clienteEmail}`, 120, clientBoxY + 28);

        doc.font("Helvetica-Bold").text(`Teléfono:`, 50, clientBoxY + 42);
        doc.font("Helvetica").text(`${telefonoCliente}`, 120, clientBoxY + 42);

        doc.moveDown(4);

        const tableTop = doc.y;
        doc.rect(40, tableTop, 515, 20).fill("#000000");
        doc.fillColor("#DAA520").fontSize(8).font("Helvetica-Bold");
        doc.text("DESCRIPCIÓN", 45, tableTop + 6);
        doc.text("HILOS", 240, tableTop + 6);
        doc.text("CANT", 290, tableTop + 6);
        doc.text("P. UNITARIO", 335, tableTop + 6);
        doc.text("P. CARRETE", 410, tableTop + 6);
        doc.text("TOTAL", 485, tableTop + 6);

        let rowY = tableTop + 20;
        doc.fillColor("#000000").font("Helvetica").fontSize(9);

        const items = quote.items || [{ descripcion: quote.descripcion || "Material de Fibra Óptica", hilos: quote.hilos || "6", cant: quote.cant || 1, p_unitario: quote.p_unitario || totalCotizacion, p_carrete: quote.p_carrete || totalCotizacion, total: totalCotizacion }];

        items.forEach((item: any, idx: number) => {
          if (idx % 2 === 0) {
            doc.rect(40, rowY, 515, 18).fill("#F4F4F4");
          }
          doc.fillColor("#000000");
          doc.text(item.descripcion || "ASU", 45, rowY + 5, { width: 190 });
          doc.text(String(item.hilos || "-"), 240, rowY + 5);
          doc.text(String(item.cant || "1"), 290, rowY + 5);
          doc.text(`$${parseFloat(item.p_unitario || totalCotizacion).toFixed(2)}`, 335, rowY + 5);
          doc.text(`$${parseFloat(item.p_carrete || totalCotizacion).toFixed(2)}`, 410, rowY + 5);
          doc.text(`$${parseFloat(item.total || totalCotizacion).toFixed(2)}`, 485, rowY + 5);
          rowY += 18;
        });

        doc.y = rowY + 15;
        doc.fontSize(11).font("Helvetica-Bold").text(`TOTAL PAGADO: $${totalCotizacion.toFixed(2)}`, { align: "right" });
        
        doc.moveDown(2);
        doc.fontSize(8).font("Helvetica").fillColor("#333333");
        doc.text("Precios: EXW PANAMÁ");
        doc.text("NOTA: Transacción liquidada al 100%. Los equipos pasan a fase de despacho logístico.");
        doc.text("MÉTODOS DE PAGO: YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES");

      } else {
        // ==========================================
        // LAYOUT 2: RECIBO DE PAGO PARCIAL (Estilo Ticket Elegante / Referencia)
        // ==========================================
        const startX = 120;
        const receiptWidth = 355;
        let currentY = 40;

        // Marco exterior estilo ticket
        doc.rect(startX, currentY, receiptWidth, 540).fillAndStroke("#FFFFFF", "#DAA520");

        // Cabecera del Recibo
        currentY += 15;
        doc.fillColor("#DAA520").fontSize(14).font("Helvetica-Bold").text("Trulink Fiber LLC", startX, currentY, { align: "center", width: receiptWidth });
        currentY += 18;
        doc.fontSize(7).font("Helvetica").fillColor("#555555").text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM", startX, currentY, { align: "center", width: receiptWidth });

        // Banner Negro con número de recibo / referencia
        currentY += 20;
        doc.rect(startX + 15, currentY, receiptWidth - 30, 22).fill("#000000");
        doc.fillColor("#DAA520").fontSize(9).font("Helvetica-Bold").text(`PAYMENT RECEIPT #${quote.referencia}`, startX + 15, currentY + 7, { align: "center", width: receiptWidth - 30 });

        // Datos de la cuenta y cliente
        currentY += 32;
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
        doc.text(`Account Name: `, startX + 25, currentY, { continued: true });
        doc.font("Helvetica").text(`${clienteNombre}`);
        currentY += 14;
        doc.font("Helvetica-Bold").text(`Representative: `, startX + 25, currentY, { continued: true });
        doc.font("Helvetica").text(`${representante}`);
        currentY += 14;
        doc.font("Helvetica-Bold").text(`Support Email: `, startX + 25, currentY, { continued: true });
        doc.font("Helvetica").text(`${clienteEmail}`);

        // Tabla de Productos / Servicios (Estilo Ticket)
        currentY += 20;
        doc.rect(startX + 15, currentY, receiptWidth - 30, 18).fill("#EAEAEA");
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
        doc.text("SERVICE / PRODUCT", startX + 25, currentY + 5);
        doc.text("AMOUNT", startX + 250, currentY + 5, { align: "right", width: 70 });

        currentY += 22;
        doc.font("Helvetica").fontSize(8);
        doc.text(`Cotización Base (${quote.referencia})`, startX + 25, currentY, { width: 210 });
        doc.text(`$${totalCotizacion.toFixed(2)}`, startX + 250, currentY, { align: "right", width: 70 });

        currentY += 18;
        doc.text(`Abono Actual Recibido`, startX + 25, currentY, { width: 210 });
        doc.text(`$${montoPagado.toFixed(2)}`, startX + 250, currentY, { align: "right", width: 70 });

        // Bloque de Totales (Subtotal / Saldo Pendiente)
        currentY += 25;
        doc.moveTo(startX + 25, currentY).lineTo(startX + receiptWidth - 25, currentY).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
        
        currentY += 8;
        doc.font("Helvetica-Bold").text("TOTAL COTIZADO:", startX + 25, currentY);
        doc.font("Helvetica").text(`$${totalCotizacion.toFixed(2)}`, startX + 250, currentY, { align: "right", width: 70 });

        currentY += 14;
        doc.font("Helvetica-Bold").text("ACUMULADO PAGADO:", startX + 25, currentY);
        doc.font("Helvetica").text(`$${montoPagado.toFixed(2)}`, startX + 250, currentY, { align: "right", width: 70 });

        // Franja de Saldo Pendiente (Destacada en Dorado/Negro)
        currentY += 20;
        doc.rect(startX + 15, currentY, receiptWidth - 30, 24).fill("#111111");
        doc.fillColor("#DAA520").fontSize(9).font("Helvetica-Bold");
        doc.text("SALDO PENDIENTE:", startX + 25, currentY + 8);
        doc.text(`$${saldoPendiente.toFixed(2)}`, startX + 250, currentY + 8, { align: "right", width: 70 });

        // Datos de Pago
        currentY += 35;
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
        doc.text("Payment Method:", startX + 25, currentY, { continued: true });
        doc.font("Helvetica").text(` ${metodoPago}`);
        currentY += 12;
        doc.font("Helvetica-Bold").text("Payment Date:", startX + 25, currentY, { continued: true });
        doc.font("Helvetica").text(` ${new Date().toLocaleDateString()}`);
        currentY += 12;
        doc.font("Helvetica-Bold").text("Payment Status:", startX + 25, currentY, { continued: true });
        doc.font("Helvetica-Bold").fillColor("#D35400").text(" PARTIAL - PENDING BALANCE");

        // Mensaje y Código de Barras Simulado
        currentY += 25;
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold").text("THANK YOU FOR YOUR BUSINESS!", startX, currentY, { align: "center", width: receiptWidth });

        currentY += 15;
        // Simulación visual de código de barras
        const barcodeX = startX + 75;
        const barcodeW = 205;
        doc.rect(barcodeX, currentY, barcodeW, 25).fill("#000000");
        // Líneas blancas simulando barras
        for (let i = 5; i < barcodeW; i += 8) {
          doc.rect(barcodeX + i, currentY, 3, 25).fill("#FFFFFF");
        }

        currentY += 32;
        doc.fontSize(6).font("Helvetica").fillColor("#666666");
        doc.text("MANAGE YOUR ACCOUNT & VIEW INVOICES ONLINE:", startX, currentY, { align: "center", width: receiptWidth });
        currentY += 9;
        doc.font("Helvetica-Bold").fillColor("#DAA520").text("WWW.TRULINKFIBER.COM/SUPPORT", startX, currentY, { align: "center", width: receiptWidth });
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