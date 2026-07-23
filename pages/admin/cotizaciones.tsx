import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  const cargarCotizaciones = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("quotes") // Mantenemos tu tabla de cotizaciones
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar cotizaciones:", error);
    } else {
      setCotizaciones(data || []);
    }
  };

  const cotizacionesFiltradas = cotizaciones.filter((item) =>
    item.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.id?.toString().includes(busqueda)
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="cotizaciones" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          CONTROL DE COTIZACIONES
        </h1>

        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder="Filtrar por razón social, email o ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "12px",
              backgroundColor: "#111",
              border: "1px solid #DAA520",
              borderRadius: "5px",
              color: "#DAA520",
              outline: "none"
            }}
          />
        </div>

        {cotizacionesFiltradas.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No se encontraron cotizaciones registradas.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {cotizacionesFiltradas.map((item: any) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "0.9rem", color: "#888" }}>ID: #{item.id} | Fecha: {new Date(item.created_at).toLocaleDateString()}</div>
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>CLIENTE: <span style={{ color: "#DAA520" }}>{item.razon_social || item.email}</span></div>
                  <div style={{ fontSize: "0.95rem" }}>TOTAL: <span style={{ color: "#2ecc71", fontWeight: "bold" }}>${item.total_amount || item.total || "0.00"}</span></div>
                </div>

                <div>
                  <button
                    onClick={() => alert(`Detalles de la cotización #${item.id}`)}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "transparent",
                      border: "1px solid #DAA520",
                      color: "#DAA520",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    VER DETALLE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}