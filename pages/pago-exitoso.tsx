import { useEffect, useState } from "react";
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

  const methodStr = Array.isArray(method) ? method[0] : method;
  const singleOrderId = Array.isArray(order_id) ? order_id[0] : order_id;
  const rawAmount = Array.isArray(amount) ? amount[0] : amount;

  useEffect(() => {
    if (singleOrderId) {
      const updateOrderStatus = async () => {
        try {
          const newStatus = methodStr === 'transferencia' || methodStr === 'ach' ? 'en_verificacion' : 'pagado';
          
          await supabase
            .from('quotes')
            .update({ status: newStatus })
            .eq('id', singleOrderId);
          
          const { data } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', singleOrderId)
            .single();
            
          setOrderInfo(data);
        } catch (err) {
          console.error("Error al actualizar estado de la orden:", err);
        } finally {
          setLoading(false);
        }
      };
      updateOrderStatus();
    } else {
      setLoading(false);
    }
  }, [singleOrderId, methodStr]);

  const isTransferencia = methodStr === 'transferencia' || methodStr === 'ach';

  // Cálculos basados estrictamente en la base de datos o en los parámetros reales recibidos
  const totalAmount = orderInfo?.total_amount || orderInfo?.total || (rawAmount ? Number(rawAmount) : 0);
  const paidAmount = rawAmount ? Number(rawAmount) : totalAmount;
  const balanceAmount = Math.max(0, totalAmount - paidAmount);
  const isFullPayment = balanceAmount === 0;

  const currentDate = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px 20px", fontFamily: "sans-serif", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <style jsx global>{`
        .btn-gold { 
          background-color: #DAA520; 
          color: #000; 
          padding: 15px 35px; 
          border-radius: 10px; 
          border: none; 
          cursor: pointer; 
          font-weight: bold; 
          transition: transform 0.3s, box-shadow 0.3s;
          text-decoration: none;
          display: inline-block;
          font-size: 1rem;
        }
        .btn-gold:hover { 
          transform: scale(1.05); 
          box-shadow: 0 0 20px #DAA520; 
        }
        .container-pulse { 
          animation: pulse-border 2.5s infinite; 
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.4); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.8); }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.4); }
        }
      `}</style>

      <div className="container-pulse" style={{ maxWidth: "680px", width: "100%", backgroundColor: "#050505", border: "2px solid #DAA520", padding: "40px 30px", borderRadius: "20px", textAlign: "center" }}>
        <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "20px", filter: "drop-shadow(0 0 8px rgba(218,165,32,0.3))" }} />
        
        {loading ? (
          <p style={{ color: "#FFF", fontSize: "1.1rem" }}>Procesando y validando información...</p>
        ) : isTransferencia ? (
          <div>
            <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "15px", letterSpacing: "1px" }}>¡Instrucciones de Pago Registradas!</h1>
            <div style={{ width: "60px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto 20px auto" }}></div>
            <p style={{ color: "#FFF", fontSize: "1.05rem", lineHeight: "1.7", marginBottom: "20px" }}>
              Hemos registrado su selección de pago mediante transferencia bancaria o ACH {singleOrderId ? <strong style={{ color: "#DAA520" }}>para la cotización #{singleOrderId}</strong> : ""}. 
            </p>
          </div>
        ) : (
          <div>
            <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "15px", letterSpacing: "1px" }}>¡Transacción Exitosa!</h1>
            <div style={{ width: "60px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto 20px auto" }}></div>
            <p style={{ color: "#FFF", fontSize: "1.05rem", lineHeight: "1.7", marginBottom: "15px" }}>
              Su pago en línea ha sido procesado de forma segura y exitosa.
            </p>
          </div>
        )}

        {/* RECIBO ESTILO POS INTEGRADO */}
        <div style={{ width: "100%", backgroundColor: "#fcfbf9", border: "2px solid #DAA520", padding: "16px", borderRadius: "8px", textAlign: "left", color: "#111", margin: "25px 0", boxSizing: "border-box" }}>
          
          <div style={{ textAlign: "center", borderBottom: "2px solid #DAA520", paddingBottom: "10px", marginBottom: "10px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber LLC" style={{ width: "90px", height: "auto", marginBottom: "4px" }} />
            <div style={{ fontSize: "6.5pt", color: "#555", margin: "1px 0" }}>5203 Juan Tabo Blvd. NE Suite 2a</div>
            <div style={{ fontSize: "6.5pt", color: "#555", margin: "1px 0" }}>Albuquerque, NM, 87111, USA</div>
            <div style={{ fontSize: "6.5pt", color: "#555", margin: "1px 0" }}>info@trulinkfiber.com</div>
          </div>

          <div style={{ backgroundColor: "#1a1a1a", color: "#DAA520", fontSize: "9pt", fontWeight: "bold", textAlign: "center", padding: "6px", margin: "10px 0", borderRadius: "3px", letterSpacing: "0.5px" }}>
            {isFullPayment ? `RECIBO DE PAGO COMPLETO (100%)` : `RECIBO DE ANTICIPO / PAGO PARCIAL`}
          </div>

          <div style={{ fontSize: "7.5pt", color: "#333", marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "8px", lineHeight: "1.5" }}>
            <div><strong>Fecha:</strong> {currentDate}</div>
            <div><strong>Referencia / ID:</strong> <span style={{ color: "#DAA520", fontWeight: "bold" }}>#{singleOrderId || "N/D"}</span></div>
            <div><strong>Cliente:</strong> {orderInfo?.client_name || orderInfo?.nombre || "Cliente General"}</div>
            <div><strong>Método de Pago:</strong> {methodStr ? methodStr.toUpperCase() : "Pasarela / En Línea"}</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
            <thead>
              <tr>
                <th style={{ backgroundColor: "#1a1a1a", color: "#DAA520", fontSize: "7.5pt", padding: "6px", textAlign: "left", border: "1px solid #1a1a1a", width: "70%" }}>Concepto / Descripción</th>
                <th style={{ backgroundColor: "#1a1a1a", color: "#DAA520", fontSize: "7.5pt", padding: "6px", textAlign: "right", border: "1px solid #1a1a1a", width: "30%" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "6px", fontSize: "7.5pt", border: "1px solid #e0dbd1", backgroundColor: "#fff", verticalAlign: "top" }}>
                  <strong>{isFullPayment ? "PAGO TOTAL - CONTADO" : "PAGO PARCIAL / ANTICIPO"}</strong><br />
                  <span style={{ color: "#666", fontSize: "6.5pt" }}>
                    {isFullPayment ? "Liquidación total (100%) de la orden." : "Monto parcial transferido por el cliente."}
                  </span>
                </td>
                <td style={{ padding: "6px", fontSize: "7.5pt", border: "1px solid #e0dbd1", backgroundColor: "#fff", textAlign: "right", verticalAlign: "middle" }}>
                  <strong style={{ color: "#111" }}>${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "5px 8px", fontSize: "8pt", fontWeight: "bold", color: "#333", backgroundColor: "#f4f1ea", border: "1px solid #e0dbd1" }}>Monto Total Cotización:</td>
                <td style={{ padding: "5px 8px", fontSize: "8pt", textAlign: "right", border: "1px solid #e0dbd1", backgroundColor: "#fff" }}>${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
              </tr>
              <tr>
                <td style={{ padding: "5px 8px", fontSize: "8pt", fontWeight: "bold", color: "#2b7a0b", backgroundColor: "#f4f1ea", border: "1px solid #e0dbd1" }}>Monto Recibido:</td>
                <td style={{ padding: "5px 8px", fontSize: "8pt", textAlign: "right", fontWeight: "bold", color: "#2b7a0b", border: "1px solid #e0dbd1", backgroundColor: "#fff" }}>
                  ${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </td>
              </tr>
              <tr style={{ backgroundColor: "#1a1a1a", color: "#DAA520", fontWeight: "bold" }}>
                <td style={{ padding: "7px 8px", fontSize: "9pt", border: "1px solid #1a1a1a" }}>Saldo Pendiente:</td>
                <td style={{ padding: "7px 8px", fontSize: "9pt", textAlign: "right", border: "1px solid #1a1a1a" }}>${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: "7pt", color: "#444", backgroundColor: "#f4f1ea", border: "1px solid #e0dbd1", borderLeft: "3px solid #DAA520", padding: "8px", marginBottom: "10px", textAlign: "justify", lineHeight: "1.4" }}>
            <strong>Condiciones:</strong>{" "}
            {isFullPayment 
              ? "Esta cotización ha sido pagada en su totalidad (100%)."
              : `El saldo pendiente de $${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD queda registrado para su posterior liquidación.`}
          </div>

          <div style={{ textAlign: "center", fontSize: "7pt", color: "#555", borderTop: "1px dashed #ccc", paddingTop: "8px", lineHeight: "1.4" }}>
            <strong style={{ color: "#111", fontSize: "7.5pt" }}>¡GRACIAS POR SU CONFIANZA!</strong><br />
            www.trulinkfiber.com
          </div>

        </div>

        <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap", marginTop: "20px" }}>
          <button className="btn-gold" onClick={() => window.print()}>
            Imprimir / Guardar Recibo
          </button>
          <button className="btn-gold" onClick={() => router.push('/')} style={{ backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520" }}>
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}