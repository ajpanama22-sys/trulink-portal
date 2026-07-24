import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function SeguimientoPedidos() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarSeguimientoPedidos();
  }, []);

  const cargarSeguimientoPedidos = async () => {
    if (!supabase) return;
    setLoading(true);

    const idUsuario = sessionStorage.getItem("trulink_usuario_id");
    const userEmail = sessionStorage.getItem("trulink_usuario_email");

    // Consultamos la tabla quotes (o la tabla unificada de pedidos) filtrando por el cliente actual
    let query = supabase.from("quotes").select("*");

    if (idUsuario) {
      query = query.eq("client_id", idUsuario);
    } else if (userEmail) {
      query = query.eq("email", userEmail);
    }

    const { data, error } = await query;

    if (error) {
      setMensaje("Error al cargar el seguimiento: " + error.message);
    } else if (data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      en_cola: { label: 'En Cola', color: '#f39c12' },
      en_produccion: { label: 'En Producción', color: '#3498db' },
      control_calidad: { label: 'Control de Calidad', color: '#9b59b6' },
      listo_despacho: { label: 'Listo para Despacho', color: '#2ecc71' },
    };

    const current = statusMap[status] || { label: status || 'En Cola', color: '#DAA520' };

    return (
      <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '20px', background: `${current.color}20`, border: `1px solid ${current.color}`, color: current.color, fontWeight: 'bold', fontSize: '0.85rem' }}>
        ● {current.label}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", color: "#fff", padding: "40px", fontFamily: "sans-serif", position: "relative" }}>
      {/* Botón Volver al Portal */}
      <button
        onClick={() => router.push("/portal-cliente")}
        style={{
          backgroundColor: "transparent",
          color: "#DAA520",
          border: "1px solid #DAA520",
          padding: "8px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
          marginBottom: "30px",
          transition: "all 0.3s ease"
        }}
      >
        ← Volver al Portal
      </button>

      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ color: "#DAA520", marginBottom: "10px", textAlign: "center" }}>Control de Pedidos</h1>
        <p style={{ color: "#aaa", textAlign: "center", marginBottom: "40px", fontSize: "0.95rem" }}>
          Seguimiento en tiempo real de sus solicitudes (Especiales, Fabricación y Bodega)
        </p>

        {loading ? (
          <p style={{ textAlign: "center", color: "#DAA520" }}>Cargando seguimiento...</p>
        ) : mensaje ? (
          <p style={{ textAlign: "center", color: "red" }}>{mensaje}</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", border: "1px dashed #333", borderRadius: "12px" }}>
            <p style={{ color: "#666", fontSize: "1rem" }}>No se encontraron pedidos activos en este momento.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #DAA520",
                  borderRadius: "15px",
                  padding: "20px",
                  boxShadow: "0 0 15px rgba(218, 165, 32, 0.15)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "15px"
                }}
              >
                <div>
                  <h3 style={{ color: "#DAA520", margin: "0 0 8px 0", fontSize: "1.1rem" }}>
                    Pedido #{order.quote_number || order.id.slice(0, 8)}
                  </h3>
                  <p style={{ color: "#ccc", margin: "0 0 5px 0", fontSize: "0.9rem" }}>
                    {order.descripcion || order.product_name || "Artículos en proceso de gestión"}
                  </p>
                  <span style={{ fontSize: "0.75rem", color: "#666" }}>
                    Fecha: {new Date(order.created_at || Date.now()).toLocaleDateString()}
                  </span>
                  {/* RESTRICCIÓN ESTRICTA: NUNCA SE MUESTRAN PRECIOS, CANTIDADES NI TOTALES */}
                </div>

                <div>
                  {renderStatusBadge(order.status || order.estado)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}