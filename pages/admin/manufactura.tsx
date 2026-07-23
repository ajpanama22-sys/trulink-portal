import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminManufactura() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando,setCargando] = useState(false);

  useEffect(() => {
    cargarManufactura();
  }, []);

  const cargarManufactura = async () => {
    if (!supabase) return;
    setCargando(true);
    // Asumiendo una tabla de control de producción/manufactura o usando quotes aprobadas
    const { data, error } = await supabase
      .from("manufactura") // O la tabla que utilices para producción
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar órdenes de manufactura:", error);
      // Fallback si la tabla se llama diferente o usa quotes con status de producción
      setOrdenes([]);
    } else {
      setOrdenes(data || []);
    }
    setCargando(false);
  };

  const ordenesFiltradas = ordenes.filter((item) =>
    item.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.lote?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.id?.toString().includes(busqueda)
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="manufactura" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          CONTROL DE MANUFACTURA Y DESPACHO
        </h1>

        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder="Buscar por lote, cliente o ID..."
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

        {cargando ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>Cargando órdenes de manufactura...</p>
        ) : ordenesFiltradas.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No hay órdenes de manufactura activas en este momento.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {ordenesFiltradas.map((item: any) => (
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
                  <div style={{ fontSize: "0.85rem", color: "#888" }}>LOTE: {item.lote || "N/A"} | ID: #{item.id}</div>
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>CLIENTE: <span style={{ color: "#DAA520" }}>{item.razon_social || "N/A"}</span></div>
                  <div style={{ fontSize: "0.95rem" }}>ESTADO: <span style={{ color: "#f39c12", fontWeight: "bold" }}>{item.status || "En Proceso"}</span></div>
                </div>

                <div>
                  <button
                    onClick={() => alert(`Gestionar orden de manufactura #${item.id}`)}
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
                    VER ESTADO
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