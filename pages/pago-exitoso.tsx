import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function PagoExitoso() {
  const router = useRouter();
  const { session_id, order_id, method, type } = router.query;
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  // Normalizar el método y tipo de pago
  const methodStr = Array.isArray(method) ? method[0] : method;
  const paymentType = Array.isArray(type) ? type[0] : type; // 'full' o 'anticipo'

  useEffect(() => {
    if (order_id) {
      const updateOrderStatus = async () => {
        try {
          const newStatus = methodStr === 'transferencia' || methodStr === 'ach' ? 'en_verificacion' : 'pagado';
          
          await supabase
            .from('quotes')
            .update({ status: newStatus })
            .eq('id', order_id);
          
          const { data } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', order_id)
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
  }, [order_id, methodStr]);

  const isTransferencia = methodStr === 'transferencia' || methodStr === 'ach';

  // Obtener montos reales de la base de datos o usar respaldos seguros
  const totalAmount = orderInfo?.total || orderInfo?.monto_total || 25000.00;
  
  // Determinar si es pago completo (por parámetro o por defecto si viene de pasarela de pago total)
  const isFullPayment = paymentType === 'full' || methodStr === 'stripe' || methodStr === 'paypal';
  
  const paidAmount = isFullPayment ? totalAmount : totalAmount / 2;
  const balanceAmount = isFullPayment ? 0 : totalAmount / 2;

  const currentDate = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const singleOrderId = Array.isArray(order_id) ? order_id[0] : order_id;

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
            <p style={{ color: "#ccc", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "25px" }}>
              Recibirá un correo electrónico de confirmación tan pronto nuestro departamento financiero verifique la entrada del monto correspondiente en nuestra cuenta.
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
          
          {/* Cabecera del Recibo */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #DAA520", paddingBottom: "10px", marginBottom: "10px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber LLC" style={{ width: "90px", height: "auto", marginBottom: "4px" }} />
            <div style={{ fontSize: "6.5pt", color: "#555", margin: "1px 0" }}>5203 Juan Tabo Blvd. NE Suite 2a</div>
            <div style={{ fontSize: "6.5pt", color: "#555", margin: "1px 0" }}>Albuquerque, NM, 87111, USA</div>
            <div style={{ fontSize: "6.5pt", color: "#555", margin: "1px 0" }}>info@trulinkfiber.com</div>
          </div>

          {/* Banner Título Recibo Dinámico */}
          <div style={{ backgroundColor: "#1a1a1a", color: "#DAA520", fontSize: "9pt", fontWeight: "bold", textAlign: "center", padding: "6px", margin: "10px 0", borderRadius: "3px", letterSpacing: "0.5px" }}>
            {isFullPayment ? `RECIBO DE PAGO COMPLETO (100%) #${singleOrderId || "2026-0185"}` : `RECIBO DE ANTICIPO 50% #${singleOrderId || "2026-0185"}`}
          </div>

          {/* Metadatos */}
          <div style={{ fontSize: "7.5pt", color: "#333", marginBottom: "10px", borderBottom: "1px solid #ddd", paddingBottom: "8px", lineHeight: "1.5" }}>
            <div><strong>Fecha:</strong> {currentDate}</div>
            <div><strong>Cotización Asociada:</strong> <span style={{ color: "#DAA520", fontWeight: "bold" }}>#{singleOrderId || "QT-2026-094"}</span></div>
            <div><strong>Cliente:</strong> {orderInfo?.client_name || "IGTEL Integración S.A."}</div>
            <div><strong>Tipo de Cliente:</strong> {orderInfo?.client_type || "Integrador (Lista C)"}</div>
            <div><strong>Método de Pago:</strong> {methodStr ? methodStr.toUpperCase() : "Transferencia / Pasarela"}</div>
          </div>

          {/* Tabla de Concepto */}
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
                  <strong>{isFullPayment ? "PAGO TOTAL - CONTADO" : "ANTICIPO-50"}</strong><br />
                  <span style={{ color: "#666", fontSize: "6.5pt" }}>
                    {isFullPayment ? "Liquidación total (100%) - Orden de fabricación y suministro." : "Anticipo (50%) - Orden de fabricación y suministro de componentes de fibra óptica."}
                  </span>
                </td>
                <td style={{ padding: "6px", fontSize: "7.5pt", border: "1px solid #e0dbd1", backgroundColor: "#fff", textAlign: "right", verticalAlign: "middle" }}>
                  <strong style={{ color: "#111" }}>${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totales Dinámicos */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "5px 8px", fontSize: "8pt", fontWeight: "bold", color: "#333", backgroundColor: "#f4f1ea", border: "1px solid #e0dbd1" }}>Monto Total Cotización:</td>
                <td style={{ padding: "5px 8px", fontSize: "8pt", textAlign: "right", border: "1px solid #e0dbd1", backgroundColor: "#fff" }}>${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
              </tr>
              <tr>
                <td style={{ padding: "5px 8px", fontSize: "8pt", fontWeight: "bold", color: "#2b7a0b", backgroundColor: "#f4f1ea", border: "1px solid #e0dbd1" }}>
                  {isFullPayment ? "Monto Pagado (100%):" : "Anticipo Recibido (50%):"}
                </td>
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

          {/* Términos y Condiciones Dinámicos */}
          <div style={{ fontSize: "7pt", color: "#444", backgroundColor: "#f4f1ea", border: "1px solid #e0dbd1", borderLeft: "3px solid #DAA520", padding: "8px", marginBottom: "10px", textAlign: "justify", lineHeight: "1.4" }}>
            {isFullPayment ? (
              <strong>Estado de Cuenta:</strong>
            ) : (
              <strong>Condiciones de Liquidación:</strong>
            )}{" "}
            {isFullPayment 
              ? "Esta cotización ha sido pagada en su totalidad (100%). La orden pasa inmediatamente a proceso de fabricación y despacho según los tiempos acordados."
              : `El 50% restante ($${balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD) debe ser liquidado en su totalidad a más tardar 3 días antes de la fecha estimada de finalización de producción o entrega de mercancía, según lo estipulado en las políticas de Trulink Fiber LLC.`}
          </div>

          {/* Pie de Recibo */}
          <div style={{ textAlign: "center", fontSize: "7pt", color: "#555", borderTop: "1px dashed #ccc", paddingTop: "8px", lineHeight: "1.4" }}>
            {isFullPayment ? "Este comprobante certifica el pago total (100%) de la cotización correspondiente." : "Este comprobante certifica la recepción del anticipo inicial equivalente al 50%, vinculado de manera formal a la cotización correspondiente."}<br /><br />
            <strong style={{ color: "#111", fontSize: "7.5pt" }}>¡GRACIAS POR SU CONFIANZA!</strong><br />
            www.trulinkfiber.com
          </div>

        </div>

        <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap", marginTop: "20px" }}>
          <button className="btn-gold" onClick={() => window.print()}>
            Imprimir / Guardar Recibo
          </button>
          <button className="btn-gold" onClick={() => router.push('/')} style={{ backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520" }}>
            Volver al Inicio del Portal
          </button>
        </div>
      </div>
    </div>
  );
}