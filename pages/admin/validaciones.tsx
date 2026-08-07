"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, PageHeader, Button, inputStyle } from "../../lib/ui";

export default function AdminValidaciones() {
  const [dataList, setDataList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [formasPago, setFormasPago] = useState<{ [key: string]: { tipo: string; porcentaje: number } }>({});

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filterType, setFilterType] = useState<"todos" | "anio" | "mes" | "dia" | "rango">("todos");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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
      .select("*");

    if (error) {
      console.error("Error al cargar solicitudes:", error);
    } else {
      // Filtro SÚPER BLINDADO
      const pendientesLimpias = (data || []).filter(item => {
        const s = String(item.status || "").trim().toLowerCase();

        if (s.includes("aprob") || s.includes("rechaz")) {
          return false;
        }

        return s === "" || s === "pendiente" || s === "pending" || s === "null" || s === "undefined";
      });

      setDataList(pendientesLimpias);

      const initialPagos: { [key: string]: { tipo: string; porcentaje: number } } = {};
      pendientesLimpias.forEach((item: any) => {
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
        return new Date(item.created_at).getFullYear().toString() === selectedYear;
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
        return new Date(item.created_at).toISOString().split('T')[0] === selectedDate;
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

  /**
   * Determina la Lista de Precios (una sola letra, tal como se guarda en la
   * columna price_list de la tabla clientes) según el perfil B2B del cliente.
   * ISP -> A | MAYORISTA -> B | INTEGRADOR -> C | resto (Cliente Final) -> D
   */
  const determinarPriceList = (perfil?: string): 'A' | 'B' | 'C' | 'D' => {
    const p = (perfil || "").toUpperCase().trim();
    switch (p) {
      case "ISP":
        return "A";
      case "MAYORISTA":
        return "B";
      case "INTEGRADOR":
        return "C";
      case "CLIENTE FINAL":
      default:
        return "D";
    }
  };

  const confirmarAccion = async () => {
    const { id, tipoAccion, emailCliente, razonSocialParam, itemCompleto } = modalConfig;
    const supabase = getSupabase();

    if (!supabase || !tipoAccion) return;

    setProcesandoAccion(true);

    if (tipoAccion === 'ACTIVAR') {
      const pagoInfo = formasPago[id] || { tipo: "50%", porcentaje: 50 };
      let porcentajeInicialReal = 50;
      let porcentajeSaldoReal = 50;
      let descripcionFormaPago = "";

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

      const passwordToken = "trulink_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      // Token de activación válido por 72 horas desde su generación.
      const passwordTokenExpira = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const tipoClienteVal = itemCompleto.tipo_solicitud || 'Integrador';
      // Antes esto era un valor fijo 'C' sin importar el perfil del cliente.
      // Ahora se calcula según el perfil B2B declarado en la solicitud
      // (ISP -> A, MAYORISTA -> B, INTEGRADOR -> C, CLIENTE FINAL -> D).
      const priceListVal = determinarPriceList(itemCompleto.perfil_cliente);

      // 1. Guardar en TABLA CLIENTES (Incluyendo campos adicionales perfil_cliente e industria)
      const { error: clienteError } = await supabase
        .from("clientes")
        .upsert({
          razon_social: razonSocialParam,
          email: emailCliente,
          tipo_cliente: tipoClienteVal,
          price_list: priceListVal,
          status: 'pendiente_password',
          password_token: passwordToken,
          password_token_expira: passwordTokenExpira,
          forma_pago: pagoInfo.tipo,
          porcentaje_pago: porcentajeInicialReal,
          pais: itemCompleto.pais || null,
          telefono_oficina: itemCompleto.telefono_oficina || null,
          telefono_celular: itemCompleto.telefono_celular || null,
          perfil_cliente: itemCompleto.perfil_cliente || null,
          industria: itemCompleto.industria || null,
          comentarios_admin: comentarioAdmin
        }, { onConflict: 'email' });

      if (clienteError) {
        alert("Error al guardar en la tabla clientes: " + clienteError.message);
        setProcesandoAccion(false);
        return;
      }

      // 2. Actualizar solicitud a 'aprobado'
      const { data: confirmData, error: updateError } = await supabase
        .from("solicitudes_acceso")
        .update({
          status: 'aprobado',
          password_token: passwordToken
        })
        .eq('id', id)
        .select();

      if (updateError) {
        alert("Error al actualizar estado en solicitudes: " + updateError.message);
        setProcesandoAccion(false);
        return;
      }

      if (!confirmData || confirmData.length === 0) {
        alert("Advertencia: La solicitud no pudo ser actualizada en la BD (posible problema de permisos).");
        setProcesandoAccion(false);
        return;
      }

      // 3. Enviar correo
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
        console.error("Error enviando correo de activación:", err.message);
      }

    } else {
      // --- LÓGICA DE RECHAZO ---
      const motivoInterno = comentarioAdmin.trim() !== "" ? comentarioAdmin : "Sin comentario interno especificado.";

      // 1. Actualizar solicitud a 'rechazado'
      const { data: confirmReject, error: rejectError } = await supabase
        .from("solicitudes_acceso")
        .update({
            status: 'rechazado',
            motivo_rechazo: motivoInterno
        })
        .eq('id', id)
        .select();

      if (rejectError) {
        alert("Error al rechazar en la base de datos: " + rejectError.message);
        setProcesandoAccion(false);
        return;
      }

      if (!confirmReject || confirmReject.length === 0) {
        alert("Advertencia: La solicitud no pudo ser actualizada en la BD (posible problema de permisos).");
        setProcesandoAccion(false);
        return;
      }

      // 2. Enviar correo de rechazo
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
      } catch (err: any) {
        console.error("Error enviando correo de rechazo:", err.message);
      }
    }

    setDataList(prev => prev.filter(item => item.id !== id));
    setFilteredList(prev => prev.filter(item => item.id !== id));

    setProcesandoAccion(false);
    cerrarModal();
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="validaciones" />

      <div style={pageWrapStyle()}>

        <PageHeader
          title="VALIDACIÓN DE INSCRIPCIONES"
          subtitle="Gestión, asignación de condiciones comerciales y aprobación de solicitudes de acceso."
          counterLabel={`PENDIENTES: ${filteredList.length}`}
        />

        <Card style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>FILTRAR POR:</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="todos">Todos los registros</option>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
                <option value="anio">Por Año</option>
                <option value="rango">Por Rango de Fechas</option>
              </select>
            </div>

            {filterType === "dia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>DÍA:</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={inputStyle} />
              </div>
            )}
            {filterType === "mes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>MES:</label>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={inputStyle} />
              </div>
            )}
            {filterType === "anio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>AÑO:</label>
                <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ ...inputStyle, width: "100px" }} />
              </div>
            )}
            {filterType === "rango" && (
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>DESDE:</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>HASTA:</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.75rem", color: theme.gold, fontWeight: 600 }}>ORDENAR:</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="desc">Más recientes primero</option>
              <option value="asc">Más antiguos primero</option>
            </select>
          </div>
        </Card>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: theme.textMuted }}>Cargando solicitudes pendientes...</div>
        ) : filteredList.length === 0 ? (
          <Card style={{ padding: "60px", textAlign: "center" }}>
            <p style={{ color: theme.textMuted, fontStyle: "italic", margin: 0 }}>No se encontraron solicitudes pendientes. Todo al día.</p>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            {filteredList.map((item: any) => {
              const fechaCreacion = item.created_at ? new Date(item.created_at).toLocaleString() : 'Reciente';
              const currentPago = formasPago[item.id] || { tipo: "50%", porcentaje: 50 };

              return (
                <Card key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 0 }}>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, marginRight: "30px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <span style={{ fontSize: "0.75rem", background: theme.goldSoft, color: theme.gold, padding: "3px 8px", borderRadius: theme.radiusSm, fontWeight: 600 }}>
                        ID: {item.id ? item.id.substring(0, 8) : 'N/A'}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>Fecha: {fechaCreacion}</span>
                      {item.tipo_solicitud && (
                        <span style={{ fontSize: "0.75rem", background: theme.neutralBg, color: theme.neutral, padding: "3px 8px", borderRadius: theme.radiusSm }}>
                          Tipo: {item.tipo_solicitud}
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: "1.05rem", color: theme.textLight }}>
                      {item.razon_social || 'Sin Razón Social'}
                    </div>

                    <div style={{ fontSize: "0.88rem", color: theme.textMuted, display: "flex", gap: "20px", flexWrap: "wrap" }}>
                      <span>Correo: <strong style={{ color: theme.gold }}>{item.email}</strong></span>
                      {item.pais && <span>País: <strong style={{ color: theme.textLight }}>{item.pais}</strong></span>}
                      {(item.telefono_celular || item.telefono_oficina) && (
                        <span>Teléfono: <strong style={{ color: theme.textLight }}>{item.telefono_celular || item.telefono_oficina}</strong></span>
                      )}
                      {item.perfil_cliente && <span>Perfil: <strong style={{ color: theme.gold }}>{item.perfil_cliente}</strong></span>}
                      {item.industria && <span>Industria: <strong style={{ color: theme.gold }}>{item.industria}</strong></span>}
                    </div>

                    <div>
                      {(() => {
                        const rawVal = item.documento_url || item.documentos_url || item.url || item.documento;
                        const supabaseClient = getSupabase();
                        const docLinkStyle = {
                          padding: "11px 22px",
                          borderRadius: theme.radiusSm,
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          letterSpacing: "0.8px",
                          textDecoration: "none",
                          display: "block",
                          textAlign: "center" as const,
                          background: theme.goldSoft,
                          color: theme.gold,
                          border: `1px solid ${theme.borderGoldInput}`,
                          width: "220px",
                          boxSizing: "border-box" as const,
                          marginTop: "5px",
                        };

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
                              <a key={idx} href={link} target="_blank" rel="noreferrer" style={docLinkStyle}>
                                📄 VER ARCHIVOS PDF {validLinks.length > 1 ? idx + 1 : ''}
                              </a>
                            ));
                          }
                        }

                        if (supabaseClient) {
                          const { data: publicData } = supabaseClient.storage.from("registros").getPublicUrl(`${item.id}_documento`);
                          const fallbackUrl = publicData?.publicUrl || "#";
                          return (
                            <a href={fallbackUrl} target="_blank" rel="noreferrer" style={docLinkStyle}>
                              📄 VER ARCHIVOS PDF
                            </a>
                          );
                        }

                        return (
                          <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Sin documentos PDF adjuntos</span>
                        );
                      })()}
                    </div>

                    <div style={{ marginTop: "10px", background: "rgba(20,20,20,0.8)", border: `1px solid ${theme.borderGoldLight}`, padding: "12px 15px", borderRadius: theme.radiusSm, display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.7rem", color: theme.gold, fontWeight: 700, letterSpacing: "0.5px" }}>FORMA DE PAGO:</label>
                        <select
                          value={currentPago.tipo}
                          onChange={(e) => handleTipoPagoChange(item.id, e.target.value)}
                          style={{ ...inputStyle, cursor: "pointer" }}
                        >
                          <option value="50%">50% Anticipo / 50% antes despacho (3 días antes)</option>
                          <option value="100%">100% a la Orden de Compra</option>
                          <option value="ESPECIAL">ESPECIAL (Negociación Interna)</option>
                        </select>
                      </div>

                      {currentPago.tipo === "ESPECIAL" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: theme.goldSoft, padding: "6px 10px", borderRadius: theme.radiusSm, border: `1px dashed ${theme.borderGoldCounter}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <label style={{ fontSize: "0.65rem", color: theme.gold, fontWeight: 600 }}>% A LA ORDEN:</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentPago.porcentaje}
                              onChange={(e) => handlePorcentajeEspecialChange(item.id, parseInt(e.target.value) || 0)}
                              style={{ ...inputStyle, background: theme.inputBg, color: theme.gold, border: `1px solid ${theme.gold}`, width: "65px", textAlign: "center", fontWeight: 700 }}
                            />
                          </div>
                          <div style={{ fontSize: "0.75rem", color: theme.textMuted, alignSelf: "flex-end", paddingBottom: "4px" }}>
                            Saldo (3 días antes despacho): <strong style={{ color: theme.green }}>{100 - currentPago.porcentaje}%</strong>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Button variant="outline-green" onClick={() => abrirModal(item.id, 'ACTIVAR', item.email, item.razon_social, item)}>
                      ACTIVAR
                    </Button>
                    <Button variant="outline-red" onClick={() => abrirModal(item.id, 'RECHAZAR', item.email, item.razon_social, item)}>
                      RECHAZAR
                    </Button>
                  </div>

                </Card>
              );
            })}
          </div>
        )}
      </div>

      {modalConfig.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <Card style={{ width: "100%", maxWidth: "500px", marginBottom: 0 }}>
            <h2 style={{ color: modalConfig.tipoAccion === 'ACTIVAR' ? theme.green : theme.red, marginTop: 0, fontSize: "1.2rem", letterSpacing: "1px" }}>
              {modalConfig.tipoAccion === 'ACTIVAR' ? 'ACTIVACIÓN DE CLIENTE' : 'RECHAZAR SOLICITUD'}
            </h2>
            <p style={{ fontSize: "0.9rem", color: theme.textMuted, marginBottom: "15px" }}>
              {modalConfig.tipoAccion === 'ACTIVAR'
                ? `Añade un comentario u observación interna para el expediente de ${modalConfig.razonSocialParam} (No se envía por correo):`
                : `Añade un motivo o nota interna para el rechazo de ${modalConfig.razonSocialParam} (No se envía por correo):`}
            </p>

            <textarea
              rows={3}
              placeholder="Nota o comentario interno..."
              value={comentarioAdmin}
              onChange={(e) => setComentarioAdmin(e.target.value)}
              style={{ ...inputStyle, width: "100%", resize: "none", boxSizing: "border-box", fontSize: "0.95rem" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <Button
                variant="ghost"
                onClick={cerrarModal}
                disabled={procesandoAccion}
              >
                CANCELAR
              </Button>
              <Button
                variant="gold"
                onClick={confirmarAccion}
                disabled={procesandoAccion}
              >
                {procesandoAccion ? "PROCESANDO..." : "CONFIRMAR ACCIÓN"}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
