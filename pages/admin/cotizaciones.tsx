import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export const dynamic = 'force-dynamic';

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
      console.log("Datos de Supabase (Normalizados):", data);
      setCotizaciones(data || []);
    }
  };

  // Función de seguridad para evitar errores con JSON (usado principalmente para ítems o arrays de productos)
  const parseJSON = (value: any) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return {};
    }
  };

  const resolverDatosCliente = (item: any) => {
    const empresa = item.razon_social || item.empresa || item.nombre_empresa || item.company || "Sin especificar";
    const representante = item.nombre_representante || item.representante || item.contacto || item.nombre_contacto || "N/D";
    const email = item.email || item.correo || "N/D";
    const telefono = item.telefono_celular || item.telefono_oficina || item.telefono || item.celular || "N/D";

    return { empresa, representante, email, telefono };
  };

  const abrirDetalle = async (item: any) => {
    if (!supabase) return;
    
    const { empresa, representante, email, telefono } = resolverDatosCliente(item);
    
    const itemEnriquecido = {
      ...item,
      empresaResuelto: empresa,
      representanteResuelto: representante,
      emailResuelto: email,
      telefonoResuelto: telefono
    };

    setCotizacionSeleccionada(itemEnriquecido);
    setModalAbierto(true);
    setCargandoPdf(false);

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

  const cotizacionesFiltradas = cotizaciones.filter((item) => {
    const { empresa, representante, email, telefono } = resolverDatosCliente(item);
    const referencia = item.referencia || `QT-${item.id}`;
    const tipo = item.type || item.tipo || item.tipo_solicitud || "";

    const termino = busqueda.toLowerCase();
    return (
      referencia.toLowerCase().includes(termino) ||
      empresa.toLowerCase().includes(termino) ||
      representante.toLowerCase().includes(termino) ||
      email.toLowerCase().includes(termino) ||
      telefono.toLowerCase().includes(termino) ||
      tipo.toLowerCase().includes(termino) ||
      item.id?.toString().includes(termino)
    );
  });

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="cotizaciones" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              CONTROL DE COTIZACIONES
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Gestión y supervisión detallada de cotizaciones emitidas, estados y documentos asociados.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            TOTAL REGISTROS: {cotizacionesFiltradas.length}
          </div>
        </div>

        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder="Filtrar por referencia (QT-XXXX), tipo, razón social, representante, email o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "550px",
              padding: "12px 16px",
              backgroundColor: "#111111",
              border: "1px solid rgba(218, 165, 32, 0.4)",
              borderRadius: "8px",
              color: "#DAA520",
              outline: "none",
              letterSpacing: "0.5px",
              fontSize: "0.9rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
            }}
          />
        </div>

        {cotizacionesFiltradas.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "60px", textAlign: "center" }}>
            <p style={{ color: "#777", fontStyle: "italic", fontSize: "1rem", margin: 0, letterSpacing: "0.5px" }}>
              No se encontraron cotizaciones registradas.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "12px", backgroundColor: "#111111", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#161616" }}>
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
                  const tipoStr = item.tipo_solicitud || item.type || item.tipo || "N/D";
                  
                  const { empresa, representante, email, telefono } = resolverDatosCliente(item);

                  return (
                    <tr 
                      key={item.id} 
                      style={{ borderBottom: "1px solid #1a1a1a", transition: "background 0.2s" }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(218, 165, 32, 0.03)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ ...tdStyle, color: "#888", fontSize: "0.85rem" }}>
                        <span style={{ color: "#DAA520", fontWeight: "600" }}>{referenciaStr}</span>
                        <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>{fechaFormateada}</div>
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontWeight: "500" }}>
                        {empresa}
                        {representante !== "N/D" && representante && (
                          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>Atn: {representante}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                        <div style={{ color: "#DAA520" }}>{email}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{telefono}</div>
                      </td>
                      <td style={{ ...tdStyle, color: "#fff", fontSize: "0.85rem" }}>
                        <span style={{ 
                          padding: "3px 8px", 
                          borderRadius: "4px", 
                          fontSize: "0.75rem", 
                          border: "1px solid rgba(218, 165, 32, 0.3)", 
                          backgroundColor: "rgba(218, 165, 32, 0.08)", 
                          color: "#DAA520",
                          fontWeight: "600"
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
                          onMouseOver={(e) => { e.currentTarget.style.background = "rgba(218, 165, 32, 0.15)"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
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
                <h2 style={{ fontSize: "1.2rem", color: "#DAA520", letterSpacing: "1px", margin: 0 }}>
                  DETALLE DE COTIZACIÓN: {cotizacionSeleccionada.referencia || `QT-${cotizacionSeleccionada.id}`}
                </h2>
                <button onClick={cerrarDetalle} style={btnCloseStyle}>✕</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px", fontSize: "0.9rem" }}>
                <div>
                  <p style={labelStyle}>Empresa / Razón Social:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.empresaResuelto}</p>
                </div>
                <div>
                  <p style={labelStyle}>Representante / Atención:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.representanteResuelto} {cotizacionSeleccionada.cargo ? `(${cotizacionSeleccionada.cargo})` : ""}</p>
                </div>
                <div>
                  <p style={labelStyle}>Identificación Fiscal:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.identificacion_fiscal || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Sitio Web / Industria:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.sitio_web || "N/D"} {cotizacionSeleccionada.industria ? `/ ${cotizacionSeleccionada.industria}` : ""}</p>
                </div>
                <div>
                  <p style={labelStyle}>Correo Electrónico:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.emailResuelto}</p>
                </div>
                <div>
                  <p style={labelStyle}>Teléfono:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.telefonoResuelto}</p>
                </div>
                <div>
                  <p style={labelStyle}>País / Dirección:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.pais || "N/D"} - {cotizacionSeleccionada.direccion || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Tipo de Solicitud:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.tipo_solicitud || cotizacionSeleccionada.type || cotizacionSeleccionada.tipo || "N/D"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Fecha de Emisión:</p>
                  <p style={valueStyle}>
                    {cotizacionSeleccionada.created_at ? new Date(cotizacionSeleccionada.created_at).toLocaleString() : "N/D"}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Estado:</p>
                  <p style={valueStyle}>{cotizacionSeleccionada.status || "pendiente"}</p>
                </div>
              </div>

              {/* ÍTEMS / PRODUCTOS */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ ...labelStyle, marginBottom: "8px" }}>Ítems / Contenido de la Cotización:</p>
                <div style={{ backgroundColor: "#0b0b0b", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px", maxHeight: "180px", overflowY: "auto" }}>
                  {(() => {
                    const itemsList = parseJSON(cotizacionSeleccionada.items) || parseJSON(cotizacionSeleccionada.productos) || parseJSON(cotizacionSeleccionada.details);
                    if (Array.isArray(itemsList) && itemsList.length > 0) {
                      return (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#141414" }}>
                              <th style={{ padding: "10px 14px" }}>SKU / Ref</th>
                              <th style={{ padding: "10px 14px" }}>Descripción</th>
                              <th style={{ padding: "10px 14px", textAlign: "center" }}>Cant.</th>
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsList.map((prod: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #161616" }}>
                                <td style={{ padding: "10px 14px", color: "#DAA520", fontWeight: "600" }}>
                                  {prod.SKU || prod.sku || prod.codigo || "N/D"}
                                </td>
                                <td style={{ padding: "10px 14px", color: "#fff" }}>
                                  {prod.Descripción || prod.descripcion || prod.description || prod.nombre || "Sin descripción"}
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center", color: "#ccc" }}>
                                  {prod.cantidad || prod.quantity || 1}
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "right", color: "#fff", fontWeight: "600" }}>
                                  ${Number(prod.total || (Number(prod.precioUnitario || prod.precio || 0) * Number(prod.cantidad || 1)) || prod.subtotal || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    } else if (typeof itemsList === 'object' && itemsList !== null && Object.keys(itemsList).length > 0) {
                      return (
                        <div style={{ padding: "12px", color: "#fff", fontSize: "0.85rem" }}>
                          <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#DAA520" }}>SKU / Ref:</strong> {itemsList.SKU || itemsList.sku || "N/D"}</p>
                          <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#DAA520" }}>Descripción:</strong> {itemsList.Descripción || itemsList.descripcion || itemsList.description || itemsList.nombre || "N/D"}</p>
                          <p style={{ margin: 0 }}><strong style={{ color: "#DAA520" }}>Total:</strong> ${Number(itemsList.total || itemsList.precioUnitario || itemsList.precio || 0).toFixed(2)}</p>
                        </div>
                      );
                    } else {
                      return <p style={{ color: "#666", fontStyle: "italic", padding: "12px", margin: 0 }}>No hay ítems detallados guardados en esta cotización.</p>;
                    }
                  })()}
                </div>
              </div>

              {/* ACCIONES Y DOCUMENTO PDF */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(218, 165, 32, 0.3)", paddingTop: "15px" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", color: "#888" }}>Total General: </span>
                  <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>
                    ${Number(cotizacionSeleccionada.total || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {cargandoPdf ? (
                    <span style={{ fontSize: "0.8rem", color: "#DAA520", fontStyle: "italic" }}>Buscando documento...</span>
                  ) : cotizacionSeleccionada.pdf_url_final ? (
                    <a
                      href={cotizacionSeleccionada.pdf_url_final}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={btnPdfStyle}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#e6b835"; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#DAA520"; }}
                    >
                      VER DOCUMENTO QT (PDF)
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "#666" }}>Archivo no encontrado en bucket</span>
                  )}
                  <button 
                    onClick={cerrarDetalle} 
                    style={btnCerrarModalStyle}
                    onMouseOver={(e) => { e.currentTarget.style.background = "rgba(218, 165, 32, 0.15)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
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
  padding: "8px 16px",
  cursor: "pointer",
  borderRadius: "6px",
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
  backgroundColor: "#111111",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "12px",
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
  padding: "10px 20px",
  backgroundColor: "#DAA520",
  color: "#000",
  borderRadius: "6px",
  fontWeight: "700",
  fontSize: "0.8rem",
  textDecoration: "none",
  letterSpacing: "0.5px",
  display: "inline-block",
  textAlign: "center" as const,
  transition: "all 0.2s ease"
};

const btnCerrarModalStyle = {
  padding: "10px 20px",
  backgroundColor: "transparent",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "6px",
  fontWeight: "600",
  fontSize: "0.8rem",
  cursor: "pointer",
  letterSpacing: "0.5px",
  transition: "all 0.2s ease"
};