import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type QuoteItem = {
  SKU?: string;
  tipo?: string;
  nombre?: string;
  descripcion?: string;
  hilos?: number;
  longitudKm?: number;
  cantidad?: number;
  precioMetro?: number;
  precioCarrete?: number;
  precioUnitario?: number;
  total?: number;
};

type OrderData = {
  id: string;
  created_at: string;
  total?: number;
  total_amount?: number;
  items: QuoteItem[];
  status: string;
  type?: string;
  client_id?: string;
  user_id?: string;
  referencia?: string;
};

export default function Checkout() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  
  const [montoPago, setMontoPago] = useState<number | string>("");
  const [errorMonto, setErrorMonto] = useState<string>("");

  const [transferStatus, setTransferStatus] = useState<string>('idle');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');

  useEffect(() => {
    if (id) {
      const fetchOrder = async () => {
        let query = supabase.from('quotes').select('*');
        
        if (typeof id === 'string' && isNaN(Number(id))) {
          query = query.eq('referencia', id);
        } else {
          query = query.or(`id.eq.${id},referencia.eq.${id}`);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error("Error al recuperar orden:", error);
        } else if (data && data.length > 0) {
          const foundOrder = data[0];
          setOrder(foundOrder);
          const rawT = foundOrder?.total ?? foundOrder?.total_amount ?? 0;
          const totalVal = typeof rawT === 'number' ? rawT : Number(rawT) || 0;
          setMontoPago(totalVal);
        } else {
          console.warn("No se encontró ningún pedido con el identificador:", id);
        }
        setLoading(false);
      };
      fetchOrder();
    }
  }, [id]);

  const rawTotal = order?.total ?? order?.total_amount ?? 0;
  const granTotal = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0;
  const esProducto = order?.type === 'producto';

  const montoMinimo = granTotal * 0.5;
  const refLabel = order?.referencia || order?.id || "QT-XXXX";

  const handleStripeCheckout = async () => {
    const valorIngresado = Number(montoPago);
    if (isNaN(valorIngresado) || valorIngresado < montoMinimo) {
      setErrorMonto(`El pago no puede procesarse. El monto mínimo permitido es de $${montoMinimo.toFixed(2)} (50%).`);
      return;
    }
    setErrorMonto("");

    try {
      const response = await fetch('/api/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, amount: valorIngresado }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Error al generar la sesión de pago: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Ocurrió un error de red al conectar con Stripe.');
    }
  };

  const handlePayPalCheckout = async () => {
    const valorIngresado = Number(montoPago);
    if (isNaN(valorIngresado) || valorIngresado < montoMinimo) {
      setErrorMonto(`El pago no puede procesarse. El monto mínimo permitido es de $${montoMinimo.toFixed(2)} (50%).`);
      return;
    }
    setErrorMonto("");

    try {
      const response = await fetch('/api/create-paypal-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, amount: valorIngresado }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Error al generar la orden de PayPal: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Ocurrió un error de red al conectar con PayPal.');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorIngresado = Number(montoPago);
    if (isNaN(valorIngresado) || valorIngresado < montoMinimo) {
      setErrorMonto(`El comprobante no puede registrarse. El monto mínimo permitido es de $${montoMinimo.toFixed(2)} (50%).`);
      return;
    }
    setErrorMonto("");

    if (!fileToUpload) {
      alert('Por favor, adjunte el comprobante de transferencia.');
      return;
    }

    setTransferStatus('uploading');
    setUploadMessage('Subiendo comprobante al bucket transferencias y notificando al departamento financiero...');

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const clientId = order?.client_id || order?.user_id || id || 'cliente-general';
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${timestamp}_${clientId}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transferencias')
        .upload(filePath, fileToUpload);

      if (uploadError) {
        throw new Error('Error al subir el archivo al bucket: ' + uploadError.message);
      }

      const { data: publicURLData } = supabase.storage
        .from('transferencias')
        .getPublicUrl(filePath);

      const comprobanteUrl = publicURLData.publicUrl || filePath;

      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'Pendiente de Verificación Bancaria',
          comprobante_url: comprobanteUrl,
          monto_pagado: valorIngresado,
          updated_at: new Date().toISOString()
        })
        .eq('id', order?.id || id);

      if (updateError) {
        console.error('Advertencia al actualizar la tabla quotes:', updateError);
      }

      const emailResponse = await fetch('/api/send-transfer-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: 'fred.jurado@trulinkfiber.com',
          quoteId: refLabel,
          clientName: clientId,
          total: granTotal,
          montoPagado: valorIngresado,
          comprobanteUrl: comprobanteUrl,
        }),
      });

      if (!emailResponse.ok) {
        console.error('Aviso de correo con retraso, pero el comprobante se guardó con éxito en Supabase.');
      }

      setTransferStatus('success');
      setUploadMessage('¡Comprobante adjuntado e instrucciones enviadas con éxito!');
    } catch (err: any) {
      console.error('Error procesando transferencia:', err);
      setTransferStatus('error');
      setUploadMessage('Error al procesar la transferencia: ' + (err.message || 'Desconocido'));
    }
  };

  return (
    <div style={{ backgroundColor: "#000000", color: "#DAA520", minHeight: "100vh", padding: "40px 20px", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>
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
          padding: 14px 24px; 
          border-radius: 12px; 
          border: none; 
          cursor: pointer; 
          font-weight: 600; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          max-width: 350px;
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
          padding: 12px 24px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          max-width: 200px;
          font-size: 0.95rem;
        }
        .btn-outline-gold:hover {
          background-color: rgba(218, 165, 32, 0.1);
          border-color: #DAA520;
          transform: translateY(-2px);
          box-shadow: 0 0 15px rgba(218, 165, 32, 0.2);
        }
        input:focus, select:focus {
          border-color: #DAA520 !important;
          box-shadow: 0 0 12px rgba(218, 165, 32, 0.3), inset 0 1px 3px rgba(0,0,0,0.8) !important;
          outline: none;
        }
      `}</style>

      <div className="container-pulse" style={{ maxWidth: "900px", margin: "0 auto", backgroundColor: "#060606", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "45px", borderRadius: "24px", textAlign: "center", boxSizing: "border-box" }}>
        
        {/* Header / Brand Logo */}
        <div style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "25px", marginBottom: "30px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
          <h1 style={{ color: "#DAA520", fontSize: "1.8rem", fontWeight: "700", letterSpacing: "1.5px", margin: "0 0 5px 0" }}>
            RESUMEN DE CHECKOUT
          </h1>
          <p style={{ color: "#C0C0C0", fontSize: "0.95rem", margin: 0, letterSpacing: "0.5px" }}>
            Trulink Fiber LLC — Pasarela de Pago Segura
          </p>
        </div>
        
        {loading ? (
          <div style={{ padding: "60px 0" }}>
            <p style={{ color: "#C0C0C0", fontSize: "1.1rem", fontStyle: "italic" }}>Cargando detalles del pedido...</p>
          </div>
        ) : order ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px", fontSize: "0.95rem", color: "#C0C0C0", backgroundColor: "#0a0a0a", padding: "14px 20px", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
              <span><strong>Referencia:</strong> <span style={{ color: "#DAA520" }}>{refLabel}</span></span>
              <span><strong>Fecha:</strong> {order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</span>
            </div>

            <div style={{ overflowX: "auto", marginBottom: "25px", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
              <table style={{ margin: "0 auto", borderCollapse: "collapse", color: "#DAA520", width: "100%", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0a0a0a", borderBottom: "1px solid rgba(218, 165, 32, 0.3)" }}>
                    {esProducto && <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>SKU</th>}
                    <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>Descripción / Tipo</th>
                    {!esProducto && <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>Hilos</th>}
                    <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>Cant</th>
                    <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{esProducto ? "P. Unitario" : "P. Unitario / Carrete"}</th>
                    <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items && Array.isArray(order.items) && order.items.map((item, index) => {
                    const skuVal = item.SKU || "-";
                    const desc = item.descripcion || item.nombre || item.tipo || "Artículo";
                    const hilosVal = item.hilos !== undefined ? item.hilos : "-";
                    const cantVal = item.cantidad ?? 1;
                    const unitPrice = Number(item.precioUnitario ?? item.precioCarrete ?? item.precioMetro ?? 0);
                    const itemTotal = item.total ?? (unitPrice * cantVal);

                    return (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#050505" : "#080808", borderBottom: "1px solid rgba(218, 165, 32, 0.1)" }}>
                        {esProducto && <td style={{ padding: "12px", textAlign: "center", color: "#C0C0C0" }}>{skuVal}</td>}
                        <td style={{ padding: "12px", textAlign: "center", color: "#C0C0C0" }}>{desc}</td>
                        {!esProducto && <td style={{ padding: "12px", textAlign: "center", color: "#C0C0C0" }}>{hilosVal}</td>}
                        <td style={{ padding: "12px", textAlign: "center", color: "#C0C0C0" }}>{cantVal}</td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#C0C0C0" }}>${unitPrice.toFixed(2)}</td>
                        <td style={{ padding: "12px", textAlign: "center", fontWeight: "600", color: "#DAA520" }}>${itemTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "16px", padding: "20px", marginBottom: "25px" }}>
              <h2 style={{ fontSize: "1.6rem", margin: "0 0 10px 0", color: "#DAA520", fontWeight: "700" }}>Total a Pagar: ${granTotal.toFixed(2)}</h2>
              <p style={{ color: "#C0C0C0", fontSize: "0.9rem", margin: 0, lineHeight: "1.5" }}>
                Monto mínimo requerido (50%): <strong style={{ color: "#DAA520" }}>${montoMinimo.toFixed(2)} USD</strong> (Puede pagar desde el 50% hasta el 100% o más de contado)
              </p>
            </div>
            
            <div style={{ margin: "25px 0", textAlign: "left", backgroundColor: "#0a0a0a", padding: "20px", borderRadius: "16px", border: "1px solid rgba(218, 165, 32, 0.3)" }}>
              <label style={{ display: "block", marginBottom: "10px", color: "#DAA520", fontWeight: "600", fontSize: "0.95rem" }}>
                Monto que desea pagar (USD) [Mínimo 50% - Sin límite máximo]:
              </label>
              <input
                type="number"
                step="0.01"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                style={{ width: "100%", padding: "14px 16px", backgroundColor: "#000000", border: "1px solid rgba(218, 165, 32, 0.4)", color: "#DAA520", borderRadius: "12px", fontSize: "1rem", boxSizing: "border-box" }}
              />
              {errorMonto && <p style={{ color: "#ff4d4d", fontSize: "0.85rem", marginTop: "10px", marginBottom: 0 }}>{errorMonto}</p>}
            </div>

            {!showPaymentOptions ? (
              <div style={{ marginTop: "30px", padding: "25px", backgroundColor: "#0a0a0a", borderRadius: "16px", border: "1px dashed rgba(218, 165, 32, 0.4)" }}>
                <p style={{ fontSize: "1.05rem", color: "#FFFFFF", marginBottom: "20px", fontWeight: "600" }}>
                  ¿Quiere continuar con el pago?
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
                  <button className="btn-gold" style={{ maxWidth: "220px" }} onClick={() => setShowPaymentOptions(true)}>
                    Sí, continuar
                  </button>
                  <button className="btn-outline-gold" onClick={() => router.back()}>
                    No, regresar
                  </button>
                </div>
              </div>
            ) : selectedMethod === 'transfer' ? (
              <div style={{ marginTop: "30px", padding: "30px", backgroundColor: "#0a0a0a", borderRadius: "16px", border: "1px solid rgba(218, 165, 32, 0.4)", textAlign: "left" }}>
                <h3 style={{ color: "#DAA520", marginBottom: "20px", textAlign: "center", fontSize: "1.2rem", fontWeight: "600" }}>Detalles de Transferencia Bancaria o ACH</h3>
                
                <div style={{ fontSize: "0.9rem", lineHeight: "1.8", color: "#C0C0C0", marginBottom: "25px", background: "#050505", padding: "20px", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
                  <p style={{ margin: "4px 0" }}><strong style={{ color: "#DAA520" }}>Titular de la cuenta:</strong> Trulink Fiber, LLC</p>
                  <p style={{ margin: "4px 0" }}><strong style={{ color: "#DAA520" }}>Tipo de cuenta:</strong> Checking</p>
                  <p style={{ margin: "4px 0" }}><strong style={{ color: "#DAA520" }}>Número de ruta (para wire y ACH):</strong> 026073150</p>
                  <p style={{ margin: "4px 0" }}><strong style={{ color: "#DAA520" }}>Número de cuenta:</strong> 822000835611</p>
                  <p style={{ margin: "4px 0" }}><strong style={{ color: "#DAA520" }}>SWIFT/BIC (Internacional):</strong> CMFGUS33</p>
                  <p style={{ margin: "4px 0" }}><strong style={{ color: "#DAA520" }}>Banco:</strong> Community Federal Savings Bank, 89-16 Jamaica Ave, Woodhaven, NY, 11421, United States</p>
                </div>

                <div style={{ backgroundColor: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "12px", marginBottom: "25px", textAlign: "center" }}>
                  <p style={{ color: "#DAA520", fontWeight: "600", margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                    FAVOR SUBIR/ADJUNTAR EL COMPROBANTE DE LA TRANSFERENCIA.
                  </p>
                  <p style={{ color: "#C0C0C0", fontSize: "0.85rem", margin: 0 }}>
                    Su pedido será procesado a la confirmación del pago recibido.
                  </p>
                </div>

                {transferStatus === 'success' ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#4bb543' }}>
                    <h4 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>¡Comprobante Registrado con Éxito!</h4>
                    <p style={{ color: '#FFFFFF', fontSize: '0.95rem', margin: '0 0 8px 0' }}>{uploadMessage}</p>
                    <p style={{ color: '#C0C0C0', fontSize: '0.85rem', margin: '0 0 20px 0' }}>Notificación enviada a fred.jurado@trulinkfiber.com</p>
                    <button
                      onClick={() => router.push('/')}
                      className="btn-gold"
                      style={{ width: 'auto', display: 'inline-block', padding: '12px 25px' }}
                    >
                      Volver al Inicio del Portal
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleTransferSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '10px', color: '#DAA520', fontWeight: '600', fontSize: '0.9rem' }}>
                        Seleccione archivo de comprobante (PDF o Imagen):
                      </label>
                      <div style={{ backgroundColor: '#000000', border: '1px solid rgba(218, 165, 32, 0.4)', borderRadius: '12px', padding: '12px' }}>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                          style={{ width: '100%', color: '#DAA520', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          required
                        />
                      </div>
                    </div>

                    {transferStatus === 'uploading' && (
                      <p style={{ color: '#DAA520', textAlign: 'center', fontStyle: 'italic', marginBottom: '20px', fontSize: '0.9rem' }}>{uploadMessage}</p>
                    )}

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedMethod(null)}
                        style={{ backgroundColor: 'transparent', color: '#C0C0C0', border: '1px solid rgba(218, 165, 32, 0.3)', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.3s' }}
                      >
                        ← Volver
                      </button>
                      <button
                        type="submit"
                        disabled={transferStatus === 'uploading'}
                        className="btn-gold"
                        style={{ width: 'auto', flex: 1, padding: '12px 20px' }}
                      >
                        {transferStatus === 'uploading' ? 'Subiendo...' : 'Enviar Comprobante'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center", backgroundColor: "#0a0a0a", padding: "30px", borderRadius: "16px", border: "1px solid rgba(218, 165, 32, 0.3)" }}>
                <p style={{ color: "#FFFFFF", fontSize: "1.05rem", marginBottom: "10px", fontWeight: "600" }}>Seleccione su método de pago:</p>
                <button className="btn-gold" onClick={handleStripeCheckout}>Pagar con Stripe</button>
                <button className="btn-gold" onClick={handlePayPalCheckout}>Pagar con PayPal | Pay Later</button>
                <button className="btn-gold" onClick={() => setSelectedMethod('transfer')}>Transferencias (Locales e Internacionales)</button>
                
                <button onClick={() => setShowPaymentOptions(false)} style={{ marginTop: "15px", background: "none", border: "none", color: "#DAA520", textDecoration: "underline", cursor: "pointer", fontSize: "0.9rem", fontWeight: "500" }}>
                  ⬅ Volver a la pregunta anterior
                </button>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "#DAA520", fontSize: "1.1rem", padding: "40px 0" }}>Pedido no encontrado.</p>
        )}
      </div>

      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: "rgba(218, 165, 32, 0.7)", textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}