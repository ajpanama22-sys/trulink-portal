import { useEffect, useState } from "react";
import { useVendorAuth } from "../../lib/useVendorAuth";
import { getSupabase } from "../../lib/supabaseClient";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, PageHeader, Badge, Button, inputStyle } from "../../lib/ui";
import { useI18n } from "../../lib/i18n/LanguageContext";
import LanguageSwitcher from "../../components/LanguageSwitcher";

type RFQ = {
  id: number; titulo: string; descripcion: string | null; especificaciones_tecnicas: string | null;
  cantidad: number; unidad: string | null; fecha_limite_ofertas: string; estado: string;
  rfq_ganador_proveedor_id: string | null;
};
type Oferta = {
  id?: number; rfq_id: number; precio_unitario: number; moneda: string; incoterm: string;
  dias_credito_propuesto: number; lead_time_dias: number; notas: string;
};

const labelStyle = {
  display: "block", fontSize: "0.66rem", color: theme.textMuted,
  marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};

export default function VendorPortalLicitaciones() {
  const { t } = useI18n();
  const { cargando: cargandoAuth, autorizado, proveedor } = useVendorAuth();
  const supabase = getSupabase();

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [misOfertas, setMisOfertas] = useState<Record<number, Oferta>>({});
  const [cargando, setCargando] = useState(true);

  const [modalOferta, setModalOferta] = useState<{ open: boolean; rfq: RFQ | null }>({ open: false, rfq: null });
  const [form, setForm] = useState<Oferta>({ rfq_id: 0, precio_unitario: 0, moneda: "USD", incoterm: "FOB", dias_credito_propuesto: 0, lead_time_dias: 0, notas: "" });
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    if (!supabase || !proveedor) return;
    setCargando(true);
    const { data: invitaciones } = await supabase.from("rfq_invitados").select("rfq_id").eq("proveedor_id", proveedor.id);
    const ids = (invitaciones || []).map((i: any) => i.rfq_id);
    if (ids.length === 0) { setRfqs([]); setCargando(false); return; }

    const [rfqRes, ofertasRes] = await Promise.all([
      supabase.from("rfq_licitaciones").select("*").in("id", ids).order("fecha_limite_ofertas", { ascending: true }),
      supabase.from("rfq_ofertas").select("*").eq("proveedor_id", proveedor.id).in("rfq_id", ids),
    ]);
    setRfqs(rfqRes.data || []);
    const mapa: Record<number, Oferta> = {};
    (ofertasRes.data || []).forEach((o: any) => { mapa[o.rfq_id] = o; });
    setMisOfertas(mapa);
    setCargando(false);
  };

  useEffect(() => { if (autorizado && proveedor) cargar(); /* eslint-disable-next-line */ }, [autorizado, proveedor]);

  const abrirOferta = (rfq: RFQ) => {
    const existente = misOfertas[rfq.id];
    setForm(existente || { rfq_id: rfq.id, precio_unitario: 0, moneda: "USD", incoterm: "FOB", dias_credito_propuesto: 0, lead_time_dias: 0, notas: "" });
    setModalOferta({ open: true, rfq });
  };

  const enviarOferta = async () => {
    if (!supabase || !proveedor || !modalOferta.rfq) return;
    if (form.precio_unitario <= 0 || form.lead_time_dias <= 0) {
      return alert(t("vendorLicitaciones.errRequeridos"));
    }
    setGuardando(true);
    try {
      const existente = misOfertas[modalOferta.rfq.id];
      if (existente?.id) {
        const { error } = await supabase.from("rfq_ofertas").update({
          precio_unitario: form.precio_unitario, moneda: form.moneda, incoterm: form.incoterm,
          dias_credito_propuesto: form.dias_credito_propuesto, lead_time_dias: form.lead_time_dias, notas: form.notas,
        }).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rfq_ofertas").insert([{
          rfq_id: modalOferta.rfq.id, proveedor_id: proveedor.id,
          precio_unitario: form.precio_unitario, moneda: form.moneda, incoterm: form.incoterm,
          dias_credito_propuesto: form.dias_credito_propuesto, lead_time_dias: form.lead_time_dias, notas: form.notas,
        }]);
        if (error) throw error;
      }
      alert(t("vendorLicitaciones.successMsg"));
      setModalOferta({ open: false, rfq: null });
      cargar();
    } catch (err: any) {
      alert(t("vendorLicitaciones.errSubmit") + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const logout = async () => {
    await supabase?.auth.signOut();
    window.location.href = "/vendor-portal/login";
  };

  if (cargandoAuth) {
    return <div style={{ backgroundColor: theme.background, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: theme.gold }}>{t("vendorPortal.verifying")}</div>;
  }
  if (!autorizado || !proveedor) return null;

  return (
    <div style={{ backgroundColor: theme.background, minHeight: "100vh" }}>
      <div style={pageWrapStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <PageHeader title={t("vendorLicitaciones.title")} subtitle={t("vendorLicitaciones.subtitle")} />
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <LanguageSwitcher />
            <a href="/vendor-portal" style={{ color: theme.gold, fontSize: "0.82rem", textDecoration: "none" }}>{t("vendorLicitaciones.btnVolver")}</a>
            <Button variant="ghost" onClick={logout}>{t("common.logout")}</Button>
          </div>
        </div>

        {cargando ? (
          <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>{t("vendorLicitaciones.loading")}</p></Card>
        ) : rfqs.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>{t("vendorLicitaciones.empty")}</p></Card>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {rfqs.map((r) => {
              const vencida = new Date(r.fecha_limite_ofertas) < new Date();
              const yaOferte = !!misOfertas[r.id];
              const puedeOfertar = r.estado === "Abierta" && !vencida;
              return (
                <Card key={r.id} style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: "220px" }}>
                      <div style={{ color: theme.gold, fontWeight: 700, fontSize: "0.95rem" }}>{r.titulo}</div>
                      {r.descripcion && <div style={{ color: "#aaa", fontSize: "0.8rem", marginTop: "4px" }}>{r.descripcion}</div>}
                      {r.especificaciones_tecnicas && <div style={{ color: "#888", fontSize: "0.75rem", marginTop: "4px" }}>{t("vendorLicitaciones.specs")} {r.especificaciones_tecnicas}</div>}
                      <div style={{ color: "#888", fontSize: "0.75rem", marginTop: "6px" }}>
                        {t("vendorLicitaciones.cantidad")} {r.cantidad} {r.unidad || "und"} · {t("vendorLicitaciones.cierre")} {new Date(r.fecha_limite_ofertas).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge tone={r.estado === "Adjudicada" ? (r.rfq_ganador_proveedor_id === proveedor.id ? "success" : "neutral") : puedeOfertar ? "gold" : "neutral"}>
                        {r.estado === "Adjudicada" ? (r.rfq_ganador_proveedor_id === proveedor.id ? t("vendorLicitaciones.ganaste") : t("vendorLicitaciones.adjudicadaOtro")) : r.estado}
                      </Badge>
                      <div style={{ marginTop: "10px" }}>
                        {puedeOfertar ? (
                          <Button variant="gold" style={{ padding: "6px 14px", fontSize: "0.78rem" }} onClick={() => abrirOferta(r)}>
                            {yaOferte ? t("vendorLicitaciones.btnEditarOferta") : t("vendorLicitaciones.btnEnviarOferta")}
                          </Button>
                        ) : yaOferte ? (
                          <span style={{ color: "#888", fontSize: "0.75rem" }}>{t("vendorLicitaciones.yaOferte")}</span>
                        ) : (
                          <span style={{ color: "#888", fontSize: "0.75rem" }}>{t("vendorLicitaciones.cerrada")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {modalOferta.open && modalOferta.rfq && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.borderGoldCounter}`, borderRadius: theme.radiusLg, padding: "26px", width: "100%", maxWidth: "480px" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>{t("vendorLicitaciones.modalTitle")}{modalOferta.rfq.titulo}</h3>
            <p style={{ color: "#888", fontSize: "0.75rem", marginBottom: "16px" }}>
              {t("vendorLicitaciones.modalConfidencial")}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label style={labelStyle}>{t("vendorLicitaciones.labelPrecio")}</label>
                <input style={inputStyle} type="number" min={0} step="0.01" value={form.precio_unitario}
                  onChange={(e) => setForm({ ...form, precio_unitario: Number(e.target.value) || 0 })} /></div>
              <div><label style={labelStyle}>{t("vendorLicitaciones.labelMoneda")}</label>
                <select style={inputStyle} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  <option value="USD">USD</option><option value="EUR">EUR</option><option value="CNY">CNY</option>
                </select></div>
              <div><label style={labelStyle}>{t("vendorLicitaciones.labelIncoterm")}</label>
                <select style={inputStyle} value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })}>
                  <option value="EXW">EXW</option><option value="FOB">FOB</option><option value="CIF">CIF</option>
                  <option value="DDP">DDP</option><option value="CFR">CFR</option>
                </select></div>
              <div><label style={labelStyle}>{t("vendorLicitaciones.labelLeadTime")}</label>
                <input style={inputStyle} type="number" min={0} value={form.lead_time_dias}
                  onChange={(e) => setForm({ ...form, lead_time_dias: Number(e.target.value) || 0 })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>{t("vendorLicitaciones.labelDiasCredito")}</label>
                <input style={inputStyle} type="number" min={0} value={form.dias_credito_propuesto}
                  onChange={(e) => setForm({ ...form, dias_credito_propuesto: Number(e.target.value) || 0 })} /></div>
            </div>

            <label style={labelStyle}>{t("vendorLicitaciones.labelNotas")}</label>
            <textarea style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "18px", resize: "vertical" }} rows={3}
              value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalOferta({ open: false, rfq: null })}>{t("vendorLicitaciones.btnCancelar")}</Button>
              <Button variant="gold" disabled={guardando} onClick={enviarOferta}>{guardando ? t("vendorLicitaciones.btnEnviando") : t("vendorLicitaciones.btnEnviar")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}