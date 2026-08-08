import { useEffect, useState } from "react";
import { useVendorAuth } from "../../lib/useVendorAuth";
import { getSupabase } from "../../lib/supabaseClient";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, PageHeader, Badge, Button, inputStyle } from "../../lib/ui";
import { useI18n } from "../../lib/i18n/LanguageContext";
import LanguageSwitcher from "../../components/LanguageSwitcher";

type RFQ = {
  id: number; titulo: string; descripcion_referencia: string | null;
  sku_solicitado: string | null; cantidad_solicitada: number | null;
  puerto_destino_definido: string | null; fecha_publicacion: string; fecha_cierre: string | null;
  estado: string; rfq_ganador_proveedor_id: string | null;
};
type Oferta = {
  id?: number; rfq_id: number; sku_vendor: string; descripcion_item: string;
  precio_unitario: number; cantidad: number; costo_envio_cif: number;
  puerto_origen: string; puerto_destino: string;
  fecha_salida_estimada: string; fecha_llegada_estimada: string;
  pdf_cotizacion_url: string | null; pdf_especificaciones_url: string | null;
  cambio_precio_realizado: boolean;
};
type OfertaBlind = {
  oferta_id: number; rfq_id: number; descripcion_referencia: string | null;
  id_unico_vendor: string; total_oferta: number;
  fecha_salida_estimada: string | null; fecha_llegada_estimada: string | null;
};

const labelStyle = {
  display: "block", fontSize: "0.66rem", color: theme.textMuted,
  marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};
const fmt = (n: any) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PUERTOS = ["Cristobal", "Balboa"];
const vacio = (rfq: RFQ): Oferta => ({
  rfq_id: rfq.id,
  sku_vendor: rfq.sku_solicitado || "",
  descripcion_item: rfq.descripcion_referencia || "",
  precio_unitario: 0,
  cantidad: Number(rfq.cantidad_solicitada || 0),
  costo_envio_cif: 0, puerto_origen: "", puerto_destino: "",
  fecha_salida_estimada: "", fecha_llegada_estimada: "",
  pdf_cotizacion_url: null, pdf_especificaciones_url: null, cambio_precio_realizado: false,
});

export default function VendorRfqItemUnico() {
  const { t } = useI18n();
  const { cargando: cargandoAuth, autorizado, proveedor } = useVendorAuth();
  const supabase = getSupabase();

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [misOfertas, setMisOfertas] = useState<Record<number, Oferta>>({});
  const [cargando, setCargando] = useState(true);

  const [modalOferta, setModalOferta] = useState<{ open: boolean; rfq: RFQ | null }>({ open: false, rfq: null });
  const [form, setForm] = useState<Oferta | null>(null);
  const [archivoCotizacion, setArchivoCotizacion] = useState<File | null>(null);
  const [archivoSpecs, setArchivoSpecs] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [modalBlind, setModalBlind] = useState<{ open: boolean; rfq: RFQ | null }>({ open: false, rfq: null });
  const [ofertasBlind, setOfertasBlind] = useState<OfertaBlind[]>([]);

  const cargar = async () => {
    if (!supabase || !proveedor) return;
    setCargando(true);
    const { data: invitaciones } = await supabase.from("rfq_invitados").select("rfq_id").eq("proveedor_id", proveedor.id);
    const ids = (invitaciones || []).map((i: any) => i.rfq_id);
    if (ids.length === 0) { setRfqs([]); setCargando(false); return; }

    // Solo Activo y Cerrado son visibles para el vendor. Inactivo (borrador) nunca se muestra.
    const [rfqRes, ofertasRes] = await Promise.all([
      supabase.from("rfq_licitaciones").select("*").eq("tipo", "item_unico")
        .in("id", ids).in("estado", ["Activo", "Cerrado"]).order("fecha_cierre", { ascending: true }),
      supabase.from("rfq_ofertas").select("*").eq("proveedor_id", proveedor.id).in("rfq_id", ids),
    ]);
    setRfqs(rfqRes.data || []);
    const mapa: Record<number, Oferta> = {};
    (ofertasRes.data || []).forEach((o: any) => { mapa[o.rfq_id] = o; });
    setMisOfertas(mapa);
    setCargando(false);
  };

  useEffect(() => { if (autorizado && proveedor) cargar(); /* eslint-disable-next-line */ }, [autorizado, proveedor]);

  const dentroVentanaCambio = (rfq: RFQ) => {
    if (!rfq.fecha_publicacion) return true;
    const limite = new Date(rfq.fecha_publicacion).getTime() + 7 * 24 * 60 * 60 * 1000;
    return Date.now() <= limite;
  };

  const abrirOferta = (rfq: RFQ) => {
    const existente = misOfertas[rfq.id];
    setForm(existente || vacio(rfq));
    setArchivoCotizacion(null);
    setArchivoSpecs(null);
    setModalOferta({ open: true, rfq });
  };

  const subirPdf = async (archivo: File, tipo: "cotizacion" | "especificaciones", rfqId: number) => {
    if (!supabase || !proveedor) return null;
    const path = `${rfqId}/${proveedor.id}/${tipo}.pdf`;
    const { error } = await supabase.storage.from("rfq-adjuntos").upload(path, archivo, { upsert: true, contentType: "application/pdf" });
    if (error) throw error;
    return path;
  };

  const enviarOferta = async () => {
    if (!supabase || !proveedor || !modalOferta.rfq || !form) return;
    const rfq = modalOferta.rfq;
    const existente = misOfertas[rfq.id];

    if (!form.sku_vendor.trim() || !form.descripcion_item.trim() || form.precio_unitario <= 0 || form.cantidad <= 0) {
      return alert("SKU, descripción, precio unitario y cantidad son obligatorios — deben coincidir con tu cotización en PDF.");
    }
    if (rfq.cantidad_solicitada && form.cantidad !== Number(rfq.cantidad_solicitada)) {
      const seguir = confirm(
        `Trulink solicitó ${rfq.cantidad_solicitada} unidades y estás confirmando ${form.cantidad}. ` +
        `¿Es correcto según tu cotización en PDF?`
      );
      if (!seguir) return;
    }
    if (!form.puerto_origen.trim() || !form.puerto_destino) return alert("Indicá puerto de origen y destino.");
    if (!form.fecha_salida_estimada || !form.fecha_llegada_estimada) return alert("Indicá el rango de días de travesía.");

    if (existente && form.precio_unitario !== existente.precio_unitario) {
      if (existente.cambio_precio_realizado) return alert("Ya usaste tu único cambio de precio permitido para esta oferta.");
      if (form.precio_unitario >= existente.precio_unitario) return alert("El cambio de precio solo puede ser una reducción.");
      if (!dentroVentanaCambio(rfq)) return alert("La ventana para cambiar el precio (primeros 7 días del RFQ) ya cerró.");
    }
    if (!existente && (!archivoCotizacion || !archivoSpecs)) {
      return alert("Adjuntá la cotización y las especificaciones técnicas en PDF — los datos de arriba deben coincidir con ese PDF.");
    }

    setGuardando(true);
    try {
      let pdfCotizacionUrl = form.pdf_cotizacion_url;
      let pdfSpecsUrl = form.pdf_especificaciones_url;
      if (archivoCotizacion) pdfCotizacionUrl = await subirPdf(archivoCotizacion, "cotizacion", rfq.id);
      if (archivoSpecs) pdfSpecsUrl = await subirPdf(archivoSpecs, "especificaciones", rfq.id);

      const totalProducto = form.precio_unitario * form.cantidad;
      const payload = {
        sku_vendor: form.sku_vendor, descripcion_item: form.descripcion_item,
        precio_unitario: form.precio_unitario, cantidad: form.cantidad,
        total_producto: totalProducto, costo_envio_cif: form.costo_envio_cif,
        puerto_origen: form.puerto_origen, puerto_destino: form.puerto_destino,
        fecha_salida_estimada: form.fecha_salida_estimada, fecha_llegada_estimada: form.fecha_llegada_estimada,
        pdf_cotizacion_url: pdfCotizacionUrl, pdf_especificaciones_url: pdfSpecsUrl,
      };

      if (existente?.id) {
        const { error } = await supabase.from("rfq_ofertas").update(payload).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { data: nueva, error } = await supabase.from("rfq_ofertas").insert([{
          rfq_id: rfq.id, proveedor_id: proveedor.id, moneda: "USD", ...payload,
        }]).select().single();
        if (error) throw error;
        await supabase.from("rfq_ofertas").update({
          id_unico_vendor: "VDR-" + nueva.id.toString(36).toUpperCase().padStart(4, "0"),
        }).eq("id", nueva.id);
      }

      alert("Oferta enviada correctamente.");
      setModalOferta({ open: false, rfq: null });
      cargar();
    } catch (err: any) {
      alert("Error al enviar la oferta: " + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const verOfertasBlind = async (rfq: RFQ) => {
    if (!supabase) return;
    const { data } = await supabase.from("vw_ofertas_blind").select("*").eq("rfq_id", rfq.id).order("total_oferta", { ascending: true });
    setOfertasBlind(data || []);
    setModalBlind({ open: true, rfq });
  };

  if (cargandoAuth) return <p style={{ color: theme.gold, padding: "40px" }}>Verificando acceso...</p>;
  if (!autorizado) return null;

  return (
    <div style={pageWrapStyle()}>
      <PageHeader title="RFQ Ítem Único" subtitle="Ofertas por producto individual. Un ítem, una oferta, blind entre proveedores." />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <LanguageSwitcher />
      </div>

      {cargando ? (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>Cargando...</p></Card>
      ) : rfqs.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>No tenés RFQ de ítem único abiertos.</p></Card>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {rfqs.map((r) => {
            const miOferta = misOfertas[r.id];
            const cerrado = r.estado === "Cerrado";
            const gane = r.rfq_ganador_proveedor_id === proveedor?.id;
            return (
              <Card key={r.id} style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ color: theme.gold, fontWeight: 700 }}>{r.titulo}</div>
                    <div style={{ color: "#888", fontSize: "0.78rem", marginTop: "4px" }}>{r.descripcion_referencia}</div>
                    <div style={{ color: "#888", fontSize: "0.74rem", marginTop: "6px" }}>
                      <strong>SKU solicitado:</strong> {r.sku_solicitado || "—"} · <strong>Cantidad pedida:</strong> {r.cantidad_solicitada ?? "—"}
                    </div>
                    <div style={{ color: "#888", fontSize: "0.72rem", marginTop: "4px" }}>
                      Cierre: {r.fecha_cierre ? new Date(r.fecha_cierre).toLocaleDateString() : "—"}
                      {" · "}Puerto destino: {r.puerto_destino_definido || "lo elegís vos"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    {cerrado && gane && <Badge tone="success">¡Ganaste!</Badge>}
                    {cerrado && !gane && <Badge tone="neutral">Cerrada</Badge>}
                    <Button variant="ghost" onClick={() => verOfertasBlind(r)}>Ver ofertas del RFQ</Button>
                    {!cerrado && (
                      <Button variant="gold" onClick={() => abrirOferta(r)}>
                        {miOferta ? "Editar mi oferta" : "Enviar oferta"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: formulario de oferta */}
      {modalOferta.open && modalOferta.rfq && form && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" }}>
          <Card style={{ maxWidth: "520px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Tu oferta — {modalOferta.rfq.titulo}</h3>

            <div style={{ background: theme.inputBg, border: `1px solid ${theme.borderGoldLight}`, borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
              <div style={{ fontSize: "0.68rem", color: theme.textMuted, textTransform: "uppercase" }}>Trulink está pidiendo</div>
              <div style={{ color: theme.gold, fontWeight: 700, marginTop: "4px" }}>{modalOferta.rfq.sku_solicitado}</div>
              <div style={{ color: "#ccc", fontSize: "0.8rem", marginTop: "2px" }}>{modalOferta.rfq.descripcion_referencia}</div>
              <div style={{ color: "#888", fontSize: "0.76rem", marginTop: "4px" }}>Cantidad pedida: {modalOferta.rfq.cantidad_solicitada}</div>
            </div>

            <p style={{ color: theme.textMuted, fontSize: "0.76rem" }}>
              Adjuntá tu cotización en PDF y confirmá abajo los mismos datos que aparecen en ese PDF: SKU, descripción,
              cantidad y precio. Podés reducir el precio una sola vez, dentro de los primeros 7 días del RFQ. El costo
              de envío CIF debe incluir todos los gastos hasta el puerto destino.
            </p>
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={labelStyle}>SKU del producto (tal como aparece en tu PDF)</label>
                <input style={inputStyle} value={form.sku_vendor} onChange={(e) => setForm({ ...form, sku_vendor: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Descripción (tal como aparece en tu PDF)</label>
                <textarea style={{ ...inputStyle, minHeight: "60px" }} value={form.descripcion_item} onChange={(e) => setForm({ ...form, descripcion_item: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Precio unitario (USD)</label>
                  <input type="number" style={inputStyle} value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={labelStyle}>Cantidad (confirmá según tu PDF)</label>
                  <input type="number" style={inputStyle} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) })} />
                  {modalOferta.rfq.cantidad_solicitada != null && form.cantidad !== Number(modalOferta.rfq.cantidad_solicitada) && (
                    <span style={{ fontSize: "0.68rem", color: "#f1c40f" }}>Distinto a lo pedido ({modalOferta.rfq.cantidad_solicitada})</span>
                  )}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Costo de envío CIF al puerto destino (incluye todos los gastos hasta destino)</label>
                <input type="number" style={inputStyle} value={form.costo_envio_cif} onChange={(e) => setForm({ ...form, costo_envio_cif: Number(e.target.value) })} />
              </div>
              <div style={{ color: theme.goldBright, fontSize: "0.85rem", fontWeight: 700 }}>
                Total de la oferta: {fmt(form.precio_unitario * form.cantidad + form.costo_envio_cif)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Puerto origen</label>
                  <input style={inputStyle} value={form.puerto_origen} onChange={(e) => setForm({ ...form, puerto_origen: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Puerto destino</label>
                  <select style={inputStyle} value={form.puerto_destino} disabled={!!modalOferta.rfq.puerto_destino_definido}
                    onChange={(e) => setForm({ ...form, puerto_destino: e.target.value })}>
                    <option value="">Seleccioná...</option>
                    {PUERTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {modalOferta.rfq.puerto_destino_definido && (
                    <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Definido por Trulink: {modalOferta.rfq.puerto_destino_definido}</span>
                  )}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Días de travesía estimados</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Salida</span>
                    <input type="date" style={inputStyle} value={form.fecha_salida_estimada} onChange={(e) => setForm({ ...form, fecha_salida_estimada: e.target.value })} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Llegada</span>
                    <input type="date" style={inputStyle} value={form.fecha_llegada_estimada} onChange={(e) => setForm({ ...form, fecha_llegada_estimada: e.target.value })} />
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Cotización (PDF) — los datos de arriba deben coincidir con este archivo</label>
                <input type="file" accept="application/pdf" onChange={(e) => setArchivoCotizacion(e.target.files?.[0] || null)} />
                {form.pdf_cotizacion_url && !archivoCotizacion && <span style={{ fontSize: "0.7rem", color: theme.textMuted }}> Ya adjuntada — subí un archivo para reemplazarla.</span>}
              </div>
              <div>
                <label style={labelStyle}>Especificaciones técnicas (PDF)</label>
                <input type="file" accept="application/pdf" onChange={(e) => setArchivoSpecs(e.target.files?.[0] || null)} />
                {form.pdf_especificaciones_url && !archivoSpecs && <span style={{ fontSize: "0.7rem", color: theme.textMuted }}> Ya adjuntada — subí un archivo para reemplazarla.</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setModalOferta({ open: false, rfq: null })}>Cancelar</Button>
              <Button variant="gold" onClick={enviarOferta} disabled={guardando}>{guardando ? "Enviando..." : "Enviar oferta"}</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: lista blind de ofertas del RFQ */}
      {modalBlind.open && modalBlind.rfq && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" }}>
          <Card style={{ maxWidth: "480px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: theme.gold, marginTop: 0 }}>Ofertas — {modalBlind.rfq.titulo}</h3>
              <Button variant="ghost" onClick={() => setModalBlind({ open: false, rfq: null })}>Cerrar</Button>
            </div>
            <p style={{ color: theme.textMuted, fontSize: "0.72rem" }}>Solo se muestra ID único, total y días de entrega — nunca la identidad de otros proveedores.</p>
            {ofertasBlind.length === 0 ? (
              <p style={{ color: theme.textMuted }}>Todavía no hay ofertas.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {ofertasBlind.map((o) => (
                  <div key={o.oferta_id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: theme.inputBg, borderRadius: "8px", border: `1px solid ${theme.borderGoldLight}` }}>
                    <div>
                      <div style={{ color: theme.gold, fontWeight: 700, fontSize: "0.85rem" }}>{o.id_unico_vendor}</div>
                      <div style={{ color: "#888", fontSize: "0.72rem" }}>
                        {o.fecha_salida_estimada || "—"} → {o.fecha_llegada_estimada || "—"}
                      </div>
                    </div>
                    <div style={{ color: theme.goldBright, fontWeight: 700 }}>{fmt(o.total_oferta)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
