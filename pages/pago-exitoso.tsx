import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function PagoExitoso() {
  const router = useRouter();
  const { session_id, order_id, method } = router.query;
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  useEffect(() => {
    if (order_id) {
      const updateOrderStatus = async () => {
        try {
          const newStatus = method === 'transferencia' || method === 'ach' ? 'en_verificacion' : 'pagado';
          
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
  }, [order_id, method]);

  const isTransferencia = method === 'transferencia' || method === 'ach';

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif", display: "flex", justifyContent: "center", alignItems: "center" }}>
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

      <div className="container-pulse" style={{ maxWidth: "650px", width: "100%", backgroundColor: "#050505", border: "2px solid #DAA520", padding: "50px 40px", borderRadius: "20px", textAlign: "center" }}>
        <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "25px", filter: "drop-shadow(0 0 8px rgba(218,165,32,0.3))" }} />
        
        {loading ? (
          <p style={{ color: "#FFF", fontSize: "1.1rem" }}>Procesando y validando información...</p>
        ) : isTransferencia ? (
          <div>
            <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "20px", letterSpacing: "1px" }}>¡Instrucciones de Pago Registradas!</h1>
            <div style={{ width: "60px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto 25px auto" }}></div>
            <p style={{ color: "#FFF", fontSize: "1.1rem", lineHeight: "1.7", marginBottom: "25px" }}>
              Hemos registrado su selección de pago mediante transferencia bancaria o ACH {order_id ? <strong style={{ color: "#DAA520" }}>para la cotización #{order_id}</strong> : ""}. 
            </p>
            <p style={{ color: "#ccc", fontSize: "1rem", lineHeight: "1.6", marginBottom: "35px" }}>
              Recibirá un correo electrónico de confirmación tan pronto nuestro departamento financiero verifique la entrada del monto correspondiente en nuestra cuenta.
            </p>
          </div>
        ) : (
          <div>
            <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "20px", letterSpacing: "1px" }}>¡Transacción Exitosa!</h1>
            <div style={{ width: "60px", height: "2px", backgroundColor: "#DAA520", margin: "0 auto 25px auto" }}></div>
            <p style={{ color: "#FFF", fontSize: "1.1rem", lineHeight: "1.7", marginBottom: "20px" }}>
              Su pago en línea ha sido procesado de forma segura y exitosa.
            </p>
            {order_id && (
              <div style={{ backgroundColor: "#111", border: "1px dashed #DAA520", padding: "12px", borderRadius: "8px", marginBottom: "25px", display: "inline-block" }}>
                <span style={{ color: "#ccc", fontSize: "0.95rem" }}>Referencia de orden: </span>
                <strong style={{ color: "#DAA520", fontSize: "1rem" }}>#{order_id}</strong>
              </div>
            )}
            <p style={{ color: "#ccc", fontSize: "1rem", lineHeight: "1.6", marginBottom: "35px" }}>
              Agradecemos su confianza. En breve comenzaremos con los procesos operativos y de suministro asociados a su requerimiento.
            </p>
          </div>
        )}

        <div>
          <button className="btn-gold" onClick={() => router.push('/')}>
            Volver al Inicio del Portal
          </button>
        </div>
      </div>
    </div>
  );
}