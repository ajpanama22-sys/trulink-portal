import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import { theme } from "../../lib/theme";
import { Card, Heading, Button, Badge, inputStyle } from "../../lib/ui";

/* ============================================================
   MATERIA PRIMA — TRULINK FIBER LLC
   ------------------------------------------------------------
   Reescrito contra la base de datos. La versión anterior tenía
   el inventario escrito a mano dentro del código, así que cada
   compra y cada ajuste desaparecía al recargar la página.

   Ahora lee de materia_prima y de materia_prima_bom, y todo
   movimiento queda registrado en movimientos_inventario.

   El stock sube con las recepciones de compra (módulo
   Proveedores) y baja al cerrar producción (módulo Manufactura).
   Este módulo solo ajusta y da de alta insumos.
   ============================================================ */

type Insumo = {
  id: number;
  codigo: string;
  nombre: string;
  especificacion: string | null;
  categoria: string | null;
  unidad: string;
  stock_actual: number;
  stock_minimo: number | null;
  costo_promedio: number | null;
  activo: boolean;
};

type Bom = { materia_prima_id: number; tipo_cable: string };

type Movimiento = {
  id: number;
  tipo: string;
  origen: string;
  descripcion: string | null;
  cantidad_anterior: number | null;
  cantidad: number;
  cantidad_nueva: number | null;
  unidad: string | null;
  motivo: string | null;
  autor: string | null;
  created_at: string;
};

const TIPOS_CABLE = ["FTTH", "ASU", "ADSS"] as const;

const CATEGORIAS = [
  "Fibras Ópticas",
  "Refuerzos Dieléctricos",
  "Resinas de Extrusión",
  "Compuestos Hidrófugos",
  "Elementos Auxiliares",
  "Elementos de Soporte",
];

const num = (n: any, dec = 2) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: dec });

export default function MateriaPrima() {
  const supabase = getSupabase();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [bom, setBom] = useState<Bom[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);

  const [filtroCable, setFiltroCable] = useState<"TODOS" | "FTTH" | "ASU" | "ADSS">("TODOS");
  const [buscar, setBuscar] = useState("");

  // --- Modal: nuevo insumo ---
  const [modalNuevo, setModalNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState<any>({
    codigo: "", nombre: "", especificacion: "", categoria: CATEGORIAS[0],
    unidad: "kg", stock_actual: 0, stock_minimo: 0, cables: ["FTTH"],
  });

  // --- Modal: ajuste ---
  const [modalAjuste, setModalAjuste] = useState<{ open: boolean; insumo: Insumo | null }>({ open: false, insumo: null });
  const [formAjuste, setFormAjuste] = useState({ cantidad: 0, motivo: "", autor: "" });

  // --- Modal: bitácora ---
  const [modalBitacora, setModalBitacora] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [iRes, bRes, mRes] = await Promise.all([
        supabase.from("materia_prima").select("*").order("codigo"),
        supabase.from("materia_prima_bom").select("materia_prima_id, tipo_cable"),
        supabase.from("movimientos_inventario").select("*")
          .eq("destino", "materia_prima").order("created_at", { ascending: false }).limit(60),
      ]);

      if (iRes.error) console.error("materia_prima (¿corriste el SQL?):", iRes.error.message);
      setInsumos(iRes.data || []);
      setBom(bRes.data || []);
      setMovimientos(mRes.data || []);
    } catch (err) {
      console.error("Error cargando materia prima:", err);
    } finally {
      setCargando(false);
    }
  };

  const auditar = async (accion: string, id: any, detalle: string, autor?: string) => {
    if (!supabase) return;
    try {
      await supabase.from("audit_log").insert([{
        accion, entidad: "materia_prima",
        entidad_id: id != null ? String(id) : null, detalle, autor: autor || null,
      }]);
    } catch { /* no frena la operación */ }
  };

  /* ========================================================
     ALTA DE INSUMO
     ======================================================== */

  const crearInsumo = async () => {
    if (!supabase) return;
    if (!formNuevo.codigo.trim() || !formNuevo.nombre.trim()) {
      return alert("El código y el nombre son obligatorios.");
    }

    try {
      const { data, error } = await supabase.from("materia_prima").insert([{
        codigo: formNuevo.codigo.trim().toUpperCase(),
        nombre: formNuevo.nombre.trim(),
        especificacion: formNuevo.especificacion || null,
        categoria: formNuevo.categoria,
        unidad: formNuevo.unidad,
        stock_actual: Number(formNuevo.stock_actual) || 0,
        stock_minimo: Number(formNuevo.stock_minimo) || 0,
        activo: true,
      }]).select().single();

      if (error) throw error;

      // Asociación a los tipos de cable donde se usa
      if (formNuevo.cables.length > 0 && data?.id) {
        await supabase.from("materia_prima_bom").insert(
          formNuevo.cables.map((t: string) => ({ materia_prima_id: data.id, tipo_cable: t }))
        );
      }

      // Si nace con existencia, queda el movimiento de apertura
      if (Number(formNuevo.stock_actual) > 0 && data?.id) {
        await supabase.from("movimientos_inventario").insert([{
          tipo: "entrada", origen: "ajuste", destino: "materia_prima",
          materia_prima_id: data.id, descripcion: `${data.codigo} — ${data.nombre}`,
          cantidad_anterior: 0, cantidad: Number(formNuevo.stock_actual),
          cantidad_nueva: Number(formNuevo.stock_actual), unidad: formNuevo.unidad,
          motivo: "Existencia inicial al dar de alta el insumo",
        }]);
      }

      auditar("insumo_creado", data?.id, `Alta de insumo ${data?.codigo} — ${data?.nombre}.`);
      setModalNuevo(false);
      setFormNuevo({ codigo: "", nombre: "", especificacion: "", categoria: CATEGORIAS[0], unidad: "kg", stock_actual: 0, stock_minimo: 0, cables: ["FTTH"] });
      cargar();
    } catch (err: any) {
      alert("Error al crear el insumo: " + (err.message || err));
    }
  };

  /* ========================================================
     AJUSTE DE EXISTENCIA
     ======================================================== */

  const abrirAjuste = (i: Insumo) => {
    setModalAjuste({ open: true, insumo: i });
    setFormAjuste({ cantidad: Number(i.stock_actual), motivo: "", autor: "" });
  };

  /**
   * Ajuste por conteo físico. No suma ni resta: se pone la
   * cantidad real y el sistema calcula la diferencia, dejando
   * el movimiento registrado con su motivo.
   */
  const guardarAjuste = async () => {
    const i = modalAjuste.insumo;
    if (!i || !supabase) return;
    if (!formAjuste.motivo.trim()) return alert("Escribe el motivo del ajuste (conteo, merma, auditoría...).");

    const antes = Number(i.stock_actual);
    const despues = Number(formAjuste.cantidad) || 0;
    const diferencia = despues - antes;

    if (diferencia === 0) return alert("La cantidad no cambió.");

    try {
      const { error } = await supabase.from("materia_prima")
        .update({ stock_actual: despues }).eq("id", i.id);
      if (error) throw error;

      await supabase.from("movimientos_inventario").insert([{
        tipo: "ajuste", origen: "ajuste", destino: "materia_prima",
        materia_prima_id: i.id, descripcion: `${i.codigo} — ${i.nombre}`,
        cantidad_anterior: antes, cantidad: Math.abs(diferencia), cantidad_nueva: despues,
        unidad: i.unidad, motivo: formAjuste.motivo, autor: formAjuste.autor || null,
      }]);

      auditar("stock_ajustado", i.id,
        `${i.codigo}: ${num(antes)} -> ${num(despues)} ${i.unidad} (${diferencia > 0 ? "+" : ""}${num(diferencia)}). Motivo: ${formAjuste.motivo}.`,
        formAjuste.autor);

      setModalAjuste({ open: false, insumo: null });
      cargar();
    } catch (err: any) {
      alert("Error al ajustar: " + (err.message || err));
    }
  };

  const cambiarMinimo = async (i: Insumo, valor: number) => {
    if (!supabase) return;
    const { error } = await supabase.from("materia_prima")
      .update({ stock_minimo: valor }).eq("id", i.id);
    if (error) return alert("Error: " + error.message);
    setInsumos((prev) => prev.map((x) => (x.id === i.id ? { ...x, stock_minimo: valor } : x)));
  };

  /* ========================================================
     DERIVADOS
     ======================================================== */

  const idsPorCable = useMemo(() => {
    const m: Record<string, Set<number>> = { FTTH: new Set(), ASU: new Set(), ADSS: new Set() };
    bom.forEach((b) => { if (m[b.tipo_cable]) m[b.tipo_cable].add(b.materia_prima_id); });
    return m;
  }, [bom]);

  const cablesDeInsumo = (id: number) =>
    TIPOS_CABLE.filter((t) => idsPorCable[t]?.has(id));

  const filtrados = insumos.filter((i) => {
    if (!i.activo) return false;
    if (filtroCable !== "TODOS" && !idsPorCable[filtroCable]?.has(i.id)) return false;
    const q = buscar.toLowerCase().trim();
    if (!q) return true;
    return [i.codigo, i.nombre, i.especificacion, i.categoria]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const bajoMinimo = insumos.filter((i) => Number(i.stock_minimo || 0) > 0 && Number(i.stock_actual) < Number(i.stock_minimo));
  const sinStock = insumos.filter((i) => Number(i.stock_actual) <= 0);

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <Card style={{ padding: "22px", marginBottom: 0 }}>
      <style jsx global>{`
        .mp-lb { display:block; font-size:0.66rem; color:rgba(255,255,255,0.55); margin-bottom:5px;
                 text-transform:uppercase; letter-spacing:0.5px; }
        .mp-ov { position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center;
                 justify-content:center; z-index:1000; padding:20px; }
        .mp-chip { padding:2px 8px; border-radius:10px; font-size:0.64rem; font-weight:600; }
      `}</style>

      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <Heading style={{ textTransform: "uppercase", margin: "0 0 6px 0" }}>
            Bodega de Materia Prima
          </Heading>
          <p style={{ color: theme.textMuted, fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>
            Existencias reales. Suben con las recepciones de compra en Proveedores,
            y bajan al cerrar producción en Manufactura.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Button variant="gold" onClick={() => setModalNuevo(true)}>+ Nuevo Insumo</Button>
          <Button variant="outline-gold" onClick={() => setModalBitacora(true)}>
            Bitácora de Movimientos
          </Button>
          <Button variant="ghost" onClick={cargar}>↻ Actualizar</Button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <Card style={{ padding: "14px 16px", marginBottom: 0 }}>
          <span className="mp-lb">Insumos Activos</span>
          <h3 style={{ color: theme.gold, fontSize: "1.4rem", margin: "4px 0 0 0", fontWeight: 400 }}>{insumos.filter((i) => i.activo).length}</h3>
        </Card>
        <Card style={{ padding: "14px 16px", marginBottom: 0 }}>
          <span className="mp-lb">Bajo Mínimo</span>
          <h3 style={{ color: bajoMinimo.length > 0 ? "#e67e22" : theme.green, fontSize: "1.4rem", margin: "4px 0 0 0", fontWeight: 400 }}>{bajoMinimo.length}</h3>
        </Card>
        <Card style={{ padding: "14px 16px", marginBottom: 0 }}>
          <span className="mp-lb">Sin Existencia</span>
          <h3 style={{ color: sinStock.length > 0 ? theme.red : theme.green, fontSize: "1.4rem", margin: "4px 0 0 0", fontWeight: 400 }}>{sinStock.length}</h3>
        </Card>
        <Card style={{ padding: "14px 16px", marginBottom: 0 }}>
          <span className="mp-lb">Movimientos Recientes</span>
          <h3 style={{ color: theme.gold, fontSize: "1.4rem", margin: "4px 0 0 0", fontWeight: 400 }}>{movimientos.length}</h3>
        </Card>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
        {(["TODOS", ...TIPOS_CABLE] as const).map((t) => (
          <Button key={t} variant={filtroCable === t ? "gold" : "outline-gold"} onClick={() => setFiltroCable(t as any)}>
            {t === "TODOS" ? "TODAS LAS MATERIAS PRIMAS" : t}
          </Button>
        ))}
        <input
          style={{ ...inputStyle, width: "250px", marginLeft: "auto", boxSizing: "border-box" }}
          placeholder="Buscar código, nombre o categoría..."
          value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>

      {cargando ? (
        <p style={{ color: theme.textMuted, textAlign: "center", padding: "40px" }}>Cargando existencias...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: theme.textMuted, marginBottom: "6px" }}>No hay insumos que coincidan.</p>
          <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>
            Si esperabas ver el catálogo, revisa que hayas corrido el SQL de abastecimiento.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: theme.textLight, fontSize: "0.83rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.borderGold}`, backgroundColor: theme.sidebarBg, color: theme.gold }}>
                <th style={th}>Código</th>
                <th style={th}>Material / Insumo</th>
                <th style={th}>Categoría</th>
                <th style={th}>Usado en</th>
                <th style={{ ...th, textAlign: "right" }}>Existencia</th>
                <th style={{ ...th, textAlign: "right" }}>Mínimo</th>
                <th style={th}>Estado</th>
                <th style={{ ...th, textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const min = Number(i.stock_minimo || 0);
                const stock = Number(i.stock_actual);
                const enCero = stock <= 0;
                const bajo = min > 0 && stock < min;
                const cables = cablesDeInsumo(i.id);
                return (
                  <tr key={i.id} style={{ borderBottom: "1px solid #111" }}>
                    <td style={{ ...td, color: theme.gold, fontWeight: 700 }}>{i.codigo}</td>
                    <td style={td}>
                      {i.nombre}
                      {i.especificacion && (
                        <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginTop: "2px" }}>{i.especificacion}</div>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: "0.75rem", color: theme.textMuted }}>{i.categoria || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {cables.length === 0 ? (
                          <span style={{ color: theme.textMuted, fontSize: "0.7rem" }}>—</span>
                        ) : cables.map((c) => (
                          <Badge key={c} tone="gold">{c}</Badge>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, fontSize: "0.95rem",
                      color: enCero ? theme.red : bajo ? "#e67e22" : theme.green }}>
                      {num(stock, 3)} <span style={{ fontSize: "0.72rem", color: theme.textMuted, fontWeight: 400 }}>{i.unidad}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <input type="number" min={0} defaultValue={min}
                        style={{ ...inputStyle, width: "90px", textAlign: "right", padding: "5px 8px", fontSize: "0.78rem", boxSizing: "border-box" }}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          if (v !== min) cambiarMinimo(i, v);
                        }} />
                    </td>
                    <td style={td}>
                      {enCero ? (
                        <Badge tone="danger">Sin stock</Badge>
                      ) : bajo ? (
                        <span className="mp-chip" style={{ background: "rgba(230,126,34,0.15)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.35)" }}>Bajo mínimo</span>
                      ) : (
                        <Badge tone="success">Disponible</Badge>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <Button variant="ghost" onClick={() => abrirAjuste(i)} style={{ padding: "5px 10px", fontSize: "0.72rem" }}>⚙️ Ajustar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: theme.textMuted, fontSize: "0.73rem", marginTop: "18px", lineHeight: 1.6 }}>
        📌 Para <strong style={{ color: theme.gold }}>ingresar mercancía comprada</strong>, usa Proveedores → Órdenes de
        Compra → Recibir. Eso genera la cuenta por pagar además de sumar el stock.
        El ajuste de esta pantalla es solo para conteos físicos, mermas y correcciones.
      </p>

      {/* ============ MODAL: NUEVO INSUMO ============ */}
      {modalNuevo && (
        <div className="mp-ov">
          <Card style={{ maxWidth: "620px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
            <Heading style={{ textTransform: "uppercase", marginTop: 0 }}>Nuevo Insumo</Heading>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "12px" }}>
              <div><label className="mp-lb">Código *</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="MP-XXX-01" value={formNuevo.codigo}
                  onChange={(e) => setFormNuevo({ ...formNuevo, codigo: e.target.value })} /></div>
              <div><label className="mp-lb">Nombre del material *</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={formNuevo.nombre}
                  onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })} /></div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label className="mp-lb">Especificación técnica</label>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={formNuevo.especificacion}
                onChange={(e) => setFormNuevo({ ...formNuevo, especificacion: e.target.value })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div><label className="mp-lb">Categoría</label>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={formNuevo.categoria}
                  onChange={(e) => setFormNuevo({ ...formNuevo, categoria: e.target.value })}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="mp-lb">Unidad</label>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={formNuevo.unidad}
                  onChange={(e) => setFormNuevo({ ...formNuevo, unidad: e.target.value })}>
                  <option value="kg">kg</option><option value="km">km</option>
                  <option value="m">m</option><option value="litros">litros</option>
                  <option value="und">und</option>
                </select></div>
              <div><label className="mp-lb">Stock inicial</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min={0} value={formNuevo.stock_actual}
                  onChange={(e) => setFormNuevo({ ...formNuevo, stock_actual: e.target.value })} /></div>
              <div><label className="mp-lb">Stock mínimo</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min={0} value={formNuevo.stock_minimo}
                  onChange={(e) => setFormNuevo({ ...formNuevo, stock_minimo: e.target.value })} /></div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label className="mp-lb">¿En qué cables se usa?</label>
              <div style={{ display: "flex", gap: "18px", marginTop: "6px" }}>
                {TIPOS_CABLE.map((t) => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer",
                    color: formNuevo.cables.includes(t) ? theme.gold : theme.textMuted, fontSize: "0.82rem" }}>
                    <input type="checkbox" checked={formNuevo.cables.includes(t)}
                      style={{ width: "15px", height: "15px", accentColor: theme.gold }}
                      onChange={(e) => {
                        const l = e.target.checked
                          ? [...formNuevo.cables, t]
                          : formNuevo.cables.filter((x: string) => x !== t);
                        setFormNuevo({ ...formNuevo, cables: l });
                      }} />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalNuevo(false)}>Cancelar</Button>
              <Button variant="gold" onClick={crearInsumo}>Crear Insumo</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ============ MODAL: AJUSTE ============ */}
      {modalAjuste.open && modalAjuste.insumo && (() => {
        const i = modalAjuste.insumo!;
        const dif = (Number(formAjuste.cantidad) || 0) - Number(i.stock_actual);
        return (
          <div className="mp-ov">
            <Card style={{ maxWidth: "460px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
              <Heading style={{ textTransform: "uppercase", marginTop: 0 }}>
                Ajustar Existencia
              </Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.85rem", marginBottom: "16px" }}>
                <strong style={{ color: theme.gold }}>{i.codigo}</strong> — {i.nombre}<br />
                <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
                  En sistema: <strong style={{ color: theme.green }}>{num(i.stock_actual, 3)} {i.unidad}</strong>
                </span>
              </p>

              <div style={{ marginBottom: "12px" }}>
                <label className="mp-lb">Cantidad física real ({i.unidad})</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min={0} step="0.001" value={formAjuste.cantidad}
                  onChange={(e) => setFormAjuste({ ...formAjuste, cantidad: Number(e.target.value) || 0 })} />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label className="mp-lb">Motivo *</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Conteo trimestral, merma de extrusión..."
                  value={formAjuste.motivo} onChange={(e) => setFormAjuste({ ...formAjuste, motivo: e.target.value })} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label className="mp-lb">Registrado por</label>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Tu nombre" value={formAjuste.autor}
                  onChange={(e) => setFormAjuste({ ...formAjuste, autor: e.target.value })} />
              </div>

              <div style={{ background: theme.goldSoft, border: `1px dashed ${theme.borderGoldLight}`,
                borderRadius: theme.radiusSm, padding: "13px 16px", marginBottom: "18px", fontSize: "0.83rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.textMuted }}>Diferencia a registrar</span>
                  <strong style={{ color: dif > 0 ? theme.green : dif < 0 ? theme.red : theme.textMuted }}>
                    {dif > 0 ? "+" : ""}{num(dif, 3)} {i.unidad}
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="ghost" onClick={() => setModalAjuste({ open: false, insumo: null })}>Cancelar</Button>
                <Button variant="gold" onClick={guardarAjuste}>Aplicar Ajuste</Button>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ============ MODAL: BITÁCORA ============ */}
      {modalBitacora && (
        <div className="mp-ov">
          <Card style={{ maxWidth: "900px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <Heading style={{ textTransform: "uppercase", margin: 0 }}>
                Bitácora de Movimientos
              </Heading>
              <Button variant="ghost" onClick={() => setModalBitacora(false)}>Cerrar</Button>
            </div>

            {movimientos.length === 0 ? (
              <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>
                Todavía no hay movimientos registrados.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: theme.textLight, fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.borderGold}`, color: theme.gold }}>
                    <th style={th}>Fecha</th><th style={th}>Tipo</th><th style={th}>Insumo</th>
                    <th style={{ ...th, textAlign: "right" }}>Antes</th>
                    <th style={{ ...th, textAlign: "right" }}>Cantidad</th>
                    <th style={{ ...th, textAlign: "right" }}>Después</th>
                    <th style={th}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => {
                    const entrada = m.tipo === "entrada";
                    const salida = m.tipo === "salida";
                    const color = entrada ? theme.green : salida ? theme.red : "#f1c40f";
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ ...td, color: theme.textMuted, fontSize: "0.72rem" }}>
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td style={td}>
                          {entrada ? (
                            <Badge tone="success">{m.tipo}</Badge>
                          ) : salida ? (
                            <Badge tone="danger">{m.tipo}</Badge>
                          ) : (
                            <span className="mp-chip" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
                              {m.tipo}
                            </span>
                          )}
                          <div style={{ fontSize: "0.66rem", color: theme.textMuted, marginTop: "2px" }}>{m.origen}</div>
                        </td>
                        <td style={{ ...td, fontSize: "0.76rem" }}>{m.descripcion || "—"}</td>
                        <td style={{ ...td, textAlign: "right", color: theme.textMuted }}>{num(m.cantidad_anterior, 2)}</td>
                        <td style={{ ...td, textAlign: "right", color, fontWeight: 700 }}>
                          {entrada ? "+" : salida ? "−" : "±"}{num(m.cantidad, 2)} {m.unidad}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{num(m.cantidad_nueva, 2)}</td>
                        <td style={{ ...td, fontSize: "0.72rem", color: theme.textMuted }}>
                          {m.motivo || "—"}
                          {m.autor && <div style={{ fontSize: "0.66rem", color: theme.textMuted }}>por {m.autor}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </Card>
  );
}

const th: React.CSSProperties = {
  padding: "10px", fontSize: "0.68rem", textTransform: "uppercase",
  textAlign: "left", letterSpacing: "0.8px",
};
const td: React.CSSProperties = { padding: "10px", textAlign: "left" };
