import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Checkout() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        .container-pulse { 
          animation: pulse-border 2s infinite; 
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px #DAA520; }
          50% { box-shadow: 0 0 30px #DAA520; }
          100% { box-shadow: 0 0 10px #DAA520; }
        }
      `}</style>

      <div className="container-pulse" style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#050505", border: "2px solid #DAA520", padding: "40px", borderRadius: "20px", textAlign: "center" }}>
        <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "120px", marginBottom: "20px" }} />
        <h1 style={{ color: "#DAA520" }}>Checkout</h1>
        
        {loading ? (
          <p style={{ color: "#FFF" }}>Cargando detalles del pedido...</p>
        ) : order ? (
          <div>
            <p style={{ fontSize: "1.2rem", color: "#FFF" }}>Referencia de pedido: <strong>{order.id}</strong></p>
            <h2 style={{ fontSize: "2rem", margin: "20px 0" }}>Total a Pagar: ${(order.total_amount ?? order.total ?? 0).toFixed(2)}</h2>
            
            <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
              <button className="btn-gold" onClick={() => alert("Redirigiendo a Stripe...")}>Pagar con Stripe</button>
              <button className="btn-gold" onClick={() => alert("Redirigiendo a PayPal...")}>Pagar con PayPal</button>
              <button className="btn-gold" onClick={() => alert("Instrucciones de Transferencia (Locales e Internacionales) enviadas al correo")}>Transferencias (Locales e Internacionales)</button>
            </div>
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
