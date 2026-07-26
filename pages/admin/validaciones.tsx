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

  // ESTADOS PARA EL MODAL DE COMENTARIOS
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    tipoAccion: 'ACTIVAR' | 'RECHAZAR' | null;
    id: string;
    emailCliente: string;
    razonSocialParam: string;
    itemCompleto: any;
  }>({
    isOpen: false,
    tipoAccion: null,
    id: "",
    emailCliente: "",
    razonSocialParam: "",
    itemCompleto: null
  });
  const [comentarioAdmin, setComentarioAdmin] = useState<string>("");
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);

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

  const abrirModal = (id: string, tipoAccion: 'ACTIVAR' | 'RECHAZAR', emailCliente: string, razonSocialParam: string, itemCompleto: any) => {
    setModalConfig({ isOpen: true, tipoAccion, id, emailCliente, razonSocialParam, itemCompleto });
    setComentarioAdmin("");
  };

  const cerrarModal = () => {
    setModalConfig({ isOpen: false, tipoAccion: null, id: "", emailCliente: "", razonSocialParam: "", itemCompleto: null });
    setComentarioAdmin("");
  };

  const confirmarAccion = async () => {
    const { id, tipoAccion, emailCliente, razonSocialParam, itemCompleto } = modalConfig;
    const supabase = getSupabase();
    
    if (!supabase || !tipoAccion) return;

    setProcesandoAccion(true);

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

      // 1. Guardar/Actualizar en la TABLA CLIENTES (Conflict resolution por 'razon_social')
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
          telefono_celular: itemCompleto.telefono_celular || null,
          comentarios_admin: comentarioAdmin
        }, { onConflict: 'razon_social' });

      if (clienteError) {
        alert("Error al guardar en clientes: " + clienteError.message);
        setProcesandoAccion(false);
        return;
      }

      // 2. Actualizar el estado en solicitudes_acceso a 'aprobado'
      const { error: updateError } = await supabase
        .from("solicitudes_acceso")
        .update({ 
          status: 'aprobado', 
          password_token: passwordToken
        })
        .eq('id', id);

      if (updateError) {
        alert("Error al actualizar la solicitud en base de datos: " + updateError.message);
        setProcesandoAccion(false);
        return;
      }

      // 3. Enviar correo de activación
      try {
        await fetch("/api/send-email", {
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
      } catch (err: any) {
        console.error("Cliente registrado, error enviando correo: ", err.message);
      }

    } else {
      // LOGICA DE RECHAZO
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

      const { error: rejectError } = await supabase
        .from("solicitudes_acceso")
        .update({ 
            status: 'rechazado',
            motivo_rechazo: comentarioAdmin
        })
        .eq('id', id);

      if (rejectError) {
        alert("Error al rechazar en base de datos: " + rejectError.message);
        setProcesandoAccion(false);
        return;
      }
    }

    // 4. ACTUALIZACIÓN OPTIMISTA
    setDataList(prev => prev.filter(item => item.id !== id));
    setFilteredList(prev => prev.filter(item => item.id !== id));
    
    setProcesandoAccion(false);
    cerrarModal();
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="validaciones" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box", position: "relative" }}>
        
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
                    <button onClick={() => abrirModal(item.id, 'ACTIVAR', item.email, item.razon_social, item)} style={btnActivar}>
                      ACTIVAR
                    </button>
                    <button onClick={() => abrirModal(item.id, 'RECHAZAR', item.email, item.razon_social, item)} style={btnRechazar}>
                      RECHAZAR
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- MODAL DE COMENTARIOS --- */}
      {modalConfig.isOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: modalConfig.tipoAccion === 'ACTIVAR' ? "#2ecc71" : "#e74c3c", marginTop: 0, fontSize: "1.2rem", letterSpacing: "1px" }}>
              {modalConfig.tipoAccion === 'ACTIVAR' ? 'ACTIVACIÓN DE CLIENTE' : 'RECHAZO DE SOLICITUD'}
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#CCC", marginBottom: "15px" }}>
              {modalConfig.tipoAccion === 'ACTIVAR' 
                ? `¿Deseas añadir un comentario interno o nota para el expediente de ${modalConfig.razonSocialParam}?` 
                : `Por favor, indica el motivo del rechazo o nota interna para ${modalConfig.razonSocialParam}.`}
            </p>
            
            <textarea 
              rows={3} 
              placeholder="Ingresa tu comentario aquí..."
              value={comentarioAdmin}
              onChange={(e) => setComentarioAdmin(e.target.value)}
              style={textareaStyle}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button 
                onClick={cerrarModal} 
                disabled={procesandoAccion}
                style={{ ...baseBtn, background: "transparent", color: "#AAA", border: "1px solid #555" }}
              >
                CANCELAR
              </button>
              <button 
                onClick={confirmarAccion} 
                disabled={procesandoAccion}
                style={{ 
                  ...baseBtn, 
                  background: modalConfig.tipoAccion === 'ACTIVAR' ? "rgba(46, 204, 113, 0.2)" : "rgba(231, 76, 60, 0.2)", 
                  color: modalConfig.tipoAccion === 'ACTIVAR' ? "#2ecc71" : "#e74c3c", 
                  border: `1px solid ${modalConfig.tipoAccion === 'ACTIVAR' ? "#2ecc71" : "#e74c3c"}`,
                  opacity: procesandoAccion ? 0.5 : 1
                }}
              >
                {procesandoAccion ? "PROCESANDO..." : "CONFIRMAR ACCIÓN"}
              </button>
            </div>
          </div>
        </div>
      )}

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

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(4px)"
};

const modalStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "12px",
  padding: "30px",
  width: "100%",
  maxWidth: "500px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.8)"
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "#1a1a1a",
  color: "#E0E0E0",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "8px",
  padding: "12px",
  fontSize: "0.95rem",
  outline: "none",
  resize: "none",
  boxSizing: "border-box",
  fontFamily: "inherit"
};