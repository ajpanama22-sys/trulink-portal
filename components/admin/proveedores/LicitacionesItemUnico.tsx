import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabaseClient";
import { theme } from "../../../lib/theme";
import { Card, Button, Badge, inputStyle } from "../../../lib/ui";

type Proveedor = {
  id: string; nombre: string; email: string | null; tipo_insumo: string | null;
  estado_homologacion: string; moneda: string | null; dias_credito: number | null;
};
type RFQ = {
  id: number; titulo: string; descripcion_referencia: string | null; categoria_insumo: string;
  sku_solicitado: string | null; tabla_sku_solicitado: string | null; cantidad_solicitada: number | null;
  puerto_destino_definido: string | null; fecha_publicacion: string; fecha_cierre: string | null;
  estado: string; rfq_ganador_proveedor_id: string | null; orden_compra_id: number | null; tipo: string;
};
type Oferta = {
  id: number; rfq_id: number; proveedor_id: string; id_unico_vendor: string | null;
  sku_vendor: string | null; descripcion_item: string | null; precio_unitario: number; cantidad: number | null;
  total_producto: number | null; costo_envio_cif: number | null; total_oferta: number | null;
  puerto_origen: string | null; puerto_destino: string | null;
  fecha_salida_estimada: string | null; fecha_llegada_estimada: string | null;
  pdf_cotizacion_url: string | null; pdf_especificaciones_url: string | null;
  cambio_precio_realizado: boolean; enviada_en: string;
};
type ResultadoCatalogo = { sku: string; descripcion: string; tabla: string };

const labelStyle = {
  display: "block", fontSize: "0.66rem", color: theme.textMuted,
  marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};
const fmt = (n: any) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PUERTOS = ["Cristobal", "Balboa"];
const ESTADOS_RFQ = ["Activo", "Inactivo", "Cerrado"] as const;
const TABLAS_CATALOGO = [
  { key: "cablesdb", label: "Cables" },
  { key: "herrajesdb", label: "Herrajes" },
  { key: "accesoriosdb", label: "Accesorios" },
  { key: "catalogo_otros", label: "Otros" },
];

function generarIdUnico(ofertaId: number) {
  return "VDR-" + ofertaId.toString(36).toUpperCase().padStart(4, "0");
}

function toneEstado(estado: string): "success" | "neutral" | "danger" {
  if (estado === "Activo") return "success";
  if (estado === "Cerrado") return "danger";
  return "neutral"; // Inactivo
}

export default function LicitacionesItemUnico() {
  const supabase = getSupabase();

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descripcion_referencia: "", categoria_insumo: "", puerto_destino_definido: "",
    sku_solicitado: "", tabla_sku_solicitado: "", cantidad_solicitada: 0,
    estado: "Activo" as (typeof ESTADOS_RFQ)[number],
  });
  const [guardando, setGuardando] = useState(false);

  // Búsqueda de SKU en catálogo existente (opcional — si no aparece, se escribe libre)
  const [buscandoSku, setBuscandoSku] = useState(false);
  const [resultadosSku, setResultadosSku] = useState<ResultadoCatalogo[]>([]);

  const [rfqSel, setRfqSel] = useState<RFQ | null>(null);
  const [ofertasSel, setOfertasSel] = useState<Oferta[]>([]);
  const [urlsFirmadas, setUrlsFirmadas] = useState<Record<string, string>>({});

  const [modalMapeo, setModalMapeo] = useState<{ open: boolean; oferta: Oferta | null }>({ open: false, oferta: null });
  const [skuTrulink, setSkuTrulink] = useState("");
  const [tablaSkuTrulink, setTablaSkuTrulink] = useState("cablesdb");
  const [aprobando, setAprobando] = useState(false);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    const [rfqRes, provRes] = await Promise.all([
      supabase.from("rfq_licitaciones").select("*").eq("tipo", "item_unico").order("id", { ascending: false }),
      supabase.from("proveedores").select("id, nombre, email, tipo_insumo, estado_homologacion, moneda, dias_credito").eq("estado_homologacion", "Homologado"),
    ]);
    setRfqs(rfqRes.data || []);
    setProveedores(provRes.data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const categorias = useMemo(
    () => Array.from(new Set(proveedores.map((p) => p.tipo_insumo).filter(Boolean))) as string[],
    [proveedores]
  );

  // Busca el SKU escrito en las 3 tablas de catálogo + catalogo_otros.
  // Si aparece, se puede autocompletar la descripción; si no aparece,
  // simplemente se sigue con el texto libre (producto nuevo).
  const buscarSkuEnCatalogo = async () => {
    if (!supabase || !form.sku_solicitado.trim()) return;
    setBuscandoSku(true);
    setResultadosSku([]);
    try {
      const tablas = ["cablesdb", "herrajesdb", "accesoriosdb", "catalogo_otros"];
      const consultas = tablas.map((t) =>
        supabase.from(t).select("*").or(`SKU.ilike.%${form.sku_solicitado}%,Descripción.ilike.%${form.sku_solicitado}%`).limit(8)
      );
      const resultados = await Promise.all(consultas);
      const combinados: ResultadoCatalogo[] = [];
      resultados.forEach((r, i) => {
        (r.data || []).forEach((row: any) => {
          combinados.push({ sku: row.SKU, descripcion: row["Descripción"] || "", tabla: tablas[i] });
        });
      });
      setResultadosSku(combinados);
      if (combinados.length === 0) {
        alert("No se encontró ese SKU en el catálogo. Podés seguir escribiéndolo como producto nuevo.");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setBuscandoSku(false);
    }
  };

  const elegirResultadoCatalogo = (r: ResultadoCatalogo) => {
    setForm({ ...form, sku_solicitado: r.sku, descripcion_referencia: r.descripcion, tabla_sku_solicitado: r.tabla });
    setResultadosSku([]);
  };

  const crearRfq = async () => {
    if (!supabase) return;
    if (!form.titulo.trim() || !form.categoria_insumo.trim() || !form.sku_solicitado.trim() || form.cantidad_solicitada <= 0) {
      return alert("Completá título, categoría, SKU solicitado y cantidad.");
    }
    const invitados = proveedores.filter((p) => p.tipo_insumo === form.categoria_insumo);
    if (invitados.length === 0) return alert("No hay proveedores homologados con esa categoría.");

    setGuardando(true);
    try {
      const ahora = new Date();
      const cierre = new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000);

      const { data: rfq, error } = await supabase.from("rfq_licitaciones").insert([{
        titulo: form.titulo,
        descripcion: form.descripcion_referencia || null,
        descripcion_referencia: form.descripcion_referencia || null,
        categoria_insumo: form.categoria_insumo,
        sku_solicitado: form.sku_solicitado.trim(),
        tabla_sku_solicitado: form.tabla_sku_solicitado || null,
        cantidad_solicitada: form.cantidad_solicitada,
        cantidad: form.cantidad_solicitada, // columna heredada del flujo viejo, se mantiene en sync
        puerto_destino_definido: form.puerto_destino_definido || null,
        fecha_limite_ofertas: cierre.toISOString(),
        fecha_cierre: cierre.toISOString(),
        estado: form.estado,
        tipo: "item_unico",
      }]).select().single();
      if (error) throw error;

      const filas = invitados.map((p) => ({ rfq_id: rfq.id, proveedor_id: p.id }));
      const { error: errInv } = await supabase.from("rfq_invitados").insert(filas);
      if (errInv) throw errInv;

      alert(`RFQ creado (${form.estado}). Vence en 15 días (${cierre.toLocaleDateString()}). Se invitó a ${invitados.length} proveedor(es) de "${form.categoria_insumo}".`);
      setModalNueva(false);
      setForm({ titulo: "", descripcion_referencia: "", categoria_insumo: "", puerto_destino_definido: "", sku_solicitado: "", tabla_sku_solicitado: "", cantidad_solicitada: 0, estado: "Activo" });
      setResultadosSku([]);
      cargar();
    } catch (err: any) {
      alert("Error al crear el RFQ: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoRfq = async (rfq: RFQ, nuevoEstado: (typeof ESTADOS_RFQ)[number]) => {
    if (!supabase) return;
    if (nuevoEstado === "Cerrado" && !confirm("¿Cerrar el RFQ? Ya no se aceptarán ni editarán ofertas.")) return;
    const { error } = await supabase.from("rfq_licitaciones").update({ estado: nuevoEstado }).eq("id", rfq.id);
    if (error) return alert("Error: " + error.message);
    cargar();
    if (rfqSel?.id === rfq.id) setRfqSel({ ...rfq, estado: nuevoEstado });
  };

  const abrirOfertas = async (rfq: RFQ) => {
    if (!supabase) return;
    setRfqSel(rfq);
    const { data } = await supabase.from("rfq_ofertas").select("*").eq("rfq_id", rfq.id).order("total_oferta", { ascending: true });
    const lista = data || [];
    setOfertasSel(lista);

    const urls: Record<string, string> = {};
    for (const o of lista) {
      for (const path of [o.pdf_cotizacion_url, o.pdf_especificaciones_url]) {
        if (path) {
          const { data: signed } = await supabase.storage.from("rfq-adjuntos").createSignedUrl(path, 3600);
          if (signed?.signedUrl) urls[path] = signed.signedUrl;
        }
      }
    }
    setUrlsFirmadas(urls);
  };

  const abrirAprobacion = (oferta: Oferta) => {
    setSkuTrulink(rfqSel?.sku_solicitado || "");
    setTablaSkuTrulink(rfqSel?.tabla_sku_solicitado || "cablesdb");
    setModalMapeo({ open: true, oferta });
  };

  const aprobarOferta = async () => {
    if (!supabase || !modalMapeo.oferta || !rfqSel) return;
    if (!skuTrulink.trim()) return alert("Indicá a qué SKU de Trulink corresponde este producto.");

    const oferta = modalMapeo.oferta;
    const prov = proveedores.find((p) => p.id === oferta.proveedor_id);
    setAprobando(true);
    try {
      const numero = "OC-RFQ-" + Date.now().toString().slice(-8);
      const totalOC = Number(oferta.total_oferta || 0);

      const { data: oc, error: ocError } = await supabase.from("ordenes_compra").insert([{
        numero, proveedor_id: oferta.proveedor_id, proveedor_nombre: prov?.nombre || null,
        fecha: new Date().toISOString().slice(0, 10), estado: "Enviada",
        moneda: "USD", subtotal: oferta.total_producto || 0, impuestos: 0, total: totalOC,
        incoterm: "CIF",
        origen: "rfq",
        notas: `Adjudicada del RFQ "${rfqSel.titulo}" (RFQ-${rfqSel.id}). Puerto destino: ${oferta.puerto_destino || rfqSel.puerto_destino_definido || "N/D"}.`,
        nota_interna_sku: `SKU vendor "${oferta.sku_vendor}" → SKU Trulink "${skuTrulink}" (${tablaSkuTrulink})`,
      }]).select().single();
      if (ocError) throw ocError;

      const { error: itemError } = await supabase.from("orden_compra_items").insert([{
        orden_id: oc.id, destino: "bodega", tabla_bodega: tablaSkuTrulink, sku_bodega: skuTrulink,
        descripcion: oferta.descripcion_item || rfqSel.descripcion_referencia || rfqSel.titulo, unidad: "und",
        cantidad: oferta.cantidad || rfqSel.cantidad_solicitada || 0, cantidad_recibida: 0,
        precio_unitario: oferta.precio_unitario, total: oferta.total_producto || 0,
      }]).select().single();
      if (itemError) throw itemError;

      const { error: mapeoError } = await supabase.from("mapeo_sku_proveedor").insert([{
        proveedor_id: oferta.proveedor_id, orden_compra_id: oc.id,
        sku_vendor: oferta.sku_vendor, sku_trulink: skuTrulink, tabla_sku_trulink: tablaSkuTrulink,
      }]);
      if (mapeoError) throw mapeoError;

      const { error: rfqError } = await supabase.from("rfq_licitaciones").update({
        estado: "Cerrado", rfq_ganador_proveedor_id: oferta.proveedor_id, orden_compra_id: oc.id,
      }).eq("id", rfqSel.id);
      if (rfqError) throw rfqError;

      if (prov?.email) {
        try {
          await fetch("/api/send-email", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: prov.email,
              subject: `Orden de Compra ${numero} — Trulink Fiber`,
              htmlContent: `<div style="font-family:Arial,sans-serif;background:#080808;color:#fff;padding:24px;border-radius:8px;max-width:560px;margin:0 auto;border:1px solid rgba(218,165,32,0.3)">
                <h2 style="color:#DAA520;margin-top:0">Orden de Compra generada</h2>
                <p>Tu oferta para "${rfqSel.titulo}" fue aprobada.</p>
                <p><strong>Orden:</strong> ${numero}<br/>
                <strong>Total:</strong> ${fmt(totalOC)}<br/>
                <strong>Puerto destino:</strong> ${oferta.puerto_destino || rfqSel.puerto_destino_definido || "N/D"}</p>
                <p>Podés ver el detalle en tu portal de proveedor.</p>
              </div>`,
            }),
          });
        } catch { /* no bloquear la aprobación si falla el correo */ }
      }

      alert(`Aprobado. Se generó la orden ${numero}.`);
      setModalMapeo({ open: false, oferta: null });
      cargar();
      abrirOfertas({ ...rfqSel, estado: "Cerrado" });
    } catch (err: any) {
      alert("Error al aprobar: " + err.message);
    } finally {
      setAprobando(false);
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
          <h3 style={{ color: theme.gold, fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
            RFQ Ítem Único ({rfqs.length})
          </h3>
          <Button variant="gold" onClick={() => setModalNueva(true)}>+ Nuevo RFQ</Button>
        </div>
        <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: 0 }}>
          Vos definís SKU, descripción y cantidad a comprar. Dura 15 días corridos. El vendor puede reducir su
          precio una sola vez, solo en los primeros 7 días. <strong>Activo</strong> y <strong>Cerrado</strong> se
          ven en el portal de proveedores; <strong>Inactivo</strong> queda oculto.
        </p>
      </Card>

      {cargando ? (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>Cargando...</p></Card>
      ) : rfqs.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>No hay RFQ de ítem único todavía.</p></Card>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {rfqs.map((r) => (
            <Card key={r.id} style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ color: theme.gold, fontWeight: 700, fontSize: "0.95rem" }}>{r.titulo}</div>
                  <div style={{ color: "#888", fontSize: "0.76rem", marginTop: "4px" }}>
                    SKU: {r.sku_solicitado || "—"} · Cant: {r.cantidad_solicitada ?? "—"} · {r.categoria_insumo}
                  </div>
                  <div style={{ color: "#666", fontSize: "0.72rem", marginTop: "2px" }}>
                    cierre {r.fecha_cierre ? new Date(r.fecha_cierre).toLocaleDateString() : "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <Badge tone={toneEstado(r.estado)}>{r.estado}</Badge>
                  <select
                    style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: "0.72rem" }}
                    value={r.estado}
                    onChange={(e) => cambiarEstadoRfq(r, e.target.value as any)}
                  >
                    {ESTADOS_RFQ.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <Button variant="gold" onClick={() => abrirOfertas(r)}>Ver ofertas</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: nuevo RFQ */}
      {modalNueva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" }}>
          <Card style={{ maxWidth: "520px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Nuevo RFQ — Ítem Único</h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Título interno</label>
                <input style={inputStyle} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Reposición cable ADSS Q3" />
              </div>

              <div style={{ border: `1px dashed ${theme.borderGold}`, borderRadius: "8px", padding: "12px" }}>
                <label style={labelStyle}>SKU a comprar (buscá en catálogo o escribí uno nuevo)</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={form.sku_solicitado}
                    onChange={(e) => setForm({ ...form, sku_solicitado: e.target.value, tabla_sku_solicitado: "" })}
                    placeholder="Ej: CAB-ADSS-48-1000" />
                  <Button variant="ghost" type="button" onClick={buscarSkuEnCatalogo} disabled={buscandoSku}>
                    {buscandoSku ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
                {form.tabla_sku_solicitado && (
                  <div style={{ fontSize: "0.7rem", color: theme.green, marginTop: "6px" }}>
                    ✓ Existe en catálogo ({TABLAS_CATALOGO.find((t) => t.key === form.tabla_sku_solicitado)?.label})
                  </div>
                )}
                {!form.tabla_sku_solicitado && form.sku_solicitado && (
                  <div style={{ fontSize: "0.7rem", color: "#f1c40f", marginTop: "6px" }}>
                    Producto nuevo — no encontrado en catálogo todavía.
                  </div>
                )}
                {resultadosSku.length > 0 && (
                  <div style={{ marginTop: "8px", display: "grid", gap: "4px", maxHeight: "140px", overflowY: "auto" }}>
                    {resultadosSku.map((r, i) => (
                      <div key={i} onClick={() => elegirResultadoCatalogo(r)}
                        style={{ cursor: "pointer", padding: "6px 8px", background: theme.inputBg, borderRadius: "6px", fontSize: "0.72rem", border: `1px solid ${theme.borderGoldLight}` }}>
                        <strong style={{ color: theme.gold }}>{r.sku}</strong> — {r.descripcion} <span style={{ color: "#888" }}>({r.tabla})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Descripción (visible a los vendors invitados)</label>
                <textarea style={{ ...inputStyle, minHeight: "60px" }} value={form.descripcion_referencia} onChange={(e) => setForm({ ...form, descripcion_referencia: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Cantidad solicitada</label>
                <input type="number" style={inputStyle} value={form.cantidad_solicitada} onChange={(e) => setForm({ ...form, cantidad_solicitada: Number(e.target.value) })} />
              </div>
              <div>
                <label style={labelStyle}>Categoría de insumo (define a quién se invita)</label>
                <select style={inputStyle} value={form.categoria_insumo} onChange={(e) => setForm({ ...form, categoria_insumo: e.target.value })}>
                  <option value="">Seleccioná...</option>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Puerto destino (opcional — si no lo elegís, lo define el vendor)</label>
                <select style={inputStyle} value={form.puerto_destino_definido} onChange={(e) => setForm({ ...form, puerto_destino_definido: e.target.value })}>
                  <option value="">Lo define el vendor</option>
                  {PUERTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Estado inicial</label>
                <select style={inputStyle} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as any })}>
                  {ESTADOS_RFQ.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
                <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Inactivo = borrador, todavía no visible para los vendors.</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setModalNueva(false)}>Cancelar</Button>
              <Button variant="gold" onClick={crearRfq} disabled={guardando}>{guardando ? "Creando..." : "Crear RFQ"}</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Panel: ofertas del RFQ seleccionado */}
      {rfqSel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" }}>
          <Card style={{ maxWidth: "800px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ color: theme.gold, marginTop: 0, marginBottom: "4px" }}>{rfqSel.titulo} — Ofertas ({ofertasSel.length})</h3>
                <div style={{ color: "#888", fontSize: "0.75rem" }}>SKU: {rfqSel.sku_solicitado} · Cantidad: {rfqSel.cantidad_solicitada}</div>
              </div>
              <Button variant="ghost" onClick={() => setRfqSel(null)}>Cerrar</Button>
            </div>
            {ofertasSel.length === 0 ? (
              <p style={{ color: theme.textMuted }}>Todavía no hay ofertas.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                {ofertasSel.map((o) => {
                  const prov = proveedores.find((p) => p.id === o.proveedor_id);
                  const yaAdjudicado = rfqSel.rfq_ganador_proveedor_id === o.proveedor_id;
                  return (
                    <Card key={o.id} style={{ marginBottom: 0, border: yaAdjudicado ? `1px solid ${theme.gold}` : undefined }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <div style={{ color: theme.gold, fontWeight: 700 }}>{prov?.nombre || "Proveedor"} {yaAdjudicado && "🏆"}</div>
                          <div style={{ color: "#888", fontSize: "0.75rem" }}>{o.id_unico_vendor || generarIdUnico(o.id)} · SKU vendor: {o.sku_vendor || "—"}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: theme.goldBright, fontWeight: 700 }}>{fmt(o.total_oferta)}</div>
                          <div style={{ color: "#888", fontSize: "0.72rem" }}>
                            producto {fmt(o.total_producto)} + CIF {fmt(o.costo_envio_cif)}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: "8px", fontSize: "0.78rem", color: theme.textMuted, display: "grid", gap: "3px" }}>
                        <span>Confirmado por el vendor: {o.cantidad ?? "—"} und</span>
                        <span>Origen: {o.puerto_origen || "—"} → Destino: {o.puerto_destino || rfqSel.puerto_destino_definido || "—"}</span>
                        <span>Travesía: {o.fecha_salida_estimada || "—"} → {o.fecha_llegada_estimada || "—"}</span>
                        <span>Cambio de precio usado: {o.cambio_precio_realizado ? "Sí" : "No"}</span>
                        <span style={{ display: "flex", gap: "10px" }}>
                          {o.pdf_cotizacion_url && urlsFirmadas[o.pdf_cotizacion_url] && (
                            <a href={urlsFirmadas[o.pdf_cotizacion_url]} target="_blank" rel="noreferrer" style={{ color: theme.gold }}>Cotización PDF</a>
                          )}
                          {o.pdf_especificaciones_url && urlsFirmadas[o.pdf_especificaciones_url] && (
                            <a href={urlsFirmadas[o.pdf_especificaciones_url]} target="_blank" rel="noreferrer" style={{ color: theme.gold }}>Specs PDF</a>
                          )}
                        </span>
                      </div>
                      {rfqSel.estado === "Activo" && !rfqSel.rfq_ganador_proveedor_id && (
                        <div style={{ marginTop: "10px", textAlign: "right" }}>
                          <Button variant="gold" onClick={() => abrirAprobacion(o)}>Aprobar y generar OC</Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal: mapeo SKU al aprobar */}
      {modalMapeo.open && modalMapeo.oferta && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: "16px" }}>
          <Card style={{ maxWidth: "420px", width: "100%" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Mapeo SKU (nota interna)</h3>
            <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>
              Se precargó con el SKU solicitado en el RFQ. Ajustalo si corresponde a otro SKU del catálogo.
              El vendor nunca ve esto.
            </p>
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Tabla de catálogo</label>
                <select style={inputStyle} value={tablaSkuTrulink} onChange={(e) => setTablaSkuTrulink(e.target.value)}>
                  {TABLAS_CATALOGO.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>SKU Trulink</label>
                <input style={inputStyle} value={skuTrulink} onChange={(e) => setSkuTrulink(e.target.value)} placeholder="Ej: CAB-ADSS-48-1000" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setModalMapeo({ open: false, oferta: null })}>Cancelar</Button>
              <Button variant="gold" onClick={aprobarOferta} disabled={aprobando}>{aprobando ? "Aprobando..." : "Aprobar y generar OC"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
