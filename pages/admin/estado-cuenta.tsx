"use client";

import { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { useRequiereRol } from "../../lib/useRequiereRol";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, Heading, PageHeader, Button, Badge, estadoToTone, inputStyle, DataRow } from "../../lib/ui";

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EstadoDeCuenta() {
  // ── Guard de página: mismo criterio que el Módulo Contable ──
  const { cargando: cargandoAuth, autorizado } = useRequiereRol(["Super Administrador", "Administrador"]);

  const supabase = getSupabase();

  const [clientes, setClientes] = useState<any[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);

  const [quotes, setQuotes] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => { cargarClientes(); }, []);

  const cargarClientes = async () => {
    if (!supabase) { setCargandoClientes(false); return; }
    setCargandoClientes(true);
    const { data, error } = await supabase.from("clientes").select("*").order("razon_social");
    if (error) console.error("Error cargando clientes:", error.message);
    setClientes(data || []);
    setCargandoClientes(false);
  };

  /** Lista filtrada por el buscador, para elegir el cliente. */
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.razon_social, c.email, c.perfil_cliente, c.pais]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [clientes, busqueda]);

  /**
   * Al elegir un cliente, se traen sus cotizaciones y sus movimientos de
   * pago. El cruce se hace por email -- es la clave que ya usa todo el
   * proyecto (validaciones.tsx hace upsert onConflict:'email', pagos.
   * cliente_email se llena con el mismo dato) así que es la más confiable
   * hoy, aunque quotes también tiene client_id (uuid) por si se quiere
   * migrar a esa relación más adelante.
   */
  const seleccionarCliente = async (cliente: any) => {
    setClienteSeleccionado(cliente);
    if (!supabase || !cliente?.email) return;

    setCargandoDetalle(true);
    try {
      const [quotesRes, pagosRes] = await Promise.all([
        supabase.from("quotes").select("*").eq("email", cliente.email).order("created_at", { ascending: false }),
        supabase.from("pagos").select("*").eq("cliente_email", cliente.email).order("created_at", { ascending: false }),
      ]);

      if (quotesRes.error) console.error("Error cargando cotizaciones del cliente:", quotesRes.error.message);
      if (pagosRes.error) console.error("Error cargando pagos del cliente (¿corriste el SQL de pagos?):", pagosRes.error.message);

      setQuotes(quotesRes.data || []);
      setPagos(pagosRes.data || []);
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ── Totales del estado de cuenta ──
  const totalCotizado = quotes.reduce((acc, q) => acc + Number(q.total || 0), 0);
  const totalAbonado = pagos
    .filter((p) => p.status === "confirmado")
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);
  const totalPendienteVerificacion = pagos
    .filter((p) => p.status === "pendiente_verificacion")
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);
  const saldoPendiente = Math.max(0, totalCotizado - totalAbonado);

  // ── Guard de acceso ──
  if (cargandoAuth) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar currentActive="estado-cuenta" />
        <div style={pageWrapStyle()}>
          <p style={{ color: theme.gold }}>Verificando acceso...</p>
        </div>
      </div>
    );
  }
  if (!autorizado) {
    return null;
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="estado-cuenta" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="Estado de Cuenta por Cliente"
          subtitle="Cotizaciones, abonos y saldo pendiente consolidados por cliente."
        />

        {/* ── Buscador / selector de cliente ── */}
        <Card style={{ marginBottom: "25px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: theme.gold, fontWeight: 600, marginBottom: "8px" }}>
            BUSCAR CLIENTE (razón social, email, perfil o país)
          </label>
          <input
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "14px" }}
            placeholder="Ej: Juan Test Activado, juan@correo.com, ISP..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargandoClientes ? (
            <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>Cargando clientes...</p>
          ) : clientesFiltrados.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>No se encontraron clientes con ese criterio.</p>
          ) : (
            <div style={{ maxHeight: "220px", overflowY: "auto", border: `1px solid ${theme.borderGoldLight}`, borderRadius: theme.radiusSm }}>
              {clientesFiltrados.map((c) => {
                const activo = clienteSeleccionado?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", cursor: "pointer",
                      borderBottom: `1px solid ${theme.borderGoldLight}`,
                      background: activo ? theme.goldSoft : "transparent",
                    }}
                  >
                    <div>
                      <div style={{ color: activo ? theme.gold : theme.textLight, fontWeight: 600, fontSize: "0.85rem" }}>
                        {c.razon_social || "Sin razón social"}
                      </div>
                      <div style={{ color: theme.textMuted, fontSize: "0.72rem" }}>{c.email}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {c.perfil_cliente && (
                        <span style={{ fontSize: "0.68rem", color: theme.gold, background: theme.goldSoft, padding: "2px 8px", borderRadius: "10px" }}>
                          {c.perfil_cliente}
                        </span>
                      )}
                      {c.status && <Badge tone={estadoToTone(c.status)}>{c.status}</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {!clienteSeleccionado ? (
          <Card style={{ padding: "50px", textAlign: "center" }}>
            <p style={{ color: theme.textMuted, fontStyle: "italic" }}>Elegí un cliente arriba para ver su estado de cuenta.</p>
          </Card>
        ) : cargandoDetalle ? (
          <Card style={{ padding: "50px", textAlign: "center" }}>
            <p style={{ color: theme.textMuted }}>Cargando estado de cuenta...</p>
          </Card>
        ) : (
          <>
            {/* ── Ficha del cliente ── */}
            <Card style={{ marginBottom: "20px" }}>
              <Heading style={{ marginBottom: "14px" }}>{clienteSeleccionado.razon_social || "Cliente"}</Heading>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 30px", fontSize: "0.85rem" }}>
                <DataRow label="Correo" valor={clienteSeleccionado.email || "—"} />
                <DataRow label="Perfil" valor={clienteSeleccionado.perfil_cliente || "—"} />
                <DataRow label="Teléfono" valor={clienteSeleccionado.telefono_celular || clienteSeleccionado.telefono_oficina || "—"} />
                <DataRow label="País" valor={clienteSeleccionado.pais || "—"} />
                <DataRow label="Forma de Pago" valor={clienteSeleccionado.forma_pago || "—"} />
                <DataRow label="Estado" valor={<Badge tone={estadoToTone(clienteSeleccionado.status || "")}>{clienteSeleccionado.status || "—"}</Badge>} />
              </div>
            </Card>

            {/* ── KPIs del estado de cuenta ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "25px" }}>
              <Card style={{ padding: "18px", marginBottom: 0 }}>
                <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Total Cotizado</span>
                <h2 style={{ color: theme.gold, fontSize: "1.4rem", margin: "6px 0 0 0", fontWeight: 600 }}>{fmt(totalCotizado)}</h2>
                <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>{quotes.length} cotización(es)</span>
              </Card>
              <Card style={{ padding: "18px", marginBottom: 0 }}>
                <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Total Abonado (confirmado)</span>
                <h2 style={{ color: theme.green, fontSize: "1.4rem", margin: "6px 0 0 0", fontWeight: 600 }}>{fmt(totalAbonado)}</h2>
                <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>{pagos.filter((p) => p.status === "confirmado").length} pago(s) confirmado(s)</span>
              </Card>
              <Card style={{ padding: "18px", marginBottom: 0 }}>
                <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Saldo Pendiente</span>
                <h2 style={{ color: saldoPendiente > 0 ? theme.red : theme.green, fontSize: "1.4rem", margin: "6px 0 0 0", fontWeight: 600 }}>{fmt(saldoPendiente)}</h2>
                <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Cotizado menos abonado</span>
              </Card>
              {totalPendienteVerificacion > 0 && (
                <Card style={{ padding: "18px", marginBottom: 0, border: "1px dashed #e67e22" }}>
                  <span style={{ fontSize: "0.7rem", color: "#e67e22", textTransform: "uppercase" }}>Transferencias por Verificar</span>
                  <h2 style={{ color: "#e67e22", fontSize: "1.4rem", margin: "6px 0 0 0", fontWeight: 600 }}>{fmt(totalPendienteVerificacion)}</h2>
                  <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Aún no cuenta como abonado</span>
                </Card>
              )}
            </div>

            {/* ── Cotizaciones ── */}
            <Card style={{ marginBottom: "20px" }}>
              <Heading style={{ fontSize: "1rem", marginBottom: "12px" }}>Cotizaciones</Heading>
              {quotes.length === 0 ? (
                <p style={{ color: theme.textMuted, fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                  Este cliente no tiene cotizaciones registradas.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}` }}>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Referencia</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Fecha</th>
                        <th style={{ textAlign: "right", padding: "8px", color: theme.gold }}>Total</th>
                        <th style={{ textAlign: "right", padding: "8px", color: theme.gold }}>Abonado</th>
                        <th style={{ textAlign: "right", padding: "8px", color: theme.gold }}>Saldo</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q) => (
                        <tr key={q.id} style={{ borderBottom: "1px solid #141414" }}>
                          <td style={{ padding: "8px", color: theme.gold, fontWeight: 600 }}>{q.referencia || q.id}</td>
                          <td style={{ padding: "8px", color: theme.textMuted }}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: theme.textLight }}>{fmt(q.total)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: theme.green }}>{fmt(q.monto_abonado)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: Number(q.saldo_pendiente) > 0 ? theme.red : theme.textMuted }}>
                            {fmt(q.saldo_pendiente ?? Math.max(0, Number(q.total || 0) - Number(q.monto_abonado || 0)))}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <Badge tone={estadoToTone(q.estado_pago || q.status || "")}>{q.estado_pago || q.status || "—"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Movimientos de pago (libro de pagos) ── */}
            <Card>
              <Heading style={{ fontSize: "1rem", marginBottom: "12px" }}>Movimientos de Pago</Heading>
              {pagos.length === 0 ? (
                <p style={{ color: theme.textMuted, fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                  Este cliente no tiene pagos registrados en el libro (tabla <code>pagos</code>).
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}` }}>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>N° Documento</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Tipo</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Cotización</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Fecha</th>
                        <th style={{ textAlign: "right", padding: "8px", color: theme.gold }}>Monto</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Método</th>
                        <th style={{ textAlign: "left", padding: "8px", color: theme.gold }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #141414" }}>
                          <td style={{ padding: "8px", color: theme.gold, fontWeight: 700 }}>{p.numero_documento}</td>
                          <td style={{ padding: "8px", color: theme.textLight }}>{p.tipo_documento}</td>
                          <td style={{ padding: "8px", color: theme.textMuted }}>{p.quote_referencia || "—"}</td>
                          <td style={{ padding: "8px", color: theme.textMuted }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: theme.green, fontWeight: 600 }}>{fmt(p.monto)}</td>
                          <td style={{ padding: "8px", color: theme.textMuted, textTransform: "capitalize" }}>{p.metodo_pago || "—"}</td>
                          <td style={{ padding: "8px" }}>
                            <Badge tone={p.status === "confirmado" ? "success" : p.status === "anulado" ? "danger" : "gold"}>
                              {p.status || "—"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
