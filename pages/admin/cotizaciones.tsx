"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import {
  Card,
  Heading,
  PageHeader,
  Button,
  Badge,
  estadoToTone,
  inputStyle,
  DataRow,
} from "../../lib/ui";

export const dynamic = 'force-dynamic';

interface RmaVinculado {
  id: string;
  estado: string;
  tipo_resolucion: string | null;
  producto_cambio: string | null;
  numero_nota_credito: string | null;
  monto_nota_credito: number | null;
  motivo: string;
  created_at: string;
}

export default function Cotizaciones() {
  const router = useRouter();
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<any>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargandoPdf, setCargandoPdf] = useState(false);

  // RMAs / Garantías vinculados a la cotización abierta (para la parte contable)
  const [rmasVinculados, setRmasVinculados] = useState<RmaVinculado[]>([]);
  const [cargandoRmas, setCargandoRmas] = useState(false);

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  // Si llega ?ref=QT-1234 desde el módulo de RMA, filtra y abre el detalle automáticamente
  useEffect(() => {
    if (!router.isReady) return;
    const ref = router.query.ref;
    if (ref && typeof ref === "string" && cotizaciones.length > 0) {
      setBusqueda(ref);
      const encontrada = cotizaciones.find(
        (c) => (c.referencia || `QT-${c.id}`).toLowerCase() === ref.toLowerCase()
      );
      if (encontrada) {
        abrirDetalle(encontrada);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.ref, cotizaciones]);

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

  // Busca en la tabla "rmas" todos los registros vinculados a esta cotización/factura,
  // usando la referencia como llave de cruce (rmas.referencia = quotes.referencia).
  const cargarRmasVinculados = async (referencia: string) => {
    if (!supabase || !referencia) {
      setRmasVinculados([]);
      return;
    }
    setCargandoRmas(true);
    const { data, error } = await supabase
      .from("rmas")
      .select("id, estado, tipo_resolucion, producto_cambio, numero_nota_credito, monto_nota_credito, motivo, created_at")
      .eq("referencia", referencia)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar RMAs vinculados:", error.message);
      setRmasVinculados([]);
    } else {
      setRmasVinculados(data || []);
    }
    setCargandoRmas(false);
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

    const referenciaStr = item.referencia || `QT-${item.id}`;
    cargarRmasVinculados(referenciaStr);

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
    setRmasVinculados([]);
    // limpia el ?ref= de la URL para no reabrir el modal al refrescar
    if (router.query.ref) {
      router.replace("/admin/cotizaciones", undefined, { shallow: true });
    }
  };

  const irAModuloRma = (codigoCotizacion: string) => {
    router.push(`/admin/rmas?buscar=${encodeURIComponent(codigoCotizacion)}`);
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

  const montoTotalCreditoCotizacion = rmasVinculados
    .filter((r) => r.tipo_resolucion === "Nota de Crédito")
    .reduce((acc, r) => acc + (r.monto_nota_credito || 0), 0);

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="cotizaciones" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="CONTROL DE COTIZACIONES"
          subtitle="Gestión y supervisión detallada de cotizaciones emitidas, estados y documentos asociados."
          counterLabel={`TOTAL REGISTROS: ${cotizacionesFiltradas.length}`}
        />

        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder="Filtrar por referencia (QT-XXXX), tipo, razón social, representante, email o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ ...inputStyle, width: "100%", maxWidth: "550px", boxShadow: theme.shadowCard }}
          />
        </div>

        {cotizacionesFiltradas.length === 0 ? (
          <Card style={{ padding: "60px", textAlign: "center" }}>
            <p style={{ color: theme.textMuted, fontStyle: "italic", fontSize: "1rem", margin: 0, letterSpacing: "0.5px" }}>
              No se encontraron cotizaciones registradas.
            </p>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}`, color: theme.gold, backgroundColor: theme.panelBg }}>
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
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = theme.goldSoft; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ ...tdStyle, color: theme.textMuted, fontSize: "0.85rem" }}>
                        <span style={{ color: theme.gold, fontWeight: "600" }}>{referenciaStr}</span>
                        <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "2px" }}>{fechaFormateada}</div>
                      </td>
                      <td style={{ ...tdStyle, color: theme.textLight, fontWeight: "500" }}>
                        {empresa}
                        {representante !== "N/D" && representante && (
                          <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "2px" }}>Atn: {representante}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                        <div style={{ color: theme.gold }}>{email}</div>
                        <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "2px" }}>{telefono}</div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                        <Badge tone="gold">{tipoStr}</Badge>
                      </td>
                      <td style={{ ...tdStyle, color: theme.textLight, fontWeight: "600" }}>
                        ${totalVal}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <Button variant="outline-gold" onClick={() => abrirDetalle(item)}>
                          VER DETALLE
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* MODAL DE DETALLE DE COTIZACIÓN */}
        {modalAbierto && cotizacionSeleccionada && (
          <div style={modalOverlayStyle}>
            <Card style={{ width: "90%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.borderGoldCounter}`, paddingBottom: "12px", marginBottom: "20px" }}>
                <Heading style={{ fontSize: "1.2rem", margin: 0 }}>
                  DETALLE DE COTIZACIÓN: {cotizacionSeleccionada.referencia || `QT-${cotizacionSeleccionada.id}`}
                </Heading>
                <Button variant="ghost" onClick={cerrarDetalle}>✕</Button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px", fontSize: "0.9rem" }}>
                <DataRow label="Empresa / Razón Social" valor={cotizacionSeleccionada.empresaResuelto} />
                <DataRow
                  label="Representante / Atención"
                  valor={`${cotizacionSeleccionada.representanteResuelto} ${cotizacionSeleccionada.cargo ? `(${cotizacionSeleccionada.cargo})` : ""}`}
                />
                <DataRow label="Identificación Fiscal" valor={cotizacionSeleccionada.identificacion_fiscal || "N/D"} />
                <DataRow
                  label="Sitio Web / Industria"
                  valor={`${cotizacionSeleccionada.sitio_web || "N/D"} ${cotizacionSeleccionada.industria ? `/ ${cotizacionSeleccionada.industria}` : ""}`}
                />
                <DataRow label="Correo Electrónico" valor={cotizacionSeleccionada.emailResuelto} />
                <DataRow label="Teléfono" valor={cotizacionSeleccionada.telefonoResuelto} />
                <DataRow
                  label="País / Dirección"
                  valor={`${cotizacionSeleccionada.pais || "N/D"} - ${cotizacionSeleccionada.direccion || "N/D"}`}
                />
                <DataRow
                  label="Tipo de Solicitud"
                  valor={cotizacionSeleccionada.tipo_solicitud || cotizacionSeleccionada.type || cotizacionSeleccionada.tipo || "N/D"}
                />
                <DataRow
                  label="Fecha de Emisión"
                  valor={cotizacionSeleccionada.created_at ? new Date(cotizacionSeleccionada.created_at).toLocaleString() : "N/D"}
                />
                <DataRow
                  label="Estado"
                  valor={
                    <Badge tone={estadoToTone(cotizacionSeleccionada.status)}>
                      {cotizacionSeleccionada.status || "pendiente"}
                    </Badge>
                  }
                />
              </div>

              {/* ÍTEMS / PRODUCTOS */}
              <div style={{ marginBottom: "20px" }}>
                <Heading style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: theme.textMuted, marginBottom: "8px" }}>
                  Ítems / Contenido de la Cotización:
                </Heading>
                <Card style={{ background: theme.inputBg, borderRadius: theme.radiusSm, padding: 0, marginBottom: 0, maxHeight: "180px", overflowY: "auto" }}>
                  {(() => {
                    const itemsList = parseJSON(cotizacionSeleccionada.items) || parseJSON(cotizacionSeleccionada.productos) || parseJSON(cotizacionSeleccionada.details);
                    if (Array.isArray(itemsList) && itemsList.length > 0) {
                      return (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}`, color: theme.gold, backgroundColor: theme.panelBg }}>
                              <th style={{ padding: "10px 14px" }}>SKU / Ref</th>
                              <th style={{ padding: "10px 14px" }}>Descripción</th>
                              <th style={{ padding: "10px 14px", textAlign: "center" }}>Cant.</th>
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsList.map((prod: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #161616" }}>
                                <td style={{ padding: "10px 14px", color: theme.gold, fontWeight: "600" }}>
                                  {prod.SKU || prod.sku || prod.codigo || "N/D"}
                                </td>
                                <td style={{ padding: "10px 14px", color: theme.textLight }}>
                                  {prod.Descripción || prod.descripcion || prod.description || prod.nombre || "Sin descripción"}
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center", color: theme.textMuted }}>
                                  {prod.cantidad || prod.quantity || 1}
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "right", color: theme.textLight, fontWeight: "600" }}>
                                  ${Number(prod.total || (Number(prod.precioUnitario || prod.precio || 0) * Number(prod.cantidad || 1)) || prod.subtotal || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    } else if (typeof itemsList === 'object' && itemsList !== null && Object.keys(itemsList).length > 0) {
                      return (
                        <div style={{ padding: "12px", color: theme.textLight, fontSize: "0.85rem" }}>
                          <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: theme.gold }}>SKU / Ref:</strong> {itemsList.SKU || itemsList.sku || "N/D"}</p>
                          <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: theme.gold }}>Descripción:</strong> {itemsList.Descripción || itemsList.descripcion || itemsList.description || itemsList.nombre || "N/D"}</p>
                          <p style={{ margin: 0 }}><strong style={{ color: theme.gold }}>Total:</strong> ${Number(itemsList.total || itemsList.precioUnitario || itemsList.precio || 0).toFixed(2)}</p>
                        </div>
                      );
                    } else {
                      return <p style={{ color: theme.textMuted, fontStyle: "italic", padding: "12px", margin: 0 }}>No hay ítems detallados guardados en esta cotización.</p>;
                    }
                  })()}
                </Card>
              </div>

              {/* RMA / GARANTÍAS VINCULADAS — parte contable de notas de crédito y cambios */}
              <div style={{ marginBottom: "20px" }}>
                <Heading style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: theme.textMuted, marginBottom: "8px" }}>
                  Garantías / RMA vinculados (impacto contable):
                </Heading>
                <Card style={{ background: theme.inputBg, borderRadius: theme.radiusSm, padding: "12px", marginBottom: 0 }}>
                  {cargandoRmas ? (
                    <p style={{ color: theme.gold, fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>Buscando garantías vinculadas...</p>
                  ) : rmasVinculados.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>
                      Sin RMA/garantías registradas para esta cotización.
                    </p>
                  ) : (
                    <>
                      {rmasVinculados.map((rma) => (
                        <div
                          key={rma.id}
                          style={{
                            padding: "10px 0",
                            borderBottom: "1px solid #1a1a1a",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          <div>
                            <Badge tone={estadoToTone(rma.estado)}>{rma.estado}</Badge>
                            <span style={{ color: theme.textMuted, fontSize: "0.85rem", marginLeft: "8px" }}>{rma.motivo}</span>
                          </div>
                          <div style={{ fontSize: "0.85rem", color: theme.textLight }}>
                            {rma.tipo_resolucion === "Nota de Crédito" && (
                              <span style={{ color: theme.goldBright, fontWeight: 700 }}>
                                💳 NC {rma.numero_nota_credito} — ${rma.monto_nota_credito?.toFixed(2)}
                              </span>
                            )}
                            {rma.tipo_resolucion === "Cambio de Producto" && (
                              <span style={{ color: "#3498db", fontWeight: 600 }}>
                                🔁 Cambio: {rma.producto_cambio}
                              </span>
                            )}
                            {!rma.tipo_resolucion && <span style={{ color: theme.textMuted }}>Pendiente de resolución</span>}
                          </div>
                        </div>
                      ))}
                      {montoTotalCreditoCotizacion > 0 && (
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${theme.borderGoldCounter}`, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: theme.textMuted, fontSize: "0.8rem" }}>Total en Notas de Crédito emitidas para esta cotización:</span>
                          <span style={{ color: theme.goldBright, fontWeight: 800, fontSize: "0.95rem" }}>
                            ${montoTotalCreditoCotizacion.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <Button
                    variant="outline-gold"
                    onClick={() => irAModuloRma(cotizacionSeleccionada.referencia || `QT-${cotizacionSeleccionada.id}`)}
                    style={{ marginTop: "12px" }}
                  >
                    IR AL MÓDULO DE RMA / GARANTÍAS ↗
                  </Button>
                </Card>
              </div>

              {/* ACCIONES Y DOCUMENTO PDF */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.borderGoldCounter}`, paddingTop: "15px" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", color: theme.textMuted }}>Total General: </span>
                  <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: theme.textLight }}>
                    ${Number(cotizacionSeleccionada.total || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {cargandoPdf ? (
                    <span style={{ fontSize: "0.8rem", color: theme.gold, fontStyle: "italic" }}>Buscando documento...</span>
                  ) : cotizacionSeleccionada.pdf_url_final ? (
                    <a
                      href={cotizacionSeleccionada.pdf_url_final}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "10px 20px",
                        background: theme.goldGradient,
                        color: "#1A1400",
                        borderRadius: theme.radiusSm,
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        textDecoration: "none",
                        letterSpacing: "0.5px",
                        display: "inline-block",
                        textAlign: "center",
                      }}
                    >
                      VER DOCUMENTO QT (PDF)
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Archivo no encontrado en bucket</span>
                  )}
                  <Button variant="outline-gold" onClick={cerrarDetalle}>
                    CERRAR
                  </Button>
                </div>
              </div>
            </Card>
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
