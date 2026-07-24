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
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar cotizaciones:", error);
    } else {
      setCotizaciones(data || []);
    }
  };

  const cotizacionesFiltradas = cotizaciones.filter((item) =>
    item.referencia?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.empresa?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.representante?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.telefono?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.id?.toString().includes(busqueda)
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="cotizaciones" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "10px", letterSpacing: "1px" }}>
          CONTROL DE COTIZACIONES
        </h1>

        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder="Filtrar por referencia (QT-XXXX), empresa, representante, email, teléfono o ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "500px",
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

        {cotizacionesFiltradas.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No se encontraron cotizaciones registradas.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "6px", backgroundColor: "#050505" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#0a0a0a" }}>
                  <th style={thStyle}>REFERENCIA / FECHA</th>
                  <th style={thStyle}>CLIENTE / RAZÓN SOCIAL</th>
                  <th style={thStyle}>CONTACTO (EMAIL / TEL)</th>
                  <th style={thStyle}>TIPO</th>
                  <th style={thStyle}>TOTAL</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {cotizacionesFiltradas.map((item: any) => {
                  const fechaFormateada = item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/D";
                  const totalVal = Number(item.total || 0).toFixed(2);
                  const referenciaStr = item.referencia || `QT-${item.id}`;
                  const empresaStr = item.empresa || item.representante || "Sin especificar";
                  const emailStr = item.email || "N/D";
                  const telefonoStr = item.telefono || "N/D";
                  const tipoStr = item.type || "N/D";

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #141414", transition: "background 0.2s" }}>
                      <td style={{ ...tdStyle, color: "#888", fontSize: "0.85rem" }}>
                        <span style={{ color: "#DAA520", fontWeight: "600" }}>{referenciaStr}</span>
                        <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>{fechaFormateada}</div>
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontWeight: "500" }}>
                        {empresaStr}
                        {item.representante && item.empresa && (
                          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>Atn: {item.representante}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                        <div style={{ color: "#DAA520" }}>{emailStr}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{telefonoStr}</div>
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontSize: "0.85rem" }}>
                        <span style={{ 
                          padding: "3px 8px", 
                          borderRadius: "3px", 
                          fontSize: "0.75rem", 
                          border: "1px solid rgba(218, 165, 32, 0.3)",
                          backgroundColor: "#0c0c0c",
                          color: "#DAA520"
                        }}>
                          {tipoStr}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontWeight: "600" }}>
                        ${totalVal}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button
                          onClick={() => alert(`Detalles de la cotización ${referenciaStr}`)}
                          style={btnDetalle}
                        >
                          VER DETALLE
                        </button>
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

const btnDetalle = {
  padding: "6px 14px",
  cursor: "pointer",
  borderRadius: "4px",
  fontWeight: "600",
  fontSize: "0.75rem",
  letterSpacing: "0.8px",
  background: "transparent",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  textAlign: "center" as const,
  transition: "all 0.2s ease"
};