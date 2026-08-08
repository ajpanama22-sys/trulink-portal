import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabaseClient";
import { theme } from "../../../lib/theme";
import { Card, Button, Badge, inputStyle } from "../../../lib/ui";

type Proveedor = { id: string; nombre: string; tipo_insumo: string | null; calificacion: number | null; estado_homologacion: string; moneda: string | null; dias_credito: number | null };
type MateriaPrima = { id: number; codigo: string; nombre: string; unidad: string };
type RFQ = {
  id: number; titulo: string; descripcion: string | null; categoria_insumo: string;
  materia_prima_id: number | null; unidad: string | null; cantidad: number;
  especificaciones_tecnicas: string | null; fecha_limite_ofertas: string;
  peso_precio: number; peso_calidad: number; peso_lead_time: number;
  estado: string; rfq_ganador_proveedor_id: string | null; orden_compra_id: number | null;
};
type Oferta = {
  id: number; rfq_id: number; proveedor_id: string; precio_unitario: number; moneda: string;
  incoterm: string | null; dias_credito_propuesto: number | null; lead_time_dias: number; notas: string | null;
};

const labelStyle = {
  display: "block", fontSize: "0.66rem", color: theme.textMuted,
  marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};
const fmt = (n: any) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Licitaciones() {
  const supabase = getSupabase();

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descripcion: "", categoria_insumo: "", materia_prima_id: "", unidad: "",
    cantidad: 0, especificaciones_tecnicas: "", fecha_limite_ofertas: "",
    peso_precio: 50, peso_calidad: 30, peso_lead_time: 20,
  });
  const [guardando, setGuardando] = useState(false);

  const [rfqSel, setRfqSel] = useState<RFQ | null>(null);
  const [ofertasSel, setOfertasSel] = useState<Oferta[]>([]);
  const [invitadosSel, setInvitadosSel] = useState<string[]>([]);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    const [rfqRes, provRes, mpRes] = await Promise.all([
      supabase.from("rfq_licitaciones").select("*").order("id", { ascending: false }),
      supabase.from("proveedores").select("id, nombre, tipo_insumo, calificacion, estado_homologacion, moneda, dias_credito").eq("estado_homologacion", "Homologado"),
      supabase.from("materia_prima").select("id, codigo, nombre, unidad").eq("activo", true),
    ]);
    setRfqs(rfqRes.data || []);
    setProveedores(provRes.data || []);
    setMateriasPrimas(mpRes.data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const proveedoresElegibles = useMemo(
    () => proveedores.filter((p) => p.tipo_insumo === form.categoria_insumo),
    [proveedores, form.categoria_insumo]
  );

  const crearRfq = async () => {
    if (!supabase) return;
    if (!form.titulo.trim() || !form.categoria_insumo.trim() || !form.fecha_limite_ofertas || form.cantidad <= 0) {
      return alert("Completa título, categoría, cantidad y fecha límite de ofertas.");
    }
    const invitados = proveedores.filter((p) => p.tipo_insumo === form.categoria_insumo);
    if (invitados.length === 0) {
      return alert("No hay proveedores homologados con esa categoría de insumo. No se puede invitar a nadie.");
    }
    setGuardando(true);
    try {
      const { data: rfq, error } = await supabase.from("rfq_licitaciones").insert([{
        titulo: form.titulo, descripcion: form.descripcion || null,
        categoria_insumo: form.categoria_insumo,
        materia_prima_id: form.materia_prima_id ? Number(form.materia_prima_id) : null,
        unidad: form.unidad || null, cantidad: form.cantidad,
        especificaciones_tecnicas: form.especificaciones_tecnicas || null,
        fecha_limite_ofertas: form.fecha_limite_ofertas,
        peso_precio: form.peso_precio, peso_calidad: form.peso_calidad, peso_lead_time: form.peso_lead_time,
        estado: "Abierta",
      }]).select().single();
      if (error) throw error;

      const filas = invitados.map((p) => ({ rfq_id: rfq.id, proveedor_id: p.id }));
      const { error: errInv } = await supabase.from("rfq_invitados").insert(filas);
      if (errInv) throw errInv;

      alert(`Licitación creada. Se invitó a ${invitados.length} proveedor(es) homologado(s) de "${form.categoria_insumo}".`);
      setModalNueva(false);
      setForm({ titulo: "", descripcion: "", categoria_insumo: "", materia_prima_id: "", unidad: "", cantidad: 0, especificaciones_tecnicas: "", fecha_limite_ofertas: "", peso_precio: 50, peso_calidad: 30, peso_lead_time: 20 });
      cargar();
    } catch (err: any) {
      alert("Error al crear la licitación: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEvaluacion = async (rfq: RFQ) => {
    if (!supabase) return;
    setRfqSel(rfq);
    const [ofertasRes, invRes] = await Promise.all([
      supabase.from("rfq_ofertas").select("*").eq("rfq_id", rfq.id),
      supabase.from("rfq_invitados").select("proveedor_id").eq("rfq_id", rfq.id),
    ]);
    setOfertasSel(ofertasRes.data || []);
    setInvitadosSel((invRes.data || []).map((i: any) => i.proveedor_id));
  };

  const cerrarLicitacion = async (rfq: RFQ) => {
    if (!supabase) return;
    if (!confirm("¿Cerrar la licitación? Ya no se aceptarán más ofertas.")) return;
    const { error } = await supabase.from("rfq_licitaciones").update({ estado: "Cerrada" }).eq("id", rfq.id);
    if (error) return alert("Error: " + error.message);
    cargar();
    if (rfqSel?.id === rfq.id) abrirEvaluacion({ ...rfq, estado: "Cerrada" });
  };

  // Score: precio más bajo gana en esa componente, calificación 0-10, lead time más corto gana.
  const ranking = useMemo(() => {
    if (!rfqSel || ofertasSel.length === 0) return [];
    const minPrecio = Math.min(...ofertasSel.map((o) => o.precio_unitario));
    const minLead = Math.min(...ofertasSel.map((o) => o.lead_time_dias));
    return ofertasSel
      .map((o) => {
        const prov = proveedores.find((p) => p.id === o.proveedor_id);
        const scorePrecio = minPrecio > 0 ? (minPrecio / o.precio_unitario) * rfqSel.peso_precio : 0;
        const scoreCalidad = ((prov?.calificacion || 0) / 10) * rfqSel.peso_calidad;
        const scoreLead = o.lead_time_dias > 0 ? (minLead / o.lead_time_dias) * rfqSel.peso_lead_time : 0;
        const total = scorePrecio + scoreCalidad + scoreLead;
        return { oferta: o, proveedor: prov, score: Math.round(total * 10) / 10 };
      })
      .sort((a, b) => b.score - a.score);
  }, [rfqSel, ofertasSel, proveedores]);

  const adjudicar = async (item: { oferta: Oferta; proveedor?: Proveedor }) => {
    if (!supabase || !rfqSel) return;
    if (!confirm(`¿Adjudicar a ${item.proveedor?.nombre}? Esto crea la orden de compra automáticamente.`)) return;

    try {
      const total = item.oferta.precio_unitario * rfqSel.cantidad;
      const numero = "OC-RFQ-" + Date.now().toString().slice(-8);

      const { data: oc, error: ocError } = await supabase.from("ordenes_compra").insert([{
        numero, proveedor_id: item.oferta.proveedor_id, proveedor_nombre: item.proveedor?.nombre || null,
        fecha: new Date().toISOString().slice(0, 10), estado: "Enviada",
        moneda: item.oferta.moneda, subtotal: total, impuestos: 0, total,
        incoterm: item.oferta.incoterm || null,
        notas: `Adjudicada de la licitación "${rfqSel.titulo}" (RFQ-${rfqSel.id}).`,
      }]).select().single();
      if (ocError) throw ocError;

      if (rfqSel.materia_prima_id) {
        const mp = materiasPrimas.find((m) => m.id === rfqSel.materia_prima_id);
        const { error: itemError } = await supabase.from("orden_compra_items").insert([{
          orden_id: oc.id, destino: "materia_prima", materia_prima_id: rfqSel.materia_prima_id,
          tabla_bodega: null, sku_bodega: null,
          descripcion: mp ? `${mp.codigo} — ${mp.nombre}` : rfqSel.titulo,
          unidad: rfqSel.unidad || mp?.unidad || "und", cantidad: rfqSel.cantidad, cantidad_recibida: 0,
          precio_unitario: item.oferta.precio_unitario, total,
        }]);
        if (itemError) throw itemError;
      }

      const { error: rfqError } = await supabase.from("rfq_licitaciones").update({
        estado: "Adjudicada", rfq_ganador_proveedor_id: item.oferta.proveedor_id, orden_compra_id: oc.id,
      }).eq("id", rfqSel.id);
      if (rfqError) throw rfqError;

      alert(`Adjudicado. Se creó la orden ${numero}. Recordá ir a la pestaña "Órdenes de Compra" para recibirla cuando llegue la mercancía.`);
      setRfqSel(null);
      cargar();
    } catch (err: any) {
      alert("Error al adjudicar: " + err.message);
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
          <h3 style={{ color: theme.gold, fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
            Licitaciones Privadas ({rfqs.length})
          </h3>
          <Button variant="gold" onClick={() => setModalNueva(true)}>+ Nueva Licitación</Button>
        </div>
        <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: 0 }}>
          Se invita automáticamente a todos los proveedores <strong>homologados</strong> de la categoría elegida.
          Las ofertas quedan ocultas entre proveedores y para el admin hasta el cierre (blind bidding).
        </p>
      </Card>

      {cargando ? (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>Cargando...</p></Card>
      ) : rfqs.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: theme.textMuted }}>No hay licitaciones todavía.</p></Card>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {rfqs.map((r) => {
            const vencida = new Date(r.fecha_limite_ofertas) < new Date();
            return (
              <Card key={r.id} style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ color: theme.gold, fontWeight: 700, fontSize: "0.95rem" }}>{r.titulo}</div>
                    <div style={{ color: "#888", fontSize: "0.76rem", marginTop: "4px" }}>
                      {r.categoria_insumo} · {r.cantidad} {r.unidad || "und"} · cierre {new Date(r.fecha_limite_ofertas).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Badge tone={r.estado === "Adjudicada" ? "success" : r.estado === "Cancelada" ? "danger" : vencida ? "gold" : "success"}>
                      {r.estado === "Abierta" && vencida ? "Vencida (pendiente cerrar)" : r.estado}
                    </Badge>
                    {r.estado === "Abierta" && (
                      <Button variant="outline-red" style={{ padding: "5px 10px", fontSize: "0.7rem" }} onClick={() => cerrarLicitacion(r)}>Cerrar</Button>
                    )}
                    {(r.estado === "Cerrada" || r.estado === "Adjudicada") && (
                      <Button variant="outline-gold" style={{ padding: "5px 10px", fontSize: "0.7rem" }} onClick={() => abrirEvaluacion(r)}>
                        {r.estado === "Adjudicada" ? "Ver detalle" : "Evaluar ofertas"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: nueva licitación */}
      {modalNueva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.borderGoldCounter}`, borderRadius: theme.radiusLg, padding: "26px", width: "100%", maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Nueva Licitación Privada</h3>

            <label style={labelStyle}>Título</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "12px" }}
              value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />

            <label style={labelStyle}>Descripción / especificaciones técnicas</label>
            <textarea style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "12px", resize: "vertical" }} rows={3}
              value={form.especificaciones_tecnicas} onChange={(e) => setForm({ ...form, especificaciones_tecnicas: e.target.value })} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label style={labelStyle}>Categoría de insumo (invita a homologados de esta categoría)</label>
                <input style={inputStyle} value={form.categoria_insumo} placeholder="Ej: Cables ADSS / OPGW"
                  onChange={(e) => setForm({ ...form, categoria_insumo: e.target.value })} />
                {form.categoria_insumo && (
                  <p style={{ fontSize: "0.7rem", color: proveedoresElegibles.length ? theme.green : "#e74c3c", margin: "6px 0 0 0" }}>
                    {proveedoresElegibles.length} proveedor(es) homologado(s) elegibles.
                  </p>
                )}
              </div>
              <div><label style={labelStyle}>Materia prima (opcional, para vincular al inventario)</label>
                <select style={inputStyle} value={form.materia_prima_id} onChange={(e) => setForm({ ...form, materia_prima_id: e.target.value })}>
                  <option value="">— Ninguna / genérico —</option>
                  {materiasPrimas.map((m) => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>)}
                </select></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label style={labelStyle}>Cantidad</label>
                <input style={inputStyle} type="number" min={0} value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) || 0 })} /></div>
              <div><label style={labelStyle}>Unidad</label>
                <input style={inputStyle} value={form.unidad} placeholder="m, und, kg..."
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })} /></div>
              <div><label style={labelStyle}>Cierre de ofertas</label>
                <input style={inputStyle} type="datetime-local" value={form.fecha_limite_ofertas}
                  onChange={(e) => setForm({ ...form, fecha_limite_ofertas: e.target.value })} /></div>
            </div>

            <div style={{ background: "#050505", border: `1px dashed ${theme.borderGold}`, borderRadius: "8px", padding: "14px", marginBottom: "18px" }}>
              <p style={{ fontSize: "0.7rem", color: theme.gold, margin: "0 0 10px 0", textTransform: "uppercase" }}>
                Ponderación del score (debe sumar 100)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div><label style={labelStyle}>Precio %</label>
                  <input style={inputStyle} type="number" min={0} max={100} value={form.peso_precio}
                    onChange={(e) => setForm({ ...form, peso_precio: Number(e.target.value) || 0 })} /></div>
                <div><label style={labelStyle}>Calidad %</label>
                  <input style={inputStyle} type="number" min={0} max={100} value={form.peso_calidad}
                    onChange={(e) => setForm({ ...form, peso_calidad: Number(e.target.value) || 0 })} /></div>
                <div><label style={labelStyle}>Lead time %</label>
                  <input style={inputStyle} type="number" min={0} max={100} value={form.peso_lead_time}
                    onChange={(e) => setForm({ ...form, peso_lead_time: Number(e.target.value) || 0 })} /></div>
              </div>
              <p style={{ fontSize: "0.68rem", color: "#777", margin: "8px 0 0 0" }}>
                Calidad usa la "calificación" (0-10) que le pusiste al proveedor en su ficha.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalNueva(false)}>Cancelar</Button>
              <Button variant="gold" disabled={guardando} onClick={crearRfq}>{guardando ? "Creando..." : "Crear y notificar"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: evaluación y adjudicación */}
      {rfqSel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.borderGoldCounter}`, borderRadius: theme.radiusLg, padding: "26px", width: "100%", maxWidth: "760px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>{rfqSel.titulo}</h3>
            <p style={{ color: "#888", fontSize: "0.78rem", marginBottom: "16px" }}>
              {invitadosSel.length} invitado(s) · {ofertasSel.length} oferta(s) recibida(s) · cierre {new Date(rfqSel.fecha_limite_ofertas).toLocaleString()}
            </p>

            {ofertasSel.length === 0 ? (
              <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>Todavía no llegaron ofertas.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      {["#", "Proveedor", "Precio unit.", "Incoterm", "Crédito", "Lead time", "Score", ""].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "9px", color: theme.gold, fontSize: "0.66rem", textTransform: "uppercase", borderBottom: "1px solid rgba(218,165,32,0.25)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((item, idx) => (
                      <tr key={item.oferta.id} style={idx === 0 ? { background: "rgba(46,204,113,0.06)" } : {}}>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414", color: idx === 0 ? theme.green : "#888" }}>{idx === 0 ? "🏆" : idx + 1}</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414", color: theme.gold, fontWeight: 600 }}>{item.proveedor?.nombre || "—"}</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414" }}>{fmt(item.oferta.precio_unitario)} {item.oferta.moneda}</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414" }}>{item.oferta.incoterm || "—"}</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414" }}>{item.oferta.dias_credito_propuesto || 0} días</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414" }}>{item.oferta.lead_time_dias} días</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414", color: theme.gold, fontWeight: 700 }}>{item.score}</td>
                        <td style={{ padding: "9px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                          {rfqSel.estado === "Cerrada" && (
                            <Button variant="gold" style={{ padding: "5px 10px", fontSize: "0.7rem" }} onClick={() => adjudicar(item)}>Adjudicar</Button>
                          )}
                          {rfqSel.estado === "Adjudicada" && rfqSel.rfq_ganador_proveedor_id === item.oferta.proveedor_id && (
                            <span style={{ color: theme.green, fontSize: "0.72rem" }}>✓ Ganador</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
              <Button variant="ghost" onClick={() => setRfqSel(null)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
