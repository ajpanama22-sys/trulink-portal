import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

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
          
          await supabase
            .from('quotes')
            .update({ status: newStatus })
            .eq('id', singleOrderId);
          
          const { data, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', singleOrderId)
            .single();
            
          if (error) {
            console.error("Error al obtener la orden de Supabase:", error);
          }

          const activeData = data || {};
          setOrderInfo(activeData);

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
                `
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
    <div style={{ backgroundColor: "#000000", color: "#DAA520", minHeight: "100vh", padding: "50px 20px", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", boxSizing: "border-box" }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000000 !important;
          color: #DAA520;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.35), inset 0 0 25px rgba(218, 165, 32, 0.1); }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
        }
        .container-pulse { 
          animation: pulse-border 4s infinite ease-in-out; 
        }
        .btn-gold { 
          background: linear-gradient(135deg, #DAA520 0%, #B8860B 100%) !important;
          color: #000000 !important;
          padding: 14px 28px; 
          border-radius: 12px; 
          border: none; 
          cursor: pointer; 
          font-weight: 600; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          display: inline-block;
          font-size: 0.95rem;
          box-shadow: 0 4px 15px rgba(218, 165, 32, 0.2);
        }
        .btn-gold:hover { 
          filter: brightness(1.15);
          transform: translateY(-2px); 
          box-shadow: 0 6px 20px rgba(218, 165, 32, 0.4); 
        }
        .btn-outline-gold {
          background-color: transparent;
          color: #DAA520;
          border: 1px solid rgba(218, 165, 32, 0.5);
          padding: 12px 28px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          display: inline-block;
          font-size: 0.95rem;
        }
        .btn-outline-gold:hover {
          background-color: rgba(218, 165, 32, 0.1);
          border-color: #DAA520;
          transform: translateY(-2px);
          box-shadow: 0 0 15px rgba(218, 165, 32, 0.2);
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
            border: 1px solid #DAA520 !important;
            box-shadow: none !important;
            color: #111111 !important;
          }
        }
      `}</style>

      <div className="container-pulse printable-card" style={{ maxWidth: "720px", width: "100%", backgroundColor: "#060606", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "45px 35px", borderRadius: "24px", textAlign: "center", boxSizing: "border-box" }}>
        
        <div className="no-print">
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "20px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
          
          {loading ? (
            <div style={{ padding: "30px 0" }}>
              <p style={{ color: "#C0C0C0", fontSize: "1.1rem", fontStyle: "italic" }}>Procesando transacción y enviando comprobante...</p>
            </div>
          ) : isTransferencia ? (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "10px", fontWeight: "700", letterSpacing: "1px" }}>¡Instrucciones Registradas!</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto 15px auto", opacity: "0.8" }}></div>
              <p style={{ color: "#C0C0C0", fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
                Hemos registrado su selección de pago y enviado el comprobante correspondiente a <strong style={{ color: "#DAA520" }}>{orderInfo?.client_email || orderInfo?.email || orderInfo?.correo || "ajpanama22@gmail.com"}</strong>.
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "10px", fontWeight: "700", letterSpacing: "1px" }}>¡Transacción Exitosa!</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto 15px auto", opacity: "0.8" }}></div>
              <p style={{ color: "#C0C0C0", fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
                Su pago se ha procesado con éxito y se ha enviado la {documentType.toLowerCase()} a <strong style={{ color: "#DAA520" }}>{orderInfo?.client_email || orderInfo?.email || orderInfo?.correo || "ajpanama22@gmail.com"}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Voucher Document Box */}
        <div style={{ width: "100%", backgroundColor: "#0a0a0a", border: "1px solid rgba(218, 165, 32, 0.4)", padding: "30px", borderRadius: "16px", textAlign: "left", color: "#DAA520", margin: "10px 0 30px 0", boxSizing: "border-box", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.8)" }}>
          
          <div style={{ textAlign: "center", borderBottom: "1px solid rgba(218, 165, 32, 0.25)", paddingBottom: "18px", marginBottom: "20px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber LLC" style={{ width: "100px", height: "auto", marginBottom: "8px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.2))" }} />
            <div style={{ fontSize: "0.75rem", color: "#A0A0A0", margin: "2px 0" }}>5203 Juan Tabo Blvd. NE Suite 2a</div>
            <div style={{ fontSize: "0.75rem", color: "#A0A0A0", margin: "2px 0" }}>Albuquerque, NM, 87111, USA</div>
            <div style={{ fontSize: "0.75rem", color: "#A0A0A0", margin: "2px 0" }}>info@trulinkfiber.com</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, rgba(218, 165, 32, 0.15) 0%, rgba(184, 134, 11, 0.05) 100%)", color: "#DAA520", fontSize: "0.95rem", fontWeight: "700", textAlign: "center", padding: "10px", margin: "0 0 20px 0", borderRadius: "8px", border: "1px solid rgba(218, 165, 32, 0.3)", letterSpacing: "1px" }}>
            {documentType} {isFullPayment ? "(100% - CONTADO)" : "(ANTICIPO / PARCIAL)"}
          </div>

          <div style={{ fontSize: "0.85rem", color: "#C0C0C0", marginBottom: "20px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "15px", lineHeight: "1.6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span><strong>Fecha:</strong></span> <span>{currentDate}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span><strong>Referencia / ID:</strong></span> <span style={{ color: "#DAA520", fontWeight: "700" }}>#{singleOrderId || "N/D"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span><strong>Cliente:</strong></span> <span>{orderInfo?.client_name || orderInfo?.representante || orderInfo?.nombre || "Alfredo Abdel Jurado Madrigal"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span><strong>Correo Electrónico:</strong></span> <span>{orderInfo?.client_email || orderInfo?.email || orderInfo?.correo || "ajpanama22@gmail.com"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span><strong>Método de Pago:</strong></span> <span>{methodStr ? methodStr.toUpperCase() : "Pasarela / En Línea"}</span></div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", borderRadius: "8px", overflow: "hidden" }}>
            <thead>
              <tr style={{ backgroundColor: "#141414", borderBottom: "1px solid rgba(218, 165, 32, 0.3)" }}>
                <th style={{ color: "#DAA520", fontSize: "0.85rem", padding: "12px", textAlign: "left", width: "70%", fontWeight: "600" }}>Concepto / Descripción</th>
                <th style={{ color: "#DAA520", fontSize: "0.85rem", padding: "12px", textAlign: "right", width: "30%", fontWeight: "600" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "14px 12px", fontSize: "0.85rem", borderBottom: "1px solid rgba(218, 165, 32, 0.1)", backgroundColor: "#050505", verticalAlign: "top", color: "#FFFFFF" }}>
                  <strong style={{ color: "#DAA520" }}>{isFullPayment ? "FACTURA COMERCIAL - PAGO TOTAL" : "RECIBO DE ANTICIPO / PAGO PARCIAL"}</strong><br />
                  <span style={{ color: "#A0A0A0", fontSize: "0.75rem", lineHeight: "1.4", display: "inline-block", marginTop: "4px" }}>
                    {orderInfo?.descripcion || orderInfo?.description || (isFullPayment ? "Liquidación total de orden para suministro y fabricación." : "Monto parcial transferido para la orden.")}
                  </span>
                </td>
                <td style={{ padding: "14px 12px", fontSize: "0.9rem", borderBottom: "1px solid rgba(218, 165, 32, 0.1)", backgroundColor: "#050505", textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: "#DAA520" }}>
                  ${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ backgroundColor: "#050505", border: "1px solid rgba(218, 165, 32, 0.25)", borderRadius: "10px", padding: "15px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "8px", color: "#C0C0C0" }}>
              <span>Monto Total Cotización:</span>
              <span style={{ fontWeight: "600" }}>${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "10px", color: "#4bb543" }}>
              <span>Monto Recibido:</span>
              <span style={{ fontWeight: "700" }}>${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", fontWeight: "700", paddingTop: "10px", borderTop: "1px solid rgba(218, 165, 32, 0.2)", color: "#DAA520" }}>
              <span>Saldo Pendiente:</span>
              <span>${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
            </div>
          </div>

          <div style={{ fontSize: "0.75rem", color: "#B0B0B0", backgroundColor: "#050505", border: "1px solid rgba(218, 165, 32, 0.2)", borderLeft: "3px solid #DAA520", padding: "12px", borderRadius: "8px", marginBottom: "20px", lineHeight: "1.5", textAlign: "justify" }}>
            <strong style={{ color: "#DAA520" }}>Condiciones:</strong>{" "}
            {isFullPayment 
              ? "Esta orden ha sido pagada al 100%. Factura emitida para efectos fiscales y de garantía."
              : `El saldo pendiente de $${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD debe ser liquidado previo a la entrega final.`}
          </div>

          <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#909090", borderTop: "1px dashed rgba(218, 165, 32, 0.2)", paddingTop: "12px", lineHeight: "1.4" }}>
            <strong style={{ color: "#DAA520", fontSize: "0.8rem", letterSpacing: "0.5px" }}>¡GRACIAS POR SU CONFIANZA!</strong><br />
            www.trulinkfiber.com
          </div>

        </div>

        <div className="no-print" style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap", marginTop: "10px" }}>
          <button className="btn-gold" onClick={() => window.print()}>
            Imprimir / Guardar Comprobante
          </button>
          <button className="btn-outline-gold" onClick={() => router.push('/')}>
            Volver al Inicio
          </button>
        </div>

      </div>

      <p className="no-print" style={{ marginTop: "35px", fontSize: "0.75rem", color: "rgba(218, 165, 32, 0.7)", textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}