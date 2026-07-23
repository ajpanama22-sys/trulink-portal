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
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
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
                  borderRadius: "6px",
                  border: "1px solid #DAA520",
                  backgroundColor: isActive ? "#DAA520" : "transparent",
                  color: isActive ? "#000" : "#DAA520",
                  fontWeight: "bold",
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
              backgroundColor: "#111",
              border: "1px solid #DAA520",
              borderRadius: "5px",
              color: "#DAA520",
              outline: "none"
            }}
          />
        </div>

        {/* Listado de Productos */}
        {cargando ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>Cargando registros de {tablaActiva}...</p>
        ) : itemsFiltrados.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No se encontraron elementos en {tablaActiva}.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {itemsFiltrados.map((item: any) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "15px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#888" }}>SKU: {item.sku || "N/A"} | ID: {item.id}</div>
                  <div style={{ fontWeight: "bold", fontSize: "1.05rem", color: "#fff" }}>{item.nombre || item.title || "Sin Nombre"}</div>
                  <div style={{ fontSize: "0.9rem", color: "#aaa" }}>{item.descripcion || item.description || "Sin descripción"}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#2ecc71" }}>
                    ${item.precio || item.price || "0.00"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>Stock: {item.stock ?? "N/A"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}