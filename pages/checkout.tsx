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
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null); // null | 'stripe' | 'paypal' | 'transfer'
  
  // Estados para la transferencia bancaria y subida de comprobante
  const [transferStatus, setTransferStatus] = useState<string>('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');

  useEffect(() => {
    if (id) {
      const fetchOrder = async () => {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error("Error al recuperar orden:", error);
        } else {
          setOrder(data);
        }
        setLoading(false);
      };
      fetchOrder();
    }
  }, [id]);

  const rawTotal = order?.total ?? order?.total_amount ?? 0;
  const granTotal = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0;
  const esProducto = order?.type === 'producto';

  const handleStripeCheckout = async () => {
    try {
      const response = await fetch('/api/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, amount: granTotal }),
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
    try {
      const response = await fetch('/api/create-paypal-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, amount: granTotal }),
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

      // 1. Subir archivo al Bucket 'transferencias' en Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transferencias')
        .upload(filePath, fileToUpload);

      if (uploadError) {
        throw new Error('Error al subir el archivo al bucket: ' + uploadError.message);
      }

      // Obtener URL pública o ruta del archivo guardado
      const { data: publicURLData } = supabase.storage
        .from('transferencias')
        .getPublicUrl(filePath);

      const comprobanteUrl = publicURLData.publicUrl || filePath;

      // 2. Actualizar la tabla quotes con el estado y la URL del comprobante
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'Pendiente de Verificación Bancaria',
          comprobante_url: comprobanteUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error('Advertencia al actualizar la tabla quotes:', updateError);
      }

      // 3. Enviar correo electrónico directamente a fred.jurado@trulinkfiber.com
      const emailResponse = await fetch('/api/send-transfer-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: 'fred.jurado@trulinkfiber.com',
          quoteId: id,
          clientName: clientId,
          total: granTotal,
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
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        .btn-gold { 
          background-color: #DAA520; 
          color: #000; 
          padding: 15px 30px; 
          border-radius: 10px; 
          border: none; 
          cursor: pointer; 
          font-weight: bold; 
          transition: transform 0.3s, box-shadow 0.3s;
          width: 100%;
          max-width: 350px;
        }
        .btn-gold:hover { 
          transform: scale(1.05); 
          box-shadow: 0 0 15px #DAA520; 
        }
        .btn-outline-gold {
          background-color: transparent;
          color: #DAA520;
          border: 2px solid #DAA520;
          padding: 12px 30px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: bold;
          transition: transform 0.3s, box-shadow 0.3s;
          width: 100%;
          max-width: 200px;
        }
        .btn-outline-gold:hover {
          background-color: #DAA520;
          color: #000;
          transform: scale(1.05);
          box-shadow: 0 0 15px #DAA520;
        }
        .container-pulse { 
          animation: pulse-border 2s infinite; 
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px #DAA520; }
          50% { box-shadow: 0 0 30px #DAA520; }
          100% { box-shadow: 0 0 10px #DAA520; }
        }
      `}</style>

      <div className="container-pulse" style={{ maxWidth: "850px", margin: "0 auto", backgroundColor: "#050505", border: "2px solid #DAA520", padding: "40px", borderRadius: "20px", textAlign: "center" }}>
        <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "120px", marginBottom: "20px" }} />
        <h1 style={{ color: "#DAA520", marginBottom: "10px" }}>Resumen de Checkout</h1>
        
        {loading ? (
          <p style={{ color: "#FFF" }}>Cargando detalles del pedido...</p>
        ) : order ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "0.9rem", color: "#ccc" }}>
              <span><strong>Referencia:</strong> {order.referencia || order.id}</span>
              <span><strong>Fecha:</strong> {order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</span>
            </div>

            {/* Tabla de desglose de la cotización generada */}
            <div style={{ overflowX: "auto", marginBottom: "20px" }}>
              <table style={{ margin: "0 auto", borderCollapse: "collapse", color: "#DAA520", width: "100%", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#111" }}>
                    {esProducto && <th style={{ border: "1px solid #DAA520", padding: "10px" }}>SKU</th>}
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Descripción / Tipo</th>
                    {!esProducto && <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Hilos</th>}
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Cant</th>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>{esProducto ? "P. Unitario" : "P. Unitario / Carrete"}</th>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Total</th>
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
                      <tr key={index} style={{ backgroundColor: "#0c0c0c" }}>
                        {esProducto && <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{skuVal}</td>}
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{desc}</td>
                        {!esProducto && <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{hilosVal}</td>}
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{cantVal}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>${unitPrice.toFixed(2)}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>${itemTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h2 style={{ fontSize: "1.8rem", margin: "20px 0", color: "#DAA520" }}>Total a Pagar: ${granTotal.toFixed(2)}</h2>
            
            {!showPaymentOptions ? (
              <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "#111", borderRadius: "15px", border: "1px dashed #DAA520" }}>
                <p style={{ fontSize: "1.1rem", color: "#FFF", marginBottom: "20px", fontWeight: "bold" }}>
                  ¿Quiere continuar con el pago?
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
                  <button className="btn-gold" style={{ maxWidth: "200px" }} onClick={() => setShowPaymentOptions(true)}>
                    Sí, continuar
                  </button>
                  <button className="btn-outline-gold" onClick={() => router.back()}>
                    No, regresar
                  </button>
                </div>
              </div>
            ) : selectedMethod === 'transfer' ? (
              <div style={{ marginTop: "30px", padding: "25px", backgroundColor: "#111", borderRadius: "15px", border: "1px solid #DAA520", textAlign: "left" }}>
                <h3 style={{ color: "#DAA520", marginBottom: "15px", textAlign: "center" }}>Detalles de Transferencia Bancaria o ACH</h3>
                
                <div style={{ fontSize: "0.9rem", lineHeight: "1.6", color: "#ddd", marginBottom: "20px", background: "#1a1a1a", padding: "15px", borderRadius: "10px", border: "1px solid #333" }}>
                  <p><strong>Titular de la cuenta:</strong> Trulink Fiber, LLC</p>
                  <p><strong>Tipo de cuenta:</strong> Checking</p>
                  <p><strong>Número de ruta (para wire y ACH):</strong> 026073150</p>
                  <p><strong>Número de cuenta:</strong> 822000835611</p>
                  <p><strong>SWIFT/BIC (Internacional):</strong> CMFGUS33</p>
                  <p><strong>Banco:</strong> Community Federal Savings Bank, 89-16 Jamaica Ave, Woodhaven, NY, 11421, United States</p>
                </div>

                <div style={{ backgroundColor: "rgba(218, 165, 3, 0.1)", border: "1px solid #DAA520", padding: "15px", borderRadius: "10px", marginBottom: "20px", textAlign: "center" }}>
                  <p style={{ color: "#DAA520", fontWeight: "bold", margin: "0 0 8px 0" }}>
                    FAVOR SUBIR/ADJUNTAR EL COMPROBANTE DE LA TRANSFERENCIA.
                  </p>
                  <p style={{ color: "#ccc", fontSize: "0.85rem", margin: 0 }}>
                    Su pedido será procesado a la confirmación del pago recibido.
                  </p>
                </div>

                {transferStatus === 'success' ? (
                  <div style={{ textAlign: 'center', padding: '15px', color: '#4bb543' }}>
                    <h4>¡Comprobante Registrado con Éxito!</h4>
                    <p style={{ color: '#fff', fontSize: '0.9rem' }}>{uploadMessage}</p>
                    <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '5px' }}>Notificación enviada a fred.jurado@trulinkfiber.com</p>
                    <button
                      onClick={() => router.push('/')}
                      style={{ marginTop: '15px', backgroundColor: '#DAA520', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Volver al Inicio del Portal
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleTransferSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#DAA520', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        Seleccione archivo de comprobante (PDF o Imagen):
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#000', border: '1px solid #DAA520', color: '#fff', borderRadius: '8px' }}
                        required
                      />
                    </div>

                    {transferStatus === 'uploading' && (
                      <p style={{ color: '#DAA520', textAlign: 'center', fontStyle: 'italic', marginBottom: '15px' }}>{uploadMessage}</p>
                    )}

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedMethod(null)}
                        style={{ backgroundColor: 'transparent', color: '#aaa', border: '1px solid #555', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
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
              <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
                <p style={{ color: "#FFF", fontSize: "1rem", marginBottom: "10px" }}>Seleccione su método de pago:</p>
                <button className="btn-gold" onClick={handleStripeCheckout}>Pagar con Stripe</button>
                <button className="btn-gold" onClick={handlePayPalCheckout}>Pagar con PayPal</button>
                <button className="btn-gold" onClick={() => setSelectedMethod('transfer')}>Transferencias (Locales e Internacionales)</button>
                
                <button onClick={() => setShowPaymentOptions(false)} style={{ marginTop: "15px", background: "none", border: "none", color: "#DAA520", textDecoration: "underline", cursor: "pointer" }}>
                  ⬅ Volver a la pregunta anterior
                </button>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "#DAA520" }}>Pedido no encontrado.</p>
        )}
      </div>
    </div>
  );
}