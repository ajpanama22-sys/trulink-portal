import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<any>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargandoPdf, setCargandoPdf] = useState(false);

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

  const abrirDetalle = async (item: any) => {
    if (!supabase) return;
    setCotizacionSeleccionada(item);
    setModalAbierto(true);
    setCargandoPdf(false);

    // Si la cotización tiene un archivo registrado pero no una URL pública directa, 
    // intentamos obtenerla desde el bucket "documentos" de Supabase Storage.
    if (item.pdf_url && !item.pdf_url.startsWith("http")) {
      setCargandoPdf(true);
      try {
        const { data } = supabase.storage
          .from("documentos")
          .getPublicUrl(item.pdf_url);

        if (data?.publicUrl) {
          setCotizacionSeleccionada((prev: any) => ({
            ...prev,
            pdf_url_final: data.publicUrl
          }));
        }
      } catch (err) {
        console.error("Error al obtener URL del bucket documentos:", err);
      } finally {
        setCargandoPdf(false);
      }
    } else if (item.pdf_url) {
      setCotizacionSeleccionada((prev: any) => ({
        ...prev,
        pdf_url_final: item.pdf_url
      }));
    } else if (item.referencia) {
      // Intento opcional por si el PDF se guarda usando la referencia exacta en el bucket
      setCargandoPdf(true);
      try {
        const possiblePaths = [`${item.referencia}.pdf`, `${item.referencia.toLowerCase()}.pdf`];
        for (const path of possiblePaths) {
          const { data } = supabase.storage
            .from("documentos")
            .getPublicUrl(path);
          
          if (data?.publicUrl) {
            setCotizacionSeleccionada((prev: any) => ({
              ...prev,
              pdf_url_final: data.publicUrl
            }));
            break;
          }
        }
      } catch (err) {
        console.error("Error buscando archivo por referencia:", err);
      } finally {
        setCargandoPdf(false);
      }
    }
  };

  const cerrarDetalle = () => {
    setCotizacionSeleccionada(null);
    setModalAbierto(false);
    setCargandoPdf(false);
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

      <div style={{ flex: 1, padding: "40px", overflowY: "auto", position: "relative" }}>
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
                          onClick={() => abrirDetalle(item)}
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

        {/* MODAL DE DETALLE DE COTIZACIÓN */}
        {modalAbierto && cotizacionSeleccionada && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "12px", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "1.2rem", color: "#DAA520", letterSpacing: "1px" }}>
                  DETALLE DE COTIZACIÓN: {cotizacionSeleccionada.referencia || `QT-${cotizacionSeleccionada.id}`}
                </h2>
                <button onClick={cerrarDetalle} style={btnCloseStyle}>✕</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px", fontSize: "0.9rem" }}>
                <div>
                  <p style={labelStyle}>Empresa / Razón Social:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.empresa || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Representante / Atención:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.representante || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Correo Electrónico:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.email || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Teléfono:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.telefono || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Tipo de Cotización:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.type || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Fecha de Emisión:</p>
                  <p style={valueStyle}>
                    {cotizacionSeleccionada.created_at ? new Date(cotizacionSeleccionada.created_at).toLocaleString() : "N/D"}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Tipo de Carrete / Hilos:</p>
                  <p style={valueStyle}>
                    Carrete: {cotizacionSeleccionada.tipo_carrete || "N/D"} | Hilos: {cotizacionSeleccionada.hilos || "N/D"}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Estado de Pago:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.estado_pago || "pendiente"} (${cotizacionSeleccionada.monto_abonado || 0} abonado)</p>
                </div>
              </div>

              {/* ÍTEMS / PRODUCTOS DE LA COTIZACIÓN */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ ...labelStyle, marginBottom: "8px" }}>Ítems Solicitados:</p>
                <div style={{ backgroundColor: "#000", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "4px", padding: "12px", maxHeight: "150px", overflowY: "auto", fontSize: "0.85rem" }}>
                  {cotizacionSeleccionada.items ? (
                    typeof cotizacionSeleccionada.items === 'object' ? (
                      <pre style={{ margin: 0, color: "#fff", fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(cotizacionSeleccionada.items, null, 2)}
                      </pre>
                    ) : (
                      <p style={{ color: "#fff", margin: 0 }}>{cotizacionSeleccionada.items}</p>
                    )
                  ) : (
                    <p style={{ color: "#666", fontStyle: "italic", margin: 0 }}>No hay ítems detallados guardados en formato JSON.</p>
                  )}
                </div>
              </div>

              {/* ACCIONES Y DOCUMENTO PDF DESDE EL BUCKET "documentos" */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(218, 165, 32, 0.3)", paddingTop: "15px" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", color: "#888" }}>Total General: </span>
                  <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>
                    ${Number(cotizacionSeleccionada.total || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {cargandoPdf ? (
                    <span style={{ fontSize: "0.8rem", color: "#DAA520", fontStyle: "italic" }}>Buscando documento en storage...</span>
                  ) : cotizacionSeleccionada.pdf_url_final ? (
                    <a
                      href={cotizacionSeleccionada.pdf_url_final}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={btnPdfStyle}
                    >
                      VER DOCUMENTO QT (PDF)
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "#666" }}>Archivo no encontrado en bucket "documentos"</span>
                  )}
                  <button onClick={cerrarDetalle} style={btnCerrarModalStyle}>
                    CERRAR
                  </button>
                </div>
              </div>
            </div>
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

const modalOverlayStyle = {
  position: "fixed" as const,
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0, 0, 0, 0.8)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000
};

const modalContentStyle = {
  backgroundColor: "#080808",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "8px",
  padding: "30px",
  width: "90%",
  maxWidth: "700px",
  maxHeight: "90vh",
  overflowY: "auto" as const,
  boxShadow: "0 10px 30px rgba(0,0,0,0.9)"
};

const btnCloseStyle = {
  background: "transparent",
  border: "none",
  color: "#DAA520",
  fontSize: "1.2rem",
  cursor: "pointer",
  fontWeight: "bold"
};

const labelStyle = {
  fontSize: "0.75rem",
  color: "#888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  marginBottom: "3px"
};

const valueStyle = {
  fontSize: "0.95rem",
  color: "#fff",
  margin: 0,
  fontWeight: "500"
};

const btnPdfStyle = {
  padding: "8px 16px",
  backgroundColor: "#DAA520",
  color: "#000",
  borderRadius: "4px",
  fontWeight: "700",
  fontSize: "0.8rem",
  textDecoration: "none",
  letterSpacing: "0.5px",
  display: "inline-block",
  textAlign: "center" as const
};

const btnCerrarModalStyle = {
  padding: "8px 16px",
  backgroundColor: "transparent",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "4px",
  fontWeight: "600",
  fontSize: "0.8rem",
  cursor: "pointer",
  letterSpacing: "0.5px"
};