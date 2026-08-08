import { useEffect, useMemo, useState } from "react";
import { useVendorAuth } from "../../lib/useVendorAuth";
import { getSupabase } from "../../lib/supabaseClient";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, PageHeader, Badge, estadoToTone, Button } from "../../lib/ui";
import { useI18n } from "../../lib/i18n/LanguageContext";
import LanguageSwitcher from "../../components/LanguageSwitcher";

type OrdenCompra = {
  id: number; numero: string | null; fecha: string; fecha_estimada_entrega: string | null;
  estado: string; total: number; moneda: string | null;
};
type CuentaPorPagar = {
  id: number; numero_factura: string | null; fecha_emision: string; fecha_vencimiento: string | null;
  monto_total: number; saldo_pendiente: number; estado: string;
};
type PagoProveedor = { id: number; fecha: string; monto: number; metodo_pago: string | null; referencia: string | null };
type AlertaDemanda = {
  id: number; descripcion: string; cantidad_sugerida: number; origen: string;
  fecha_limite: string | null; estado: string; created_at: string;
};

const fmt = (n: any) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const diasVencido = (fechaVenc?: string | null): number => {
  if (!fechaVenc) return 0;
  const hoy = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const venc = new Date(fechaVenc).getTime();
  return Math.floor((hoy - venc) / 86400000);
};

export default function VendorPortalHome() {
  const { t } = useI18n();
  const { cargando: cargandoAuth, autorizado, proveedor } = useVendorAuth();
  const supabase = getSupabase();

  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [cuentas, setCuentas] = useState<CuentaPorPagar[]>([]);
  const [pagos, setPagos] = useState<PagoProveedor[]>([]);
  const [alertas, setAlertas] = useState<AlertaDemanda[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!autorizado || !proveedor || !supabase) return;
    (async () => {
      setCargando(true);
      const [ocRes, cxpRes, pagosRes, alertasRes] = await Promise.all([
        supabase.from("ordenes_compra").select("id, numero, fecha, fecha_estimada_entrega, estado, total, moneda")
          .eq("proveedor_id", proveedor.id).order("id", { ascending: false }),
        supabase.from("cuentas_por_pagar").select("id, numero_factura, fecha_emision, fecha_vencimiento, monto_total, saldo_pendiente, estado")
          .eq("proveedor_id", proveedor.id).order("fecha_vencimiento", { ascending: true }),
        supabase.from("pagos_proveedor").select("id, fecha, monto, metodo_pago, referencia")
          .eq("proveedor_id", proveedor.id).order("fecha", { ascending: false }),
        supabase.from("alertas_demanda").select("id, descripcion, cantidad_sugerida, origen, fecha_limite, estado, created_at")
          .in("estado", ["Abierta", "Notificada"]).eq("categoria_insumo", proveedor.tipo_insumo)
          .order("created_at", { ascending: false }),
      ]);
      setOrdenes(ocRes.data || []);
      setCuentas(cxpRes.data || []);
      setPagos(pagosRes.data || []);
      setAlertas(alertasRes.data || []);
      setCargando(false);
    })();
  }, [autorizado, proveedor, supabase]);

  const totalPendiente = useMemo(
    () => cuentas.filter((c) => c.estado !== "Pagada" && c.estado !== "Anulada").reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0),
    [cuentas]
  );
  const totalVencido = useMemo(
    () => cuentas.filter((c) => c.estado !== "Pagada" && c.estado !== "Anulada" && diasVencido(c.fecha_vencimiento) > 0)
      .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0),
    [cuentas]
  );
  const ordenesAbiertas = ordenes.filter((o) => o.estado !== "Recibida" && o.estado !== "Cancelada").length;

  const logout = async () => {
    await supabase?.auth.signOut();
    window.location.href = "/";
  };

  if (cargandoAuth) {
    return (
      <div style={{ backgroundColor: theme.background, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: theme.gold }}>
        {t("vendorPortal.verifying")}
      </div>
    );
  }
  if (!autorizado || !proveedor) return null;

  return (
    <div style={{ backgroundColor: theme.background, minHeight: "100vh" }}>
      <div style={pageWrapStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <PageHeader title={t("vendorPortal.title")} subtitle={`${t("vendorPortal.welcome")}${proveedor.nombre}`} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LanguageSwitcher />
            <a href="/vendor-portal/licitaciones" style={{ textDecoration: "none" }}>
              <Button variant="outline-gold">{t("vendorPortal.btnLicitaciones")}</Button>
            </a>
            <a href="/vendor-portal/rfq-item-unico" style={{ textDecoration: "none" }}>
              <Button variant="outline-gold">📦 RFQ Ítem Único</Button>
            </a>
            <Button variant="ghost" onClick={logout}>{t("common.logout")}</Button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <Card style={{ padding: "18px", marginBottom: 0 }}>
            <span style={{ fontSize: "0.66rem", color: theme.textMuted, textTransform: "uppercase" }}>{t("vendorPortal.kpiOrdenesAbiertas")}</span>
            <h2 style={{ color: theme.gold, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>{ordenesAbiertas}</h2>
          </Card>
          <Card style={{ padding: "18px", marginBottom: 0 }}>
            <span style={{ fontSize: "0.66rem", color: theme.textMuted, textTransform: "uppercase" }}>{t("vendorPortal.kpiSaldoPendiente")}</span>
            <h2 style={{ color: theme.gold, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>{fmt(totalPendiente)}</h2>
          </Card>
          <Card style={{ padding: "18px", marginBottom: 0 }}>
            <span style={{ fontSize: "0.66rem", color: theme.textMuted, textTransform: "uppercase" }}>{t("vendorPortal.kpiVencido")}</span>
            <h2 style={{ color: totalVencido > 0 ? "#e74c3c" : theme.green, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>{fmt(totalVencido)}</h2>
          </Card>
          <Card style={{ padding: "18px", marginBottom: 0 }}>
            <span style={{ fontSize: "0.66rem", color: theme.textMuted, textTransform: "uppercase" }}>{t("vendorPortal.kpiOportunidades")}</span>
            <h2 style={{ color: theme.gold, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>{alertas.length}</h2>
          </Card>
        </div>

        {cargando ? (
          <Card style={{ textAlign: "center", padding: "40px" }}><p style={{ color: theme.textMuted }}>{t("vendorPortal.loading")}</p></Card>
        ) : (
          <>
            {/* PREVISIÓN DE DEMANDA */}
            <Card style={{ marginBottom: "22px" }}>
              <h3 style={{ color: theme.gold, fontSize: "0.95rem", textTransform: "uppercase", marginTop: 0, marginBottom: "6px" }}>
                {t("vendorPortal.previsionTitle")}
              </h3>
              <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: "0 0 16px 0" }}>
                {t("vendorPortal.previsionSubtitle1")}{proveedor.tipo_insumo || "—"}{t("vendorPortal.previsionSubtitle2")}
              </p>
              {alertas.length === 0 ? (
                <p style={{ color: theme.textMuted, textAlign: "center", padding: "20px" }}>{t("vendorPortal.previsionEmpty")}</p>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {alertas.map((a) => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#050505", border: "1px solid rgba(218,165,32,0.15)", borderRadius: "8px", padding: "12px 16px" }}>
                      <div>
                        <div style={{ color: theme.textLight }}>{a.descripcion}</div>
                        <div style={{ fontSize: "0.7rem", color: "#777" }}>
                          {a.origen === "stock_minimo" ? t("vendorPortal.origenStockMinimo") : t("vendorPortal.origenPuntual")}
                          {a.fecha_limite ? ` · ${t("vendorPortal.fechaLimite")} ${new Date(a.fecha_limite).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: theme.gold, fontWeight: 700 }}>{a.cantidad_sugerida}</div>
                        <div style={{ fontSize: "0.66rem", color: "#777" }}>{t("vendorPortal.cantidadSugerida")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ÓRDENES DE COMPRA */}
            <Card style={{ marginBottom: "22px" }}>
              <h3 style={{ color: theme.gold, fontSize: "0.95rem", textTransform: "uppercase", marginTop: 0, marginBottom: "14px" }}>
                {t("vendorPortal.ordenesTitle")}
              </h3>
              {ordenes.length === 0 ? (
                <p style={{ color: theme.textMuted, textAlign: "center", padding: "20px" }}>{t("vendorPortal.ordenesEmpty")}</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr>
                        {[t("vendorPortal.colOrden"), t("vendorPortal.colFecha"), t("vendorPortal.colEntregaEst"), t("vendorPortal.colTotal"), t("vendorPortal.colEstado")].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "10px", color: theme.gold, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "1px solid rgba(218,165,32,0.25)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ordenes.map((o) => (
                        <tr key={o.id}>
                          <td style={{ padding: "10px", color: theme.gold, fontWeight: 700, borderBottom: "1px solid #141414" }}>{o.numero}</td>
                          <td style={{ padding: "10px", color: "#aaa", borderBottom: "1px solid #141414" }}>{o.fecha ? new Date(o.fecha).toLocaleDateString() : "—"}</td>
                          <td style={{ padding: "10px", color: "#aaa", borderBottom: "1px solid #141414" }}>{o.fecha_estimada_entrega ? new Date(o.fecha_estimada_entrega).toLocaleDateString() : "—"}</td>
                          <td style={{ padding: "10px", color: theme.gold, borderBottom: "1px solid #141414" }}>{fmt(o.total)}</td>
                          <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}><Badge tone={estadoToTone(o.estado)}>{o.estado}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* LIQUIDACIÓN DE PAGOS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" }}>
              <Card>
                <h4 style={{ color: theme.gold, fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "12px" }}>
                  {t("vendorPortal.facturasTitle")} ({cuentas.length})
                </h4>
                {cuentas.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem", textAlign: "center", padding: "14px" }}>{t("vendorPortal.facturasEmpty")}</p>
                ) : (
                  cuentas.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #141414", fontSize: "0.8rem" }}>
                      <div>
                        <div style={{ color: theme.gold }}>{c.numero_factura || `CXP-${c.id}`}</div>
                        <div style={{ fontSize: "0.7rem", color: "#888" }}>{c.estado}</div>
                      </div>
                      <div style={{ textAlign: "right", color: c.estado === "Pagada" ? theme.green : "#e74c3c", fontWeight: 700 }}>{fmt(c.saldo_pendiente)}</div>
                    </div>
                  ))
                )}
              </Card>
              <Card>
                <h4 style={{ color: theme.gold, fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "12px" }}>
                  {t("vendorPortal.pagosTitle")} ({pagos.length})
                </h4>
                {pagos.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem", textAlign: "center", padding: "14px" }}>{t("vendorPortal.pagosEmpty")}</p>
                ) : (
                  pagos.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #141414", fontSize: "0.8rem" }}>
                      <div>
                        <div style={{ color: "#ccc" }}>{new Date(p.fecha).toLocaleDateString()}</div>
                        <div style={{ fontSize: "0.7rem", color: "#888" }}>{p.metodo_pago} {p.referencia ? `· ${p.referencia}` : ""}</div>
                      </div>
                      <div style={{ color: theme.green, fontWeight: 700 }}>{fmt(p.monto)}</div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
