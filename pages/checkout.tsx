import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type QuoteItem = {
  tipo?: string;
  nombre?: string;
  hilos?: number;
  longitudKm?: number;
  cantidad: number;
  precioMetro?: number;
  precioCarrete?: number;
  precioUnitario?: number;
};

type OrderData = {
  id: string;
  created_at: string;
  total?: number;
  total_amount?: number;
  items: QuoteItem[];
  status: string;
  type?: string;
};

export default function Checkout() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

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

  const granTotal = order ? (order.total ?? order.total_amount ?? 0) : 0;

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
              <span><strong>Referencia:</strong> {order.id}</span>
              <span><strong>Fecha:</strong> {new Date(order.created_at).toLocaleDateString()}</span>
            </div>

            {/* Tabla de desglose de la cotización generada */}
            <div style={{ overflowX: "auto", marginBottom: "20px" }}>
              <table style={{ margin: "0 auto", borderCollapse: "collapse", color: "#DAA520", width: "100%", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#111" }}>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Descripción / Tipo</th>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Hilos</th>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Cant</th>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>P. Unitario / Carrete</th>
                    <th style={{ border: "1px solid #DAA520", padding: "10px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items && order.items.map((item, index) => {
                    const desc = item.tipo || item.nombre || "Artículo";
                    const hilosVal = item.hilos !== undefined ? item.hilos : "-";
                    const unitPrice = item.precioCarrete ?? item.precioUnitario ?? item.precioMetro ?? 0;
                    const itemTotal = unitPrice * item.cantidad;

                    return (
                      <tr key={index} style={{ backgroundColor: "#0c0c0c" }}>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{desc}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{hilosVal}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{item.cantidad}</td>
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
                  <button className="btn-outline-gold" onClick={() => router.push("/fabricacion")}>
                    No, regresar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
                <p style={{ color: "#FFF", fontSize: "1rem", marginBottom: "10px" }}>Seleccione su método de pago:</p>
                <button className="btn-gold" onClick={() => alert("Redirigiendo a Stripe...")}>Pagar con Stripe</button>
                <button className="btn-gold" onClick={() => alert("Redirigiendo a PayPal...")}>Pagar con PayPal</button>
                <button className="btn-gold" onClick={() => alert("Instrucciones de Transferencia (Locales e Internacionales) enviadas al correo")}>Transferencias (Locales e Internacionales)</button>
                
                <button onClick={() => setShowPaymentOptions(false)} style={{ marginTop: "15px", background: "none", border: "none", color: "#DAA520", textDecoration: "underline", cursor: "pointer" }}>
                  ⬅ Volver a la pregunta anterior
                </button>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "#DAA520" }}>Pedido no encontrado.</p>
        )}

        <button onClick={() => router.push("/fabricacion")} style={{ marginTop: "30px", background: "none", border: "1px solid #DAA520", color: "#DAA520", padding: "10px 20px", borderRadius: "5px", cursor: "pointer" }}>
          ⬅ Volver a la línea de producción
        </button>
      </div>
    </div>
  );
}
