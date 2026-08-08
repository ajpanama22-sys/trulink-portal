import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabaseClient";
import { theme } from "../../../lib/theme";
import { Card, Button, Badge, inputStyle } from "../../../lib/ui";

type Alerta = {
  id: number; origen: string; descripcion: string; cantidad_sugerida: number;
  categoria_insumo: string | null; estado: string; fecha_limite: string | null; created_at: string;
};
type MateriaPrima = { id: number; codigo: string; nombre: string; unidad: string; stock_actual: number; categoria: string | null };
type Umbral = { id: number; materia_prima_id: number; stock_minimo: number; categoria_insumo: string | null };

const labelStyle = {
  display: "block", fontSize: "0.66rem", color: theme.textMuted,
  marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};

export default function AlertasDemanda() {
  const supabase = getSupabase();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [umbrales, setUmbrales] = useState<Umbral[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [subtab, setSubtab] = useState<"alertas" | "umbrales">("alertas");

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({ descripcion: "", cantidad_sugerida: 0, categoria_insumo: "", fecha_limite: "" });
  const [guardando, setGuardando] = useState(false);

  const [modalUmbral, setModalUmbral] = useState(false);
  const [formUmbral, setFormUmbral] = useState({ materia_prima_id: "", stock_minimo: 0, categoria_insumo: "" });
  const [guardandoUmbral, setGuardandoUmbral] = useState(false);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    const [alertasRes, mpRes, umbralesRes] = await Promise.all([
      supabase.from("alertas_demanda").select("*").order("created_at", { ascending: false }),
      supabase.from("materia_prima").select("id, codigo, nombre, unidad, stock_actual, categoria").eq("activo", true).order("codigo"),
      supabase.from("umbrales_reposicion").select("id, materia_prima_id, stock_minimo, categoria_insumo").eq("tipo_item", "materia_prima"),
    ]);
    setAlertas(alertasRes.data || []);
    setMateriasPrimas(mpRes.data || []);
    setUmbrales(umbralesRes.data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  // Corre la función SQL sync_alertas_stock_minimo(): compara umbrales_reposicion
  // (tabla propia) contra materia_prima.stock_actual (solo LECTURA, nunca la altera).
  const sincronizarStock = async () => {
    if (!supabase) return;
    setSincronizando(true);
    const { error } = await supabase.rpc("sync_alertas_stock_minimo");
    if (error) alert("Error al sincronizar: " + error.message);
    await cargar();
    setSincronizando(false);
  };

  const crearNecesidad = async () => {
    if (!supabase) return;
    if (!form.descripcion.trim() || !form.categoria_insumo.trim()) {
      return alert("Descripción y categoría de insumo son obligatorias (la categoría debe coincidir con el 'tipo_insumo' del proveedor para que le llegue la alerta).");
    }
    setGuardando(true);
    const { error } = await supabase.from("alertas_demanda").insert([{
      origen: "necesidad_puntual", tipo_item: "materia_prima",
      descripcion: form.descripcion, cantidad_sugerida: Number(form.cantidad_sugerida) || 0,
      categoria_insumo: form.categoria_insumo, fecha_limite: form.fecha_limite || null,
      estado: "Notificada",
    }]);
    setGuardando(false);
    if (error) return alert("Error: " + error.message);
    setModalNueva(false);
    setForm({ descripcion: "", cantidad_sugerida: 0, categoria_insumo: "", fecha_limite: "" });
    cargar();
  };

  const cerrarAlerta = async (a: Alerta) => {
    if (!supabase) return;
    const { error } = await supabase.from("alertas_demanda").update({ estado: "Cerrada" }).eq("id", a.id);
    if (error) return alert("Error: " + error.message);
    cargar();
  };

  const guardarUmbral = async () => {
    if (!supabase) return;
    if (!formUmbral.materia_prima_id || !formUmbral.categoria_insumo.trim()) {
      return alert("Selecciona la materia prima y escribe la categoría de insumo (debe coincidir con el 'tipo_insumo' del proveedor).");
    }
    setGuardandoUmbral(true);
    const existente = umbrales.find((u) => u.materia_prima_id === Number(formUmbral.materia_prima_id));
    const payload = {
      tipo_item: "materia_prima",
      materia_prima_id: Number(formUmbral.materia_prima_id),
      stock_minimo: Number(formUmbral.stock_minimo) || 0,
      categoria_insumo: formUmbral.categoria_insumo,
    };
    const { error } = existente
      ? await supabase.from("umbrales_reposicion").update(payload).eq("id", existente.id)
      : await supabase.from("umbrales_reposicion").insert([payload]);
    setGuardandoUmbral(false);
    if (error) return alert("Error: " + error.message);
    setModalUmbral(false);
    setFormUmbral({ materia_prima_id: "", stock_minimo: 0, categoria_insumo: "" });
    cargar();
  };

  const eliminarUmbral = async (u: Umbral) => {
    if (!supabase) return;
    if (!confirm("¿Quitar este umbral de reposición?")) return;
    const { error } = await supabase.from("umbrales_reposicion").delete().eq("id", u.id);
    if (error) return alert("Error: " + error.message);
    cargar();
  };

  return (
    <Card>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <Button variant={subtab === "alertas" ? "gold" : "outline-gold"} onClick={() => setSubtab("alertas")}>Alertas</Button>
        <Button variant={subtab === "umbrales" ? "gold" : "outline-gold"} onClick={() => setSubtab("umbrales")}>Umbrales de Reposición</Button>
      </div>

      {subtab === "alertas" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
            <h3 style={{ color: theme.gold, fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
              Alertas de Demanda ({alertas.filter((a) => a.estado !== "Cerrada").length} abiertas)
            </h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="outline-gold" disabled={sincronizando} onClick={sincronizarStock}>
                {sincronizando ? "Sincronizando..." : "🔄 Sincronizar stock mínimo"}
              </Button>
              <Button variant="gold" onClick={() => setModalNueva(true)}>+ Necesidad puntual</Button>
            </div>
          </div>
          <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: "0 0 16px 0" }}>
            Estas alertas alimentan la "Previsión de Demanda" que ven los proveedores homologados en su Vendor Portal,
            filtradas por su categoría de insumo. Las de stock mínimo comparan tus umbrales (pestaña de al lado)
            contra el stock actual de materia prima; las puntuales se cargan manualmente.
          </p>

          {cargando ? (
            <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>Cargando...</p>
          ) : alertas.length === 0 ? (
            <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>No hay alertas registradas todavía.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    {["Descripción", "Origen", "Categoría", "Cantidad", "Fecha límite", "Estado", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px", color: theme.gold, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "1px solid rgba(218,165,32,0.25)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((a) => (
                    <tr key={a.id}>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414", color: theme.textLight }}>{a.descripcion}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414", fontSize: "0.72rem", color: "#888" }}>
                        {a.origen === "stock_minimo" ? "Stock mínimo" : "Necesidad puntual"}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>{a.categoria_insumo || "—"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414", color: theme.gold }}>{a.cantidad_sugerida}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414", fontSize: "0.76rem", color: "#aaa" }}>
                        {a.fecha_limite ? new Date(a.fecha_limite).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>
                        <Badge tone={a.estado === "Cerrada" ? "neutral" : a.estado === "Notificada" ? "gold" : "success"}>{a.estado}</Badge>
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                        {a.estado !== "Cerrada" && (
                          <Button variant="ghost" style={{ padding: "4px 9px", fontSize: "0.7rem" }} onClick={() => cerrarAlerta(a)}>Cerrar</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {subtab === "umbrales" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
            <h3 style={{ color: theme.gold, fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
              Umbrales de Reposición ({umbrales.length})
            </h3>
            <Button variant="gold" onClick={() => setModalUmbral(true)}>+ Definir umbral</Button>
          </div>
          <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: "0 0 16px 0" }}>
            Acá definís, materia prima por materia prima, a partir de qué nivel de stock querés que se dispare una
            alerta de reposición. Esto vive en una tabla propia del módulo de proveedores — no se toca ni se le
            agrega ninguna columna a tu tabla de <code>materia_prima</code>.
          </p>

          {cargando ? (
            <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>Cargando...</p>
          ) : umbrales.length === 0 ? (
            <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>No definiste umbrales todavía.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    {["Materia Prima", "Stock actual", "Umbral mínimo", "Categoría de insumo", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px", color: theme.gold, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "1px solid rgba(218,165,32,0.25)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {umbrales.map((u) => {
                    const mp = materiasPrimas.find((m) => m.id === u.materia_prima_id);
                    const bajoMinimo = mp && mp.stock_actual <= u.stock_minimo;
                    return (
                      <tr key={u.id}>
                        <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>{mp ? `${mp.codigo} — ${mp.nombre}` : "—"}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #141414", color: bajoMinimo ? "#e74c3c" : theme.textLight }}>
                          {mp?.stock_actual ?? "—"} {mp?.unidad}
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #141414", color: theme.gold }}>{u.stock_minimo}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>{u.categoria_insumo || "—"}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                          <Button variant="outline-red" style={{ padding: "4px 9px", fontSize: "0.7rem" }} onClick={() => eliminarUmbral(u)}>Quitar</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalNueva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.borderGoldCounter}`, borderRadius: theme.radiusLg, padding: "26px", width: "100%", maxWidth: "480px" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Nueva Necesidad Puntual</h3>

            <label style={labelStyle}>Descripción</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "12px" }}
              value={form.descripcion} placeholder="Ej: Bobinas de cable ADSS 96 hilos para proyecto X"
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label style={labelStyle}>Cantidad sugerida</label>
                <input style={inputStyle} type="number" min={0} value={form.cantidad_sugerida}
                  onChange={(e) => setForm({ ...form, cantidad_sugerida: Number(e.target.value) || 0 })} /></div>
              <div><label style={labelStyle}>Fecha límite</label>
                <input style={inputStyle} type="date" value={form.fecha_limite}
                  onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} /></div>
            </div>

            <label style={labelStyle}>Categoría de insumo (debe coincidir con "tipo_insumo" del proveedor)</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "18px" }}
              value={form.categoria_insumo} placeholder="Ej: Cables ADSS / OPGW"
              onChange={(e) => setForm({ ...form, categoria_insumo: e.target.value })} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalNueva(false)}>Cancelar</Button>
              <Button variant="gold" disabled={guardando} onClick={crearNecesidad}>
                {guardando ? "Guardando..." : "Publicar a proveedores"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalUmbral && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.borderGoldCounter}`, borderRadius: theme.radiusLg, padding: "26px", width: "100%", maxWidth: "460px" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Definir Umbral de Reposición</h3>

            <label style={labelStyle}>Materia prima</label>
            <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "12px" }}
              value={formUmbral.materia_prima_id}
              onChange={(e) => {
                const mp = materiasPrimas.find((m) => String(m.id) === e.target.value);
                setFormUmbral({ ...formUmbral, materia_prima_id: e.target.value, categoria_insumo: formUmbral.categoria_insumo || mp?.categoria || "" });
              }}>
              <option value="">— Selecciona —</option>
              {materiasPrimas.map((m) => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre} (stock: {m.stock_actual})</option>)}
            </select>

            <label style={labelStyle}>Stock mínimo</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "12px" }}
              type="number" min={0} value={formUmbral.stock_minimo}
              onChange={(e) => setFormUmbral({ ...formUmbral, stock_minimo: Number(e.target.value) || 0 })} />

            <label style={labelStyle}>Categoría de insumo (debe coincidir con "tipo_insumo" del proveedor)</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "18px" }}
              value={formUmbral.categoria_insumo}
              onChange={(e) => setFormUmbral({ ...formUmbral, categoria_insumo: e.target.value })} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalUmbral(false)}>Cancelar</Button>
              <Button variant="gold" disabled={guardandoUmbral} onClick={guardarUmbral}>
                {guardandoUmbral ? "Guardando..." : "Guardar umbral"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
