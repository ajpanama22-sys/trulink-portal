import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminInventario() {
  const [tablaActiva, setTablaActiva] = useState<"cablesdb" | "herrajesdb" | "accesoriosdb">("cablesdb");
  const [items, setItems] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarInventario(tablaActiva);
  }, [tablaActiva]);

  const cargarInventario = async (tabla: string) => {
    if (!supabase) return;
    setCargando(true);
    setItems([]);

    const { data, error } = await supabase
      .from(tabla)
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error(`Error al cargar ${tabla}:`, error);
    } else {
      setItems(data || []);
    }
    setCargando(false);
  };

  const itemsFiltrados = items.filter((item) =>
    item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.sku?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="inventario" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "10px", letterSpacing: "1px" }}>
          CONTROL DE INVENTARIO Y PRODUCTOS
        </h1>

        {/* Selector de Bases de Datos */}
        <div style={{ display: "flex", gap: "15px", marginBottom: "25px" }}>
          {(["cablesdb", "herrajesdb", "accesoriosdb"] as const).map((tabla) => {
            const isActive = tablaActiva === tabla;
            return (
              <button
                key={tabla}
                onClick={() => setTablaActiva(tabla)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "4px",
                  border: "1px solid rgba(218, 165, 32, 0.4)",
                  backgroundColor: isActive ? "#DAA520" : "transparent",
                  color: isActive ? "#000" : "#DAA520",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  letterSpacing: "0.8px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.2s ease"
                }}
              >
                {tabla.replace("db", "")}
              </button>
            );
          })}
        </div>

        {/* Buscador */}
        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder={`Buscar en ${tablaActiva} por SKU, nombre o descripción...`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "12px",
              backgroundColor: "#0a0a0a",
              border: "1px solid rgba(218, 165, 32, 0.4)",
              borderRadius: "4px",
              color: "#DAA520",
              outline: "none",
              letterSpacing: "0.5px"
            }}
          />
        </div>

        {/* Listado de Productos en Tabla HTML Elegante */}
        {cargando ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>Cargando registros de {tablaActiva}...</p>
        ) : itemsFiltrados.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No se encontraron elementos en {tablaActiva}.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "6px", backgroundColor: "#050505" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#0a0a0a" }}>
                  <th style={thStyle}>SKU / ID</th>
                  <th style={thStyle}>NOMBRE</th>
                  <th style={thStyle}>DESCRIPCIÓN</th>
                  <th style={thStyle}>PRECIO</th>
                  <th style={thStyle}>STOCK</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map((item: any) => {
                  const precioVal = Number(item.precio || item.price || 0).toFixed(2);
                  const stockVal = item.stock ?? "N/A";

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #141414", transition: "background 0.2s" }}>
                      <td style={{ ...tdStyle, color: "#888", fontSize: "0.85rem" }}>
                        <span style={{ color: "#DAA520", fontWeight: "600" }}>{item.sku || "N/A"}</span>
                        <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>ID: #{item.id}</div>
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontWeight: "500" }}>
                        {item.nombre || item.title || "Sin Nombre"}
                      </td>
                      <td style={{ ...tdStyle, color: "#aaa", fontSize: "0.85rem", maxWidth: "300px" }}>
                        {item.descripcion || item.description || "Sin descripción"}
                      </td>
                      <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "600" }}>
                        ${precioVal}
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontSize: "0.85rem" }}>
                        {stockVal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: "14px 16px",
  fontWeight: "600",
  letterSpacing: "0.8px",
  fontSize: "0.75rem",
  textTransform: "uppercase" as const
};

const tdStyle = {
  padding: "14px 16px",
  letterSpacing: "0.4px"
};