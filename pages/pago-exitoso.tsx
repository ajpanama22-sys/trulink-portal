import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import { theme } from "../lib/theme";
import { Card, Badge, Button, DataRow, estadoToTone } from "../lib/ui";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function PagoExitoso() {
  const router = useRouter();
  const { session_id, order_id, method, amount } = router.query;
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const emailSentRef = useRef(false);

  const methodStr = Array.isArray(method) ? method[0] : method;
  const singleOrderId = Array.isArray(order_id) ? order_id[0] : order_id;
  const rawAmount = Array.isArray(amount) ? amount[0] : amount;

  useEffect(() => {
    if (singleOrderId) {
      const processPaymentAndEmail = async () => {
        try {
          const isTransferencia = methodStr === 'transferencia' || methodStr === 'ach';
          const newStatus = isTransferencia ? 'en_verificacion' : 'pagado';

          // Buscamos la cotización aceptando tanto el UUID real (id) como
          // la referencia (QT-XXXXXX / ESP-XXXXXX), igual que checkout.tsx.
          // Antes esto buscaba solo por "id" y como Stripe/PayPal reciben
          // la referencia, nunca encontraba la fila -> caía en datos vacíos
          // y el correo se enviaba al fallback en vez de al cliente real.
          let query = supabase.from('quotes').select('*');
          if (typeof singleOrderId === 'string' && isNaN(Number(singleOrderId))) {
            query = query.eq('referencia', singleOrderId);
          } else {
            query = query.or(`id.eq.${singleOrderId},referencia.eq.${singleOrderId}`);
          }

          const { data, error } = await query.maybeSingle();

          if (error) {
            console.error("Error al obtener la orden de Supabase:", error);
          }

          const activeData = data || {};
          setOrderInfo(activeData);

          // Actualizamos el status usando el id real (UUID) de la fila
          // encontrada, no el valor crudo de la URL.
          if (activeData.id) {
            const { error: updateError } = await supabase
              .from('quotes')
              .update({ status: newStatus })
              .eq('id', activeData.id);

            if (updateError) {
              console.error("Error al actualizar status de la orden:", updateError);
            }
          } else {
            console.warn("No se encontró ninguna cotización con el identificador:", singleOrderId);
          }

          const dbTotal = Number(activeData.total || activeData.monto || activeData.subtotal || 0);
          const currentTotal = dbTotal > 0 ? dbTotal : (rawAmount ? Number(rawAmount) : 0);
          const currentPaid = rawAmount ? Number(rawAmount) : currentTotal;
          const balance = Math.max(0, currentTotal - currentPaid);
          const fullPay = balance === 0;
          const docType = fullPay ? "FACTURA" : "RECIBO DE PAGO";

          if (!emailSentRef.current) {
            emailSentRef.current = true;

            const clientEmail = activeData.client_email || activeData.email || activeData.correo || "ajpanama22@gmail.com";
            const clientName = activeData.client_name || activeData.representante || activeData.nombre || "Alfredo Abdel Jurado Madrigal";

            const emailRes = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: clientEmail,
                subject: `${docType} #${singleOrderId} - Trulink Fiber LLC`,
                htmlContent: `
                  <div style="background-color:#000; color:#DAA520; padding:30px; font-family:sans-serif; border-radius:10px;">
                    <h2 style="color:#DAA520; border-bottom:1px solid #DAA520; padding-bottom:10px;">Trulink Fiber LLC - Notificación de Pago</h2>
                    <p style="color:#fff; font-size:16px;">Estimado/a <strong>${clientName}</strong>,</p>
                    <p style="color:#fff; font-size:15px;">Hemos registrado exitosamente su pago correspondiente a la referencia <strong style="color:#DAA520;">#${singleOrderId}</strong>.</p>
                    <div style="background:#111; border:1px solid #DAA520; padding:15px; border-radius:8px; margin:20px 0; color:#fff;">
                      <p><strong>Tipo de Documento:</strong> ${docType}</p>
                      <p><strong>Monto Total Cotización:</strong> $${currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                      <p><strong>Monto Pagado:</strong> <span style="color:#2b7a0b; font-weight:bold;">$${currentPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span></p>
                      <p><strong>Saldo Pendiente:</strong> $${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                      <p><strong>Método:</strong> ${(methodStr || "En línea").toUpperCase()}</p>
                    </div>
                    <p style="color:#bbb; font-size:13px;">Atentamente,<br/>Departamento de Administración y Operaciones<br/>Trulink Fiber LLC</p>
                  </div>
                `,
                pdfUrl: activeData.pdf_url || null,
              })
            });

            const emailResultText = await emailRes.text();
            console.log("Respuesta de /api/send-email:", emailRes.status, emailResultText);
          }

        } catch (err) {
          console.error("Error crítico al procesar orden:", err);
        } finally {
          setLoading(false);
        }
      };
      processPaymentAndEmail();
    } else {
      setLoading(false);
    }
  }, [singleOrderId, methodStr, rawAmount]);

  const dbTotal = Number(orderInfo?.total || orderInfo?.monto || orderInfo?.subtotal || 0);
  const totalAmount = dbTotal > 0 ? dbTotal : (rawAmount ? Number(rawAmount) : 0);
  const paidAmount = rawAmount ? Number(rawAmount) : totalAmount;
  const balanceAmount = Math.max(0, totalAmount - paidAmount);
  const isFullPayment = balanceAmount === 0;
  const documentType = isFullPayment ? "FACTURA" : "RECIBO DE PAGO";
  const isTransferencia = methodStr === 'transferencia' || methodStr === 'ach';

  const currentDate = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ backgroundColor: theme.background, color: theme.gold, minHeight: "100vh", padding: "50px 20px", fontFamily: theme.fontFamily, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", boxSizing: "border-box" }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.35), inset 0 0 25px rgba(218, 165, 32, 0.1); }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
        }
        .container-pulse {
          animation: pulse-border 4s infinite ease-in-out;
        }
        @media print {
          body, html {
            background-color: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-card {
            background-color: #ffffff !important;
            border: 1px solid ${theme.gold} !important;
            box-shadow: none !important;
            color: #111111 !important;
          }
        }
      `}</style>

      <div className="container-pulse printable-card" style={{ maxWidth: "720px", width: "100%", boxSizing: "border-box" }}>
        <Card style={{ padding: "45px 35px", textAlign: "center" }}>

        <div className="no-print">
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "20px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />

          {loading ? (
            <div style={{ padding: "30px 0" }}>
              <p style={{ color: theme.textMuted, fontSize: "1.1rem", fontStyle: "italic" }}>Procesando transacción y enviando comprobante...</p>
            </div>
          ) : isTransferencia ? (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: theme.gold, fontSize: "1.8rem", marginBottom: "10px", fontWeight: 700, letterSpacing: "1px" }}>¡Instrucciones Registradas!</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: theme.gold, margin: "0 auto 15px auto", opacity: 0.8 }}></div>
              <p style={{ color: theme.textMuted, fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
                Hemos registrado su selección de pago y enviado el comprobante correspondiente a <strong style={{ color: theme.gold }}>{orderInfo?.client_email || orderInfo?.email || orderInfo?.correo || "ajpanama22@gmail.com"}</strong>.
              </p>
              <div style={{ marginTop: "16px" }}>
                <Badge tone={estadoToTone("en_verificacion")}>EN VERIFICACIÓN</Badge>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: theme.green, fontSize: "1.8rem", marginBottom: "10px", fontWeight: 700, letterSpacing: "1px" }}>¡Transacción Exitosa!</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: theme.green, margin: "0 auto 15px auto", opacity: 0.8 }}></div>
              <p style={{ color: theme.textMuted, fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
                Su pago se ha procesado con éxito y se ha enviado la {documentType.toLowerCase()} a <strong style={{ color: theme.gold }}>{orderInfo?.client_email || orderInfo?.email || orderInfo?.correo || "ajpanama22@gmail.com"}</strong>.
              </p>
              <div style={{ marginTop: "16px" }}>
                <Badge tone="success">PAGADO</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Voucher Document Box */}
        <div style={{ width: "100%", backgroundColor: theme.background, border: `1px solid ${theme.borderGold}`, padding: "30px", borderRadius: theme.radiusLg, textAlign: "left", color: theme.gold, margin: "10px 0 30px 0", boxSizing: "border-box", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.8)" }}>

          <div style={{ textAlign: "center", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "18px", marginBottom: "20px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber LLC" style={{ width: "100px", height: "auto", marginBottom: "8px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.2))" }} />
            <div style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "2px 0" }}>5203 Juan Tabo Blvd. NE Suite 2a</div>
            <div style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "2px 0" }}>Albuquerque, NM, 87111, USA</div>
            <div style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "2px 0" }}>info@trulinkfiber.com</div>
          </div>

          <div style={{ background: theme.goldGradient, color: "#1A1400", fontSize: "0.95rem", fontWeight: 700, textAlign: "center", padding: "10px", margin: "0 0 20px 0", borderRadius: theme.radiusSm, border: `1px solid ${theme.gold}`, letterSpacing: "1px" }}>
            {documentType} {isFullPayment ? "(100% - CONTADO)" : "(ANTICIPO / PARCIAL)"}
          </div>

          <div style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "20px", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "15px", lineHeight: "1.6" }}>
            <DataRow label="Fecha" valor={currentDate} />
            <DataRow label="Referencia / ID" valor={<strong style={{ color: theme.gold }}>{`#${singleOrderId || "N/D"}`}</strong>} />
            <DataRow label="Cliente" valor={orderInfo?.client_name || orderInfo?.representante || orderInfo?.nombre || "Alfredo Abdel Jurado Madrigal"} />
            <DataRow label="Correo Electrónico" valor={orderInfo?.client_email || orderInfo?.email || orderInfo?.correo || "ajpanama22@gmail.com"} />
            <DataRow label="Método de Pago" valor={methodStr ? methodStr.toUpperCase() : "Pasarela / En Línea"} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", borderRadius: theme.radiusSm, overflow: "hidden" }}>
            <thead>
              <tr style={{ backgroundColor: theme.panelBg, borderBottom: `1px solid ${theme.borderGold}` }}>
                <th style={{ color: theme.gold, fontSize: "0.85rem", padding: "12px", textAlign: "left", width: "70%", fontWeight: 600 }}>Concepto / Descripción</th>
                <th style={{ color: theme.gold, fontSize: "0.85rem", padding: "12px", textAlign: "right", width: "30%", fontWeight: 600 }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "14px 12px", fontSize: "0.85rem", borderBottom: `1px solid ${theme.borderGoldLight}`, backgroundColor: theme.sidebarBg, verticalAlign: "top", color: theme.textLight }}>
                  <strong style={{ color: theme.gold }}>{isFullPayment ? "FACTURA COMERCIAL - PAGO TOTAL" : "RECIBO DE ANTICIPO / PAGO PARCIAL"}</strong><br />
                  <span style={{ color: theme.textMuted, fontSize: "0.75rem", lineHeight: "1.4", display: "inline-block", marginTop: "4px" }}>
                    {orderInfo?.descripcion || orderInfo?.description || (isFullPayment ? "Liquidación total de orden para suministro y fabricación." : "Monto parcial transferido para la orden.")}
                  </span>
                </td>
                <td style={{ padding: "14px 12px", fontSize: "0.9rem", borderBottom: `1px solid ${theme.borderGoldLight}`, backgroundColor: theme.sidebarBg, textAlign: "right", verticalAlign: "middle", fontWeight: 700, color: theme.gold }}>
                  ${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ backgroundColor: theme.sidebarBg, border: `1px solid ${theme.borderGoldLight}`, borderRadius: theme.radiusMd, padding: "15px", marginBottom: "20px" }}>
            <DataRow label="Monto Total Cotización" valor={`$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`} />
            <DataRow label="Monto Recibido" valor={<strong style={{ color: theme.green }}>{`$${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`}</strong>} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", fontWeight: 700, paddingTop: "10px", borderTop: `1px solid ${theme.borderGoldLight}`, color: theme.gold }}>
              <span>Saldo Pendiente:</span>
              <span>${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
            </div>
          </div>

          <div style={{ fontSize: "0.75rem", color: theme.textMuted, backgroundColor: theme.sidebarBg, border: `1px solid ${theme.borderGoldLight}`, borderLeft: `3px solid ${theme.gold}`, padding: "12px", borderRadius: theme.radiusSm, marginBottom: "20px", lineHeight: "1.5", textAlign: "justify" }}>
            <strong style={{ color: theme.gold }}>Condiciones:</strong>{" "}
            {isFullPayment
              ? "Esta orden ha sido pagada al 100%. Factura emitida para efectos fiscales y de garantía."
              : `El saldo pendiente de $${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD debe ser liquidado previo a la entrega final.`}
          </div>

          <div style={{ textAlign: "center", fontSize: "0.75rem", color: theme.textMuted, borderTop: `1px dashed ${theme.borderGoldLight}`, paddingTop: "12px", lineHeight: "1.4" }}>
            <strong style={{ color: theme.gold, fontSize: "0.8rem", letterSpacing: "0.5px" }}>¡GRACIAS POR SU CONFIANZA!</strong><br />
            www.trulinkfiber.com
          </div>

        </div>

        <div className="no-print" style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap", marginTop: "10px" }}>
          <Button variant="gold" onClick={() => window.print()}>
            Imprimir / Guardar Comprobante
          </Button>
          <Button variant="outline-gold" onClick={() => router.push('/')}>
            Volver al Inicio
          </Button>
        </div>

        </Card>
      </div>

      <p className="no-print" style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.borderGoldCounter, textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
