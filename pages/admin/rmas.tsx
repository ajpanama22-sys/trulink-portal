import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminRmasPage() {
  const [rmas, setRmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const fetchRmas = async () => {
    setLoading(true);
    let query = supabase.from("rmas").select("*").order("created_at", { ascending: false });
    
    if (filtroEstado !== "TODOS") {
      query = query.eq("estado", filtroEstado);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error al cargar RMAs:", error.message);
    } else {
      setRmas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRmas();
  }, [filtroEstado]);

  const actualizarEstado = async (id: string, nuevoEstado: string) => {
    const { error } = await supabase
      .from("rmas")
      .update({ estado: nuevoEstado })
      .eq("id", id);

    if (error) {
      alert(`Error al actualizar: ${error.message}`);
    } else {
      fetchRmas();
    }
  };

  return (
    <div style={{ padding: "30px", backgroundColor: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "1px solid #333", paddingBottom: "15px" }}>
        <div>
          <h1 style={{ color: "#DAA520", margin: 0, fontSize: "24px" }}>Trulink Shield — Gestión de RMA y Garantías</h1>
          <p style={{ color: "#888", fontSize: "13px", margin: "5px 0 0 0" }}>Control de devoluciones, revisiones y reemplazos técnicos</p>
        </div>
        
        <div>
          <select 
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ background: "#111", color: "#DAA520", border: "1px solid #DAA520", padding: "8px 12px", borderRadius: "5px" }}
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADO">Aprobado</option>
            <option value="EN REVISIÓN">En Revisión</option>
            <option value="REEMPLAZADO">Reemplazado</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#DAA520", textAlign: "center" }}>Cargando solicitudes...</p>
      ) : rmas.length === 0 ? (
        <p style={{ textAlign: "center", color: "#666", padding: "40px" }}>No se encontraron registros de RMA.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#111", border: "1px solid #222" }}>
            <thead>
              <tr style={{ background: "#000", borderBottom: "2px solid #DAA520", textAlign: "left", fontSize: "12px", color: "#DAA520" }}>
                <th style={{ padding: "12px" }}>Ticket RMA</th>
                <th style={{ padding: "12px" }}>Referencia</th>
                <th style={{ padding: "12px" }}>Cliente</th>
                <th style={{ padding: "12px" }}>Motivo</th>
                <th style={{ padding: "12px" }}>Descripción</th>
                <th style={{ padding: "12px" }}>Estado Actual</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rmas.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #222", background: idx % 2 === 0 ? "#111" : "#161616", fontSize: "13px" }}>
                  <td style={{ padding: "12px", fontWeight: "bold", color: "#DAA520" }}>{item.rma_number}</td>
                  <td style={{ padding: "12px" }}>{item.referencia || "N/A"}</td>
                  <td style={{ padding: "12px" }}>
                    <strong>{item.cliente_nombre}</strong><br />
                    <span style={{ fontSize: "11px", color: "#888" }}>{item.cliente_email}</span>
                  </td>
                  <td style={{ padding: "12px" }}>{item.motivo}</td>
                  <td style={{ padding: "12px", maxWidth: "200px", color: "#ccc" }}>{item.descripcion || "Sin detalles"}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      fontSize: "11px", 
                      fontWeight: "bold",
                      backgroundColor: item.estado === 'APROBADO' ? '#27ae60' : item.estado === 'RECHAZADO' ? '#c0392b' : item.estado === 'REEMPLAZADO' ? '#2980b9' : '#d35400',
                      color: '#fff'
                    }}>
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <select
                      value={item.estado}
                      onChange={(e) => actualizarEstado(item.id, e.target.value)}
                      style={{ background: "#000", color: "#fff", border: "1px solid #444", padding: "6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="APROBADO">APROBADO</option>
                      <option value="EN REVISIÓN">EN REVISIÓN</option>
                      <option value="REEMPLAZADO">REEMPLAZADO</option>
                      <option value="RECHAZADO">RECHAZADO</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}