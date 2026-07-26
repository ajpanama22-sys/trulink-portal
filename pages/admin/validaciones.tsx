import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

// Forzamos a Next.js a no intentar pre-renderizar esta página durante el build
export const dynamic = 'force-dynamic';

export default function AdminValidaciones() {
  const [dataList, setDataList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados para formas de pago por cada solicitud en interfaz
  const [formasPago, setFormasPago] = useState<{ [key: string]: { tipo: string; porcentaje: number } }>({});

  // Estados para filtros y ordenamiento
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filterType, setFilterType] = useState<"todos" | "anio" | "mes" | "dia" | "rango">("todos");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  useEffect(() => {
    aplicarFiltrosYOrden();
  }, [dataList, sortOrder, filterType, selectedYear, selectedMonth, selectedDate, dateFrom, dateTo]);

  const cargarSolicitudes = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitudes_acceso")
      .select("*")
      .or("status.is.null,status.eq.pendiente");
      
    if (error) {
      console.error("Error al cargar solicitudes:", error);
    } else {
      setDataList(data || []);
      const initialPagos: { [key: string]: { tipo: string; porcentaje: number } } = {};
      (data || []).forEach((item: any) => {
        initialPagos[item.id] = { tipo: "50%", porcentaje: 50 };
      });
      setFormasPago(initialPagos);
    }
    setLoading(false);
  };

  const handleTipoPagoChange = (id: string, tipo: string) => {
    let porcentajeDef = 50;
    if (tipo === "100%") porcentajeDef = 100;
    if (tipo === "50%") porcentajeDef = 50;
    if (tipo === "ESPECIAL") porcentajeDef = formasPago[id]?.porcentaje || 30;

    setFormasPago(prev => ({
      ...prev,
      [id]: { tipo, porcentaje: porcentajeDef }
    }));
  };

  const handlePorcentajeEspecialChange = (id: string, val: number) => {
    const num = Math.max(0, Math.min(100, val));
    setFormasPago(prev => ({
      ...prev,
      [id]: { ...prev[id], porcentaje: num }
    }));
  };

  const aplicarFiltrosYOrden = () => {
    let resultado = [...dataList];

    if (filterType === "anio" && selectedYear) {
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const itemYear = new Date(item.created_at).getFullYear().toString();
        return itemYear === selectedYear;
      });
    } else if (filterType === "mes" && selectedMonth) {
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const dateObj = new Date(item.created_at);
        const itemMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        return itemMonth === selectedMonth;
      });
    } else if (filterType === "dia" && selectedDate) {
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const dateObj = new Date(item.created_at);
        const itemDate = dateObj.toISOString().split('T')[0];
        return itemDate === selectedDate;
      });
    } else if (filterType === "rango") {
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const itemDate = item.created_at.split('T')[0];
        if (dateFrom && itemDate < dateFrom) return false;
        if (dateTo && itemDate > dateTo) return false;
        return true;
      });
    }

    resultado.sort((a, b) => {
      const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === "desc" ? fechaB - fechaA : fechaA - fechaB;
    });

    setFilteredList(resultado);
  };

  const procesarSolicitud = async (id: string, tipoAccion: 'ACTIVAR' | 'RECHAZAR', emailCliente: string, razonSocialParam: string, itemCompleto: any) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const pagoInfo = formasPago[id] || { tipo: "50%", porcentaje: 50 };
    let descripcionFormaPago = "";
    let porcentajeInicialReal = 50;
    let porcentajeSaldoReal = 50;

    if (pagoInfo.tipo === "50%") {
      porcentajeInicialReal = 50;
      porcentajeSaldoReal = 50;
      descripcionFormaPago = "50% a la orden de compra / aceptación de cotización y el 50% restante exactos 3 días antes de la fecha estimada de despacho.";
    } else if (pagoInfo.tipo === "100%") {
      porcentajeInicialReal = 100;
      porcentajeSaldoReal = 0;
      descripcionFormaPago = "100% de pago anticipado a la aceptación de la cotización o emisión de orden de compra (Sin saldo pendiente).";
    } else {
      porcentajeInicialReal = pagoInfo.porcentaje;
      porcentajeSaldoReal = 100 - porcentajeInicialReal;
      descripcionFormaPago = `Especial: ${porcentajeInicialReal}% a la aceptación de cotización / orden de compra y el diferencial de saldo de ${porcentajeSaldoReal}% exigible obligatoriamente 3 días antes de la fecha estimada de despacho.`;
    }

    if (tipoAccion === 'ACTIVAR') {
      const passwordToken = "trulink_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const tipoClienteVal = itemCompleto.tipo_solicitud || 'Integrador';
      const priceListVal = 'C';

      // 1. Guardar/Actualizar en la TABLA CLIENTES (incluyendo forma_pago y porcentaje_pago)
      const { error: clienteError } = await supabase
        .from("clientes")
        .upsert({
          razon_social: razonSocialParam,
          email: emailCliente,
          tipo_cliente: tipoClienteVal,
          price_list: priceListVal,
          status: 'pendiente_password',
          password_token: passwordToken,
          forma_pago: pagoInfo.tipo,
          porcentaje_pago: porcentajeInicialReal,
          pais: itemCompleto.pais || null,
          telefono_oficina: itemCompleto.telefono_oficina || null,
          telefono_celular: itemCompleto.telefono_celular || null
        }, { onConflict: 'email' });

      if (clienteError) {
        alert("Error al guardar en clientes: " + clienteError.message);
        return;
      }

      // 2. Actualizar el estado únicamente en solicitudes_acceso
      const { error: updateError } = await supabase
        .from("solicitudes_acceso")
        .update({ 
          status: 'active', 
          password_token: passwordToken
        })
        .eq('id', id);

      if (updateError) {
        alert("Error al actualizar la solicitud en base de datos: " + updateError.message);
        return;
      }

      // 3. Enviar correo de activación vía API / Brevo
      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "ACTIVACION",
            email: emailCliente,
            razon_social: razonSocialParam,
            link: `https://portal.trulinkfiber.org/auth/crear-password?token=${passwordToken}`,
            forma_pago_texto: descripcionFormaPago,
            porcentaje_inicial: porcentajeInicialReal,
            porcentaje_saldo: porcentajeSaldoReal
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de activación");
        alert(`¡Solicitud activada con éxito y cliente registrado! Correo enviado a ${emailCliente}`);
      } catch (err: any) {
        alert("Cliente registrado en BD, pero hubo un error enviando el correo: " + err.message);
      }

    } else {
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "RECHAZO",
            email: emailCliente,
            razon_social: razonSocialParam
          })
        });
      } catch (err) {
        console.error("Error enviando correo de rechazo:", err);
      }

      const { error: deleteError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'rejected' })
        .eq('id', id);

      if (deleteError) {
        await supabase.from("solicitudes_acceso").delete().eq('id', id);
      }

      alert(`La solicitud de ${razonSocialParam} ha sido rechazada.`);
    }

    cargarSolicitudes();
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="validaciones" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              VALIDACIÓN DE INSCRIPCIONES
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Gestión, asignación de condiciones comerciales y aprobación de solicitudes de acceso.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            PENDIENTES: {filteredList.length}
          </div>
        </div>

        {/* Barra de Filtros */}
        <div style={{ background: "#111111", border: "1px solid #222", borderRadius: "10px", padding: "20px", marginBottom: "30px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>FILTRAR POR:</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} style={selectStyle}>
                <option value="todos">Todos los registros</option>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
                <option value="anio">Por Año</option>
                <option value="rango">Por Rango de Fechas</option>
              </select>
            </div>

            {filterType === "dia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>DÍA:</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={inputStyle} />
              </div>
            )}
            {filterType === "mes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>MES:</label>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={inputStyle} />
              </div>
            )}
            {filterType === "anio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>AÑO:</label>
                <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ ...inputStyle, width: "100px" }} />
              </div>
            )}
            {filterType === "rango" && (
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>DESDE:</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>HASTA:</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600" }}>ORDENAR:</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")} style={selectStyle}>
              <option value="desc">Más recientes primero</option>
              <option value="asc">Más antiguos primero</option>
            </select>
          </div>
        </div>

        {/* Listado de Solicitudes */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#666" }}>Cargando solicitudes...</div>
        ) : filteredList.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "60px", textAlign: "center" }}>
            <p style={{ color: "#777", fontStyle: "italic", margin: 0 }}>No se encontraron solicitudes pendientes.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            {filteredList.map((item: any) => {
              const fechaCreacion = item.created_at ? new Date(item.created_at).toLocaleString() : 'Reciente';
              const currentPago = formasPago[item.id] || { tipo: "50%", porcentaje: 50 };

              return (
                <div key={item.id} style={{ background: "#111111", border: "1px solid #222", borderRadius: "12px", padding: "25px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, marginRight: "30px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <span style={{ fontSize: "0.75rem", background: "rgba(218, 165, 32, 0.15)", color: "#DAA520", padding: "3px 8px", borderRadius: "4px", fontWeight: "600" }}>
                        ID: {item.id ? item.id.substring(0, 8) : 'N/A'}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#888" }}>Fecha: {fechaCreacion}</span>
                      {item.tipo_solicitud && (
                        <span style={{ fontSize: "0.75rem", background: "#222", color: "#AAA", padding: "3px 8px", borderRadius: "4px" }}>
                          Tipo: {item.tipo_solicitud}
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: "600", fontSize: "1.05rem", color: "#FFF" }}>
                      {item.razon_social || 'Sin Razón Social'}
                    </div>

                    <div style={{ fontSize: "0.88rem", color: "#AAA", display: "flex", gap: "20px", flexWrap: "wrap" }}>
                      <span>Correo: <strong style={{ color: "#DAA520" }}>{item.email}</strong></span>
                      {item.pais && <span>País: <strong style={{ color: "#FFF" }}>{item.pais}</strong></span>}
                      {(item.telefono_celular || item.telefono_oficina) && (
                        <span>Teléfono: <strong style={{ color: "#FFF" }}>{item.telefono_celular || item.telefono_oficina}</strong></span>
                      )}
                    </div>

                    {/* SECCIÓN DE DOCUMENTOS ADJUNTOS */}
                    <div>
                      {(() => {
                        const rawVal = item.documento_url || item.documentos_url || item.url || item.documento;
                        const supabaseClient = getSupabase();

                        if (rawVal) {
                          let filePaths: string[] = [];

                          if (typeof rawVal === 'string') {
                            try {
                              const parsed = JSON.parse(rawVal);
                              if (Array.isArray(parsed)) {
                                filePaths = parsed.map(p => typeof p === 'string' ? p : (p.url || p.path || ''));
                              } else if (typeof parsed === 'object' && parsed !== null) {
                                filePaths = [parsed.url || parsed.path || ''];
                              } else {
                                filePaths = [rawVal];
                              }
                            } catch (e) {
                              filePaths = rawVal.split(/[,;\s]+/).filter(Boolean);
                            }
                          } else if (Array.isArray(rawVal)) {
                            filePaths = rawVal.map(p => typeof p === 'string' ? p : (p.url || p.path || ''));
                          }

                          const validLinks = filePaths.map(pathItem => {
                            let cleanPath = pathItem.trim();
                            if (!cleanPath) return null;

                            if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
                              return cleanPath;
                            } else if (supabaseClient) {
                              if (cleanPath.includes('/storage/v1/object/public/')) {
                                const parts = cleanPath.split('/storage/v1/object/public/');
                                cleanPath = parts[parts.length - 1];
                              }
                              if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
                              
                              const { data: publicData } = supabaseClient.storage.from("registros").getPublicUrl(cleanPath);
                              return publicData?.publicUrl || null;
                            }
                            return null;
                          }).filter(Boolean) as string[];

                          if (validLinks.length > 0) {
                            return validLinks.map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noreferrer" style={{ ...btnDocumentos, display: "block", marginBottom: "5px" }}>
                                📄 VER ARCHIVOS PDF {validLinks.length > 1 ? idx + 1 : ''}
                              </a>
                            ));
                          }
                        }

                        if (supabaseClient) {
                          const { data: publicData } = supabaseClient.storage.from("registros").getPublicUrl(`${item.id}_documento`);
                          const fallbackUrl = publicData?.publicUrl || "#";
                          return (
                            <a href={fallbackUrl} target="_blank" rel="noreferrer" style={btnDocumentos}>
                              📄 VER ARCHIVOS PDF
                            </a>
                          );
                        }

                        return (
                          <span style={{ fontSize: "0.8rem", color: "#666" }}>Sin documentos PDF adjuntos</span>
                        );
                      })()}
                    </div>

                    {/* CONFIGURACIÓN DE FORMA DE PAGO */}
                    <div style={{ marginTop: "10px", background: "rgba(20,20,20,0.8)", border: "1px solid rgba(218, 165, 32, 0.2)", padding: "12px 15px", borderRadius: "8px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.7rem", color: "#DAA520", fontWeight: "700", letterSpacing: "0.5px" }}>FORMA DE PAGO:</label>
                        <select 
                          value={currentPago.tipo} 
                          onChange={(e) => handleTipoPagoChange(item.id, e.target.value)}
                          style={selectStyle}
                        >
                          <option value="50%">50% Anticipo / 50% antes despacho (3 días antes)</option>
                          <option value="100%">100% a la Orden de Compra</option>
                          <option value="ESPECIAL">ESPECIAL (Negociación Interna)</option>
                        </select>
                      </div>

                      {currentPago.tipo === "ESPECIAL" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(218, 165, 32, 0.05)", padding: "6px 10px", borderRadius: "6px", border: "1px dashed rgba(218, 165, 32, 0.4)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <label style={{ fontSize: "0.65rem", color: "#DAA520", fontWeight: "600" }}>% A LA ORDEN:</label>
                            <input 
                              type="number" 
                              min="0" 
                              max="100" 
                              value={currentPago.porcentaje}
                              onChange={(e) => handlePorcentajeEspecialChange(item.id, parseInt(e.target.value) || 0)}
                              style={{ background: "#000", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "4px", padding: "4px 8px", width: "65px", textAlign: "center", fontWeight: "700" }}
                            />
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#AAA", alignSelf: "flex-end", paddingBottom: "4px" }}>
                            Saldo (3 días antes despacho): <strong style={{ color: "#2ecc71" }}>{100 - currentPago.porcentaje}%</strong>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button onClick={() => procesarSolicitud(item.id, 'ACTIVAR', item.email, item.razon_social, item)} style={btnActivar}>
                      ACTIVAR
                    </button>
                    <button onClick={() => procesarSolicitud(item.id, 'RECHAZAR', item.email, item.razon_social, item)} style={btnRechazar}>
                      RECHAZAR
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  background: "#1a1a1a",
  color: "#E0E0E0",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "0.85rem",
  outline: "none",
  cursor: "pointer"
};

const inputStyle = {
  background: "#1a1a1a",
  color: "#E0E0E0",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "6px",
  padding: "7px 10px",
  fontSize: "0.85rem",
  outline: "none"
};

const baseBtn = {
  padding: "11px 22px",
  cursor: "pointer",
  borderRadius: "6px",
  fontWeight: "600",
  fontSize: "0.8rem",
  letterSpacing: "0.8px",
  transition: "all 0.2s ease",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center" as const
};

const btnDocumentos = {
  ...baseBtn,
  background: "rgba(218, 165, 32, 0.05)",
  color: "#DAA525",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  width: "220px",
  boxSizing: "border-box" as const,
  marginTop: "5px"
};

const btnActivar = {
  ...baseBtn,
  background: "transparent",
  color: "#2ecc71",
  border: "1px solid rgba(46, 204, 113, 0.5)",
  minWidth: "110px"
};

const btnRechazar = {
  ...baseBtn,
  background: "transparent",
  color: "#e74c3c",
  border: "1px solid rgba(231, 76, 60, 0.5)",
  minWidth: "110px"
};