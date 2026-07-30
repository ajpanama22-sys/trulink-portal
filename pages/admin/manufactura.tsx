import { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

/* ============================================================
   PANEL DE MANUFACTURA — TRULINK FIBER LLC
   ------------------------------------------------------------
   Pestañas:
     1. Cotizaciones  — aprobar y mandar a producción
     2. Producción    — órdenes, requerimiento de materia prima
                        y cierre que consume el inventario
     3. Recetas       — consumo por km y calibración con lotes reales
     4. Insumos       — existencias reales de materia prima

   Cómo se calcula el consumo:
     'por_hilo' -> cantidad_por_km x km x número de hilos
     'fijo'     -> cantidad_por_km x km
     'empirico' -> igual que fijo, pero el número sale de
                   calibrar con producción real, no de teoría
   ============================================================ */

type Configuracion = {
  id: number;
  codigo: string;
  nombre: string;
  tipo_cable: string;
  vano_metros: number | null;
  con_mensajero: boolean;
  metros_por_carrete: number;
  notas: string | null;
};

type MateriaPrima = {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number | null;
  categoria: string | null;
};

type Receta = {
  id: number;
  configuracion_id: number;
  materia_prima_id: number;
  cantidad_por_km: number;
  tipo_calculo: string;
  calibrado: boolean;
  notas: string | null;
};

type OrdenProduccion = {
  id: number;
  numero: string | null;
  quote_id: string | null;
  quote_referencia: string | null;
  cliente_nombre: string | null;
  configuracion_id: number | null;
  numero_hilos: number;
  carretes: number;
  km_totales: number;
  sku_destino: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  faltantes: string | null;
  notas: string | null;
};

const ESTADOS_OP = ["Planificada", "En producción", "Completada", "Cancelada"] as const;

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (n: any, dec = 2) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: dec });

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Deduce la configuración a partir de lo que guardó la cotización. */
const inferirCodigoConfig = (item: any): string | null => {
  if (item?.configuracion_codigo) return String(item.configuracion_codigo);

  const tipo = String(item?.SKU || item?.tipo || "").toUpperCase();
  const vano = item?.vano ? Number(item.vano) : null;
  const mensajero = item?.con_mensajero === true || item?.conMensajero === true;

  if (tipo.includes("FTT")) return mensajero ? "FTTH-CM" : "FTTH-SM";
  if (tipo.includes("ADSS")) return vano ? `ADSS-${vano}` : "ADSS-100";
  if (tipo.includes("ASU")) return vano ? `ASU-${vano}` : "ASU-100";
  return null;
};

export default function ManufacturaDashboard() {
  const supabase = getSupabase();

  const [tab, setTab] = useState<"cotizaciones" | "produccion" | "recetas" | "insumos">("cotizaciones");
  const [cargando, setCargando] = useState(true);

  const [quotes, setQuotes] = useState<any[]>([]);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [insumos, setInsumos] = useState<MateriaPrima[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);

  // --- Filtros ---
  const [filtroQuotes, setFiltroQuotes] = useState<"PENDIENTES" | "APROBADAS" | "TODAS">("PENDIENTES");
  const [buscarQuote, setBuscarQuote] = useState("");
  const [filtroOP, setFiltroOP] = useState("ABIERTAS");
  const [configReceta, setConfigReceta] = useState<string>("");

  // --- Modal aprobación ---
  const [modalAprobar, setModalAprobar] = useState<{ open: boolean; quote: any | null }>({ open: false, quote: null });
  const [formAprob, setFormAprob] = useState({ tipo: "Correo", referencia: "", autor: "" });

  // --- Modal orden de producción ---
  const [modalOP, setModalOP] = useState<{ open: boolean; quote: any | null }>({ open: false, quote: null });
  const [formOP, setFormOP] = useState<any>({ configuracion_id: "", numero_hilos: 12, carretes: 1, metros_por_carrete: 1000, sku_destino: "", notas: "" });
  const [guardandoOP, setGuardandoOP] = useState(false);

  // --- Modal requerimiento / cierre ---
  const [modalReq, setModalReq] = useState<{ open: boolean; orden: OrdenProduccion | null }>({ open: false, orden: null });
  const [cerrando, setCerrando] = useState(false);

  // --- Modal calibración ---
  const [modalCal, setModalCal] = useState<{ open: boolean; receta: Receta | null }>({ open: false, receta: null });
  const [formCal, setFormCal] = useState({ km_producidos: 0, consumo_real: 0, autor: "" });

  useEffect(() => { cargarTodo(); }, []);

  /* ========================================================
     CARGA
     ======================================================== */

  const cargarTodo = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [qRes, cRes, mRes, rRes, oRes] = await Promise.all([
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("producto_configuraciones").select("*").eq("activo", true).order("codigo"),
        supabase.from("materia_prima").select("*").eq("activo", true).order("codigo"),
        supabase.from("recetas").select("*"),
        supabase.from("ordenes_produccion").select("*").order("id", { ascending: false }),
      ]);

      if (cRes.error) console.error("producto_configuraciones (¿corriste el SQL?):", cRes.error.message);
      if (rRes.error) console.error("recetas:", rRes.error.message);
      if (oRes.error) console.error("ordenes_produccion:", oRes.error.message);

      // Solo cotizaciones de fábrica. El campo real es "type", no
      // "tipo_cotizacion" — ese nunca existió y por eso antes se
      // colaban aquí las cotizaciones de productos de bodega.
      const soloFabrica = (qRes.data || []).filter((q: any) => {
        const t = String(q.type || q.tipo || q.tipo_solicitud || "").toLowerCase();
        return t.includes("fabric");
      });

      setQuotes(soloFabrica);
      setConfigs(cRes.data || []);
      setInsumos(mRes.data || []);
      setRecetas(rRes.data || []);
      setOrdenes(oRes.data || []);
      if (!configReceta && (cRes.data || []).length > 0) setConfigReceta(String(cRes.data[0].id));
    } catch (err) {
      console.error("Error cargando manufactura:", err);
    } finally {
      setCargando(false);
    }
  };

  const auditar = async (accion: string, entidad: string, id: any, detalle: string) => {
    if (!supabase) return;
    try {
      await supabase.from("audit_log").insert([{
        accion, entidad, entidad_id: id != null ? String(id) : null, detalle, autor: null,
      }]);
    } catch { /* nunca frena la operación */ }
  };

  /* ========================================================
     EXPLOSIÓN DE RECETA
     ======================================================== */

  /**
   * Calcula cuánta materia prima necesita una corrida y compara
   * contra las existencias reales. Es el cálculo que convierte
   * "cambié un estado" en "consumí inventario".
   */
  const explotarReceta = (configuracionId: number, km: number, hilos: number) => {
    const lineas = recetas.filter((r) => r.configuracion_id === configuracionId);
    return lineas.map((r) => {
      const mp = insumos.find((m) => m.id === r.materia_prima_id);
      const factor = r.tipo_calculo === "por_hilo" ? hilos : 1;
      const requerido = Number(r.cantidad_por_km || 0) * km * factor;
      const disponible = Number(mp?.stock_actual || 0);
      return {
        receta: r,
        materia_prima_id: r.materia_prima_id,
        codigo: mp?.codigo || "?",
        nombre: mp?.nombre || "Insumo desconocido",
        unidad: mp?.unidad || "",
        tipo_calculo: r.tipo_calculo,
        calibrado: r.calibrado,
        requerido,
        disponible,
        falta: Math.max(0, requerido - disponible),
        sinReceta: !r.calibrado && Number(r.cantidad_por_km || 0) === 0,
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));
  };

  /* ========================================================
     APROBACIÓN DE COTIZACIONES
     ======================================================== */

  const abrirAprobar = (q: any) => {
    setModalAprobar({ open: true, quote: q });
    setFormAprob({ tipo: "Correo", referencia: "", autor: "" });
  };

  const confirmarAprobacion = async () => {
    const q = modalAprobar.quote;
    if (!q || !supabase) return;

    const { error } = await supabase.from("quotes").update({
      aprobada: true,
      fecha_aprobacion: new Date().toISOString(),
      tipo_aprobacion: formAprob.tipo,
      referencia_aprobacion: formAprob.referencia || null,
      aprobada_por: formAprob.autor || null,
      status: "aprobada",
    }).eq("id", q.id);

    if (error) return alert("Error al aprobar: " + error.message);

    auditar("cotizacion_aprobada", "quote", q.id,
      `${q.referencia} aprobada vía ${formAprob.tipo}${formAprob.referencia ? ` (${formAprob.referencia})` : ""}.`);

    setModalAprobar({ open: false, quote: null });
    cargarTodo();
  };

  /* ========================================================
     ÓRDENES DE PRODUCCIÓN
     ======================================================== */

  const abrirGenerarOP = (q: any) => {
    // Se intenta deducir la configuración desde el primer renglón
    // de la cotización; si no se logra, el usuario la elige a mano.
    let items: any[] = [];
    try {
      items = typeof q.items === "string" ? JSON.parse(q.items) : (q.items || []);
    } catch { items = []; }

    const primero = Array.isArray(items) && items.length > 0 ? items[0] : null;
    const codigoInferido = primero ? inferirCodigoConfig(primero) : null;
    const cfg = configs.find((c) => c.codigo === codigoInferido);

    const hilos = Number(primero?.hilos || primero?.numero_hilos || 12);
    const carretes = Number(primero?.cantidad || 1);

    setModalOP({ open: true, quote: q });
    // El carrete puede variar dentro de un mismo producto (FTTH viene en
    // 1 km y en 2 km), así que se toma el de la cotización si viene, y si
    // no, el valor por defecto de la configuración.
    const kmCotizado = Number(primero?.longitudKm || primero?.km_carrete || 0);
    const metros = kmCotizado > 0 ? kmCotizado * 1000 : (cfg?.metros_por_carrete || 1000);

    setFormOP({
      configuracion_id: cfg ? String(cfg.id) : "",
      numero_hilos: hilos,
      carretes,
      metros_por_carrete: metros,
      sku_destino: "",
      notas: `Generada desde cotización ${q.referencia}`,
    });
  };

  const kmDeFormOP = useMemo(() => {
    const metros = Number(formOP.metros_por_carrete) || 0;
    return (Number(formOP.carretes) || 0) * (metros / 1000);
  }, [formOP]);

  const previewOP = useMemo(() => {
    if (!formOP.configuracion_id || kmDeFormOP <= 0) return [];
    return explotarReceta(Number(formOP.configuracion_id), kmDeFormOP, Number(formOP.numero_hilos) || 1);
  }, [formOP, kmDeFormOP, recetas, insumos]);

  const crearOrdenProduccion = async () => {
    const q = modalOP.quote;
    if (!supabase) return;
    if (!formOP.configuracion_id) return alert("Selecciona la configuración del producto.");
    if ((Number(formOP.carretes) || 0) <= 0) return alert("La cantidad de carretes debe ser mayor a cero.");

    setGuardandoOP(true);
    try {
      const numero = "OP-" + Date.now().toString().slice(-8);
      const { data, error } = await supabase.from("ordenes_produccion").insert([{
        numero,
        quote_id: q ? String(q.id) : null,
        quote_referencia: q?.referencia || null,
        cliente_nombre: q?.empresa || q?.razon_social || null,
        configuracion_id: Number(formOP.configuracion_id),
        numero_hilos: Number(formOP.numero_hilos) || 1,
        carretes: Number(formOP.carretes) || 1,
        metros_por_carrete: Number(formOP.metros_por_carrete) || 1000,
        km_totales: kmDeFormOP,
        sku_destino: formOP.sku_destino || null,
        estado: "Planificada",
        fecha_inicio: hoyISO(),
        notas: formOP.notas || null,
      }]).select().single();

      if (error) throw error;

      const cfg = configs.find((c) => String(c.id) === String(formOP.configuracion_id));
      auditar("op_creada", "orden_produccion", data.id,
        `${numero}: ${formOP.carretes} carrete(s) de ${cfg?.nombre} = ${num(kmDeFormOP)} km.`);

      setModalOP({ open: false, quote: null });
      cargarTodo();
      alert(`Orden ${numero} creada: ${formOP.carretes} carrete(s) = ${num(kmDeFormOP)} km.`);
    } catch (err: any) {
      alert("Error al crear la orden: " + (err.message || err));
    } finally {
      setGuardandoOP(false);
    }
  };

  const cambiarEstadoOP = async (o: OrdenProduccion, estado: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("ordenes_produccion").update({ estado }).eq("id", o.id);
    if (error) return alert("Error: " + error.message);
    setOrdenes((prev) => prev.map((x) => (x.id === o.id ? { ...x, estado } : x)));
  };

  /**
   * CIERRE DE PRODUCCIÓN — el momento clave del lado de planta.
   * Descuenta la materia prima según la receta, deja el rastro
   * de cada movimiento, guarda el consumo congelado de la orden
   * y suma el cable terminado a bodega.
   */
  const cerrarProduccion = async () => {
    const o = modalReq.orden;
    if (!o || !supabase) return;

    const req = explotarReceta(o.configuracion_id!, Number(o.km_totales), o.numero_hilos);
    const conFaltante = req.filter((r) => r.falta > 0);

    if (conFaltante.length > 0) {
      const detalle = conFaltante.map((r) => `${r.codigo}: faltan ${num(r.falta, 3)} ${r.unidad}`).join("\n");
      if (!confirm(`Hay insumos insuficientes:\n\n${detalle}\n\n¿Cerrar de todos modos? El stock quedará en negativo.`)) return;
    }

    const sinCalibrar = req.filter((r) => r.sinReceta);
    if (sinCalibrar.length > 0) {
      const lista = sinCalibrar.map((r) => r.codigo).join(", ");
      if (!confirm(`Estos insumos tienen receta en cero y NO se van a descontar:\n\n${lista}\n\nCalíbralos en la pestaña Recetas para que se consuman. ¿Continuar?`)) return;
    }

    setCerrando(true);
    const errores: string[] = [];

    try {
      for (const linea of req) {
        if (linea.requerido <= 0) continue;

        const { data: mp } = await supabase
          .from("materia_prima").select("stock_actual").eq("id", linea.materia_prima_id).maybeSingle();

        const antes = Number(mp?.stock_actual || 0);
        const despues = Number((antes - linea.requerido).toFixed(4));

        const { error } = await supabase.from("materia_prima")
          .update({ stock_actual: despues }).eq("id", linea.materia_prima_id);
        if (error) { errores.push(`${linea.codigo}: ${error.message}`); continue; }

        await supabase.from("movimientos_inventario").insert([{
          tipo: "salida", origen: "produccion", referencia_id: String(o.id),
          destino: "materia_prima", materia_prima_id: linea.materia_prima_id,
          descripcion: `${linea.codigo} — ${linea.nombre}`,
          cantidad_anterior: antes, cantidad: linea.requerido, cantidad_nueva: despues,
          unidad: linea.unidad, motivo: `Producción ${o.numero}`,
        }]);

        await supabase.from("orden_produccion_consumos").insert([{
          orden_produccion_id: o.id, materia_prima_id: linea.materia_prima_id,
          codigo_insumo: linea.codigo, descripcion: linea.nombre, unidad: linea.unidad,
          cantidad_planificada: linea.requerido, cantidad_consumida: linea.requerido,
          stock_antes: antes, stock_despues: despues,
        }]);
      }

      // Entrada del cable terminado a bodega, si se indicó el SKU
      if (o.sku_destino) {
        const { data: prod } = await supabase
          .from("cablesdb").select("id, cantidad")
          .or(`SKU.eq.${o.sku_destino},sku.eq.${o.sku_destino}`).maybeSingle();

        if (prod) {
          const antes = Number(prod.cantidad || 0);
          const despues = antes + Number(o.carretes);
          await supabase.from("cablesdb").update({ cantidad: despues }).eq("id", prod.id);
          await supabase.from("movimientos_inventario").insert([{
            tipo: "entrada", origen: "produccion", referencia_id: String(o.id),
            destino: "bodega", tabla_bodega: "cablesdb", sku_bodega: o.sku_destino,
            descripcion: `Cable fabricado — ${o.carretes} carrete(s)`,
            cantidad_anterior: antes, cantidad: Number(o.carretes), cantidad_nueva: despues,
            unidad: "carrete", motivo: `Producción ${o.numero}`,
          }]);
        } else {
          errores.push(`SKU ${o.sku_destino}: no existe en cablesdb, el cable no entró a bodega`);
        }
      }

      await supabase.from("ordenes_produccion").update({
        estado: "Completada",
        fecha_fin: hoyISO(),
        faltantes: conFaltante.length > 0 ? conFaltante.map((r) => `${r.codigo}: ${num(r.falta, 3)} ${r.unidad}`).join(" | ") : null,
      }).eq("id", o.id);

      auditar("op_completada", "orden_produccion", o.id,
        `${o.numero} cerrada: ${o.carretes} carrete(s), ${num(o.km_totales)} km. Materia prima descontada.`);

      setModalReq({ open: false, orden: null });
      cargarTodo();

      if (errores.length > 0) alert("Producción cerrada con avisos:\n\n" + errores.join("\n"));
      else alert(`Producción ${o.numero} cerrada. Materia prima descontada e inventario actualizado.`);
    } catch (err: any) {
      alert("Error al cerrar la producción: " + (err.message || err));
    } finally {
      setCerrando(false);
    }
  };

  /* ========================================================
     RECETAS Y CALIBRACIÓN
     ======================================================== */

  const guardarCantidadReceta = async (r: Receta, valor: number) => {
    if (!supabase) return;
    const { error } = await supabase.from("recetas")
      .update({ cantidad_por_km: valor, calibrado: valor > 0, actualizado_en: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return alert("Error: " + error.message);
    setRecetas((prev) => prev.map((x) => (x.id === r.id ? { ...x, cantidad_por_km: valor, calibrado: valor > 0 } : x)));
  };

  const abrirCalibrar = (r: Receta) => {
    setModalCal({ open: true, receta: r });
    setFormCal({ km_producidos: 0, consumo_real: 0, autor: "" });
  };

  /**
   * Toma lo que realmente se consumió en un lote y deduce el
   * consumo por km. Así la receta deja de ser estimada y pasa
   * a ser medida.
   */
  const aplicarCalibracion = async () => {
    const r = modalCal.receta;
    if (!r || !supabase) return;
    const km = Number(formCal.km_producidos) || 0;
    const real = Number(formCal.consumo_real) || 0;
    if (km <= 0) return alert("Los km producidos deben ser mayores a cero.");

    const porKm = Number((real / km).toFixed(4));

    try {
      await supabase.from("calibraciones_produccion").insert([{
        configuracion_id: r.configuracion_id, materia_prima_id: r.materia_prima_id,
        km_producidos: km, consumo_real: real, aplicado_a_receta: true,
        autor: formCal.autor || null,
      }]);

      await supabase.from("recetas").update({
        cantidad_por_km: porKm, calibrado: true, actualizado_en: new Date().toISOString(),
      }).eq("id", r.id);

      setRecetas((prev) => prev.map((x) => (x.id === r.id ? { ...x, cantidad_por_km: porKm, calibrado: true } : x)));
      setModalCal({ open: false, receta: null });
      alert(`Receta calibrada: ${num(porKm, 4)} por km (${num(real, 2)} consumidos en ${num(km)} km).`);
    } catch (err: any) {
      alert("Error al calibrar: " + (err.message || err));
    }
  };

  /* ========================================================
     DERIVADOS
     ======================================================== */

  const quotesFiltradas = quotes.filter((q) => {
    if (filtroQuotes === "PENDIENTES" && q.aprobada) return false;
    if (filtroQuotes === "APROBADAS" && !q.aprobada) return false;
    const t = buscarQuote.toLowerCase().trim();
    if (!t) return true;
    return [q.referencia, q.empresa, q.representante, q.email]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
  });

  const ordenesFiltradas = ordenes.filter((o) => {
    if (filtroOP === "ABIERTAS") return o.estado !== "Completada" && o.estado !== "Cancelada";
    if (filtroOP === "COMPLETADAS") return o.estado === "Completada";
    return true;
  });

  const quotesConOP = new Set(ordenes.map((o) => String(o.quote_id)));
  const recetasDeConfig = recetas.filter((r) => String(r.configuracion_id) === String(configReceta));
  const configSel = configs.find((c) => String(c.id) === String(configReceta));

  const insumosBajos = insumos.filter((m) => Number(m.stock_minimo || 0) > 0 && Number(m.stock_actual) < Number(m.stock_minimo));
  const recetasPendientes = recetas.filter((r) => !r.calibrado).length;

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <div style={{ display: "flex", backgroundColor: "#000", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="manufactura" />

      <main style={{ flex: 1, padding: "35px 30px", color: "#DAA520", boxSizing: "border-box", overflowX: "auto" }}>
        <style jsx global>{`
          .mf-card { background:#080808; border:1px solid rgba(218,165,32,0.3); border-radius:12px; padding:22px; }
          .mf-kpi { background:#0d0d0d; border:1px solid rgba(218,165,32,0.3); border-radius:10px; padding:18px; }
          .mf-tab { background:transparent; color:#DAA520; border:1px solid rgba(218,165,32,0.5); padding:10px 18px;
                    border-radius:8px; font-weight:600; font-size:0.78rem; letter-spacing:0.8px; cursor:pointer; transition:all .25s; }
          .mf-tab:hover, .mf-tab.on { background:#DAA520; color:#000; }
          .mf-gold { background:#DAA520; color:#000; border:none; padding:10px 18px; border-radius:6px;
                     font-weight:700; font-size:0.78rem; cursor:pointer; }
          .mf-gold:disabled { opacity:.5; cursor:not-allowed; }
          .mf-mini { background:transparent; color:#DAA520; border:1px solid rgba(218,165,32,0.45);
                     padding:5px 10px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; white-space:nowrap; }
          .mf-mini:hover { background:rgba(218,165,32,0.15); }
          .mf-verde { background:transparent; color:#2ecc71; border:1px solid rgba(46,204,113,0.5);
                      padding:5px 10px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; white-space:nowrap; }
          .mf-verde:hover { background:rgba(46,204,113,0.15); }
          .mf-tabla { width:100%; border-collapse:collapse; font-size:0.82rem; }
          .mf-tabla th { background:#0a0a0a; color:#DAA520; text-transform:uppercase; font-size:0.66rem;
                         letter-spacing:1px; padding:11px 10px; text-align:left; border-bottom:1px solid rgba(218,165,32,0.35); }
          .mf-tabla td { padding:10px; color:#fff; border-bottom:1px solid #141414; }
          .mf-in { width:100%; background:#050505; color:#DAA520; border:1px solid rgba(218,165,32,0.4);
                   padding:9px 11px; border-radius:6px; outline:none; font-size:0.82rem; box-sizing:border-box; font-family:inherit; }
          .mf-lb { display:block; font-size:0.66rem; color:rgba(255,255,255,0.55); margin-bottom:5px;
                   text-transform:uppercase; letter-spacing:0.5px; }
          .mf-ov { position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center;
                   justify-content:center; z-index:1000; padding:20px; }
          .mf-md { background:#111; border:1px solid rgba(218,165,32,0.5); border-radius:12px; padding:26px;
                   width:100%; max-height:90vh; overflow-y:auto; }
          .mf-chip { padding:3px 9px; border-radius:10px; font-size:0.66rem; font-weight:600; }
        `}</style>

        <div style={{ marginBottom: "22px", borderBottom: "1px solid rgba(218,165,32,0.3)", paddingBottom: "18px" }}>
          <h1 style={{ color: "#DAA520", fontSize: "1.5rem", textTransform: "uppercase", letterSpacing: "1.2px", margin: "0 0 6px 0", fontWeight: 700 }}>
            Panel de Manufactura
          </h1>
          <p style={{ color: "#888", fontSize: "0.82rem", margin: "0 0 18px 0" }}>
            De la cotización aprobada al cable terminado, descontando materia prima real.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={() => setTab("cotizaciones")} className={`mf-tab ${tab === "cotizaciones" ? "on" : ""}`}>📄 Cotizaciones</button>
            <button onClick={() => setTab("produccion")} className={`mf-tab ${tab === "produccion" ? "on" : ""}`}>⚙️ Producción</button>
            <button onClick={() => setTab("recetas")} className={`mf-tab ${tab === "recetas" ? "on" : ""}`}>🧪 Recetas</button>
            <button onClick={() => setTab("insumos")} className={`mf-tab ${tab === "insumos" ? "on" : ""}`}>📦 Insumos</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <div className="mf-kpi">
            <span className="mf-lb">Por Aprobar</span>
            <h2 style={{ color: "#e74c3c", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {quotes.filter((q) => !q.aprobada).length}
            </h2>
          </div>
          <div className="mf-kpi">
            <span className="mf-lb">Órdenes Abiertas</span>
            <h2 style={{ color: "#DAA520", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {ordenes.filter((o) => o.estado !== "Completada" && o.estado !== "Cancelada").length}
            </h2>
          </div>
          <div className="mf-kpi">
            <span className="mf-lb">Recetas sin Calibrar</span>
            <h2 style={{ color: recetasPendientes > 0 ? "#e67e22" : "#2ecc71", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {recetasPendientes}
            </h2>
          </div>
          <div className="mf-kpi">
            <span className="mf-lb">Insumos Bajo Mínimo</span>
            <h2 style={{ color: insumosBajos.length > 0 ? "#e74c3c" : "#2ecc71", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {insumosBajos.length}
            </h2>
          </div>
        </div>

        {cargando ? (
          <div className="mf-card" style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "#888" }}>Cargando planta...</p>
          </div>
        ) : (
          <>
            {/* ============ COTIZACIONES ============ */}
            {tab === "cotizaciones" && (
              <div className="mf-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
                    Cotizaciones de Fábrica ({quotesFiltradas.length})
                  </h3>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input className="mf-in" style={{ width: "230px" }} placeholder="Buscar referencia o empresa..."
                      value={buscarQuote} onChange={(e) => setBuscarQuote(e.target.value)} />
                    <select className="mf-in" style={{ width: "auto" }} value={filtroQuotes}
                      onChange={(e) => setFiltroQuotes(e.target.value as any)}>
                      <option value="PENDIENTES">Por aprobar</option>
                      <option value="APROBADAS">Aprobadas</option>
                      <option value="TODAS">Todas</option>
                    </select>
                  </div>
                </div>

                {quotesFiltradas.length === 0 ? (
                  <p style={{ color: "#777", textAlign: "center", padding: "30px" }}>
                    No hay cotizaciones de fábrica que coincidan con el filtro.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="mf-tabla">
                      <thead>
                        <tr>
                          <th>Referencia</th><th>Cliente</th><th>Fecha</th>
                          <th style={{ textAlign: "right" }}>Total</th><th>Abonado</th>
                          <th>Aprobación</th><th style={{ textAlign: "right" }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotesFiltradas.map((q) => {
                          const abonado = Number(q.monto_abono || 0);
                          const total = Number(q.total || 0);
                          const yaTieneOP = quotesConOP.has(String(q.id));
                          return (
                            <tr key={q.id}>
                              <td style={{ color: "#DAA520", fontWeight: 700 }}>{q.referencia}</td>
                              <td>
                                {q.empresa || "N/D"}
                                {q.representante && <div style={{ fontSize: "0.7rem", color: "#777" }}>Atn: {q.representante}</div>}
                              </td>
                              <td style={{ fontSize: "0.74rem", color: "#aaa" }}>
                                {q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}
                              </td>
                              <td style={{ textAlign: "right", color: "#DAA520", fontWeight: 600 }}>{fmt(total)}</td>
                              <td style={{ fontSize: "0.76rem", color: abonado > 0 ? "#2ecc71" : "#666" }}>
                                {abonado > 0 ? fmt(abonado) : "—"}
                              </td>
                              <td>
                                {q.aprobada ? (
                                  <div>
                                    <span className="mf-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>
                                      {q.tipo_aprobacion || "Aprobada"}
                                    </span>
                                    {q.referencia_aprobacion && (
                                      <div style={{ fontSize: "0.66rem", color: "#777", marginTop: "3px" }}>{q.referencia_aprobacion}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="mf-chip" style={{ background: "rgba(231,76,60,0.15)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.35)" }}>
                                    Sin aprobar
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {!q.aprobada ? (
                                  <button className="mf-verde" onClick={() => abrirAprobar(q)}>✓ Aprobar</button>
                                ) : yaTieneOP ? (
                                  <span style={{ color: "#2ecc71", fontSize: "0.7rem" }}>✓ En producción</span>
                                ) : (
                                  <button className="mf-gold" style={{ padding: "5px 12px", fontSize: "0.7rem" }}
                                    onClick={() => abrirGenerarOP(q)}>
                                    ⚙️ Generar OP
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============ PRODUCCIÓN ============ */}
            {tab === "produccion" && (
              <div className="mf-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
                    Órdenes de Producción ({ordenesFiltradas.length})
                  </h3>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <select className="mf-in" style={{ width: "auto" }} value={filtroOP} onChange={(e) => setFiltroOP(e.target.value)}>
                      <option value="ABIERTAS">Abiertas</option>
                      <option value="COMPLETADAS">Completadas</option>
                      <option value="TODAS">Todas</option>
                    </select>
                    <button className="mf-gold" onClick={() => { setModalOP({ open: true, quote: null }); setFormOP({ configuracion_id: "", numero_hilos: 12, carretes: 1, metros_por_carrete: 1000, sku_destino: "", notas: "" }); }}>
                      + Orden Manual
                    </button>
                  </div>
                </div>

                {ordenesFiltradas.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px" }}>
                    <p style={{ color: "#777", marginBottom: "6px" }}>No hay órdenes de producción.</p>
                    <p style={{ color: "#555", fontSize: "0.78rem" }}>
                      Aprueba una cotización de fábrica y genera su orden desde la pestaña Cotizaciones.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="mf-tabla">
                      <thead>
                        <tr>
                          <th>Orden</th><th>Cotización</th><th>Producto</th><th>Hilos</th>
                          <th>Carretes</th><th>Km</th><th>Estado</th><th style={{ textAlign: "right" }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenesFiltradas.map((o) => {
                          const cfg = configs.find((c) => c.id === o.configuracion_id);
                          const completada = o.estado === "Completada";
                          return (
                            <tr key={o.id}>
                              <td style={{ color: "#DAA520", fontWeight: 700 }}>
                                {o.numero}
                                {o.cliente_nombre && <div style={{ fontSize: "0.68rem", color: "#777" }}>{o.cliente_nombre}</div>}
                              </td>
                              <td style={{ fontSize: "0.76rem" }}>{o.quote_referencia || "Manual"}</td>
                              <td style={{ fontSize: "0.76rem" }}>
                                {cfg?.nombre || "—"}
                                {cfg?.vano_metros && <div style={{ fontSize: "0.66rem", color: "#777" }}>Vano {cfg.vano_metros} m</div>}
                                {cfg?.con_mensajero && <div style={{ fontSize: "0.66rem", color: "#777" }}>Con mensajero</div>}
                              </td>
                              <td>{o.numero_hilos}</td>
                              <td style={{ color: "#DAA520", fontWeight: 600 }}>{o.carretes}</td>
                              <td>{num(o.km_totales)} km</td>
                              <td>
                                <select className="mf-in" style={{ width: "auto", padding: "5px 8px", fontSize: "0.7rem" }}
                                  value={o.estado} disabled={completada}
                                  onChange={(e) => cambiarEstadoOP(o, e.target.value)}>
                                  {ESTADOS_OP.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {o.faltantes && (
                                  <div style={{ fontSize: "0.64rem", color: "#e67e22", marginTop: "3px" }}>Cerró con faltantes</div>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button className={completada ? "mf-mini" : "mf-verde"} onClick={() => setModalReq({ open: true, orden: o })}>
                                  {completada ? "Ver consumo" : "🧾 Requerimiento"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============ RECETAS ============ */}
            {tab === "recetas" && (
              <div>
                <div className="mf-card" style={{ marginBottom: "20px" }}>
                  <label className="mf-lb">Configuración de producto</label>
                  <select className="mf-in" style={{ maxWidth: "460px" }} value={configReceta} onChange={(e) => setConfigReceta(e.target.value)}>
                    {configs.map((c) => <option key={c.id} value={String(c.id)}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                  {configSel && (
                    <p style={{ color: "#777", fontSize: "0.76rem", marginTop: "10px", marginBottom: 0 }}>
                      Carrete de {configSel.metros_por_carrete / 1000} km
                      {configSel.vano_metros ? ` · vano ${configSel.vano_metros} m` : ""}
                      {configSel.con_mensajero ? " · con mensajero de acero" : ""}
                      {configSel.notas ? ` · ${configSel.notas}` : ""}
                    </p>
                  )}
                </div>

                <div className="mf-card">
                  <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", marginTop: 0, marginBottom: "6px" }}>
                    Consumo por Kilómetro
                  </h3>
                  <p style={{ color: "#777", fontSize: "0.76rem", margin: "0 0 16px 0", lineHeight: 1.6 }}>
                    Las líneas de geometría ya están calculadas. Las empíricas dependen de tu máquina:
                    edítalas a mano si conoces el número, o usa <strong style={{ color: "#DAA520" }}>Calibrar</strong> para
                    deducirlo de un lote real que ya produjiste.
                  </p>

                  {recetasDeConfig.length === 0 ? (
                    <p style={{ color: "#777", textAlign: "center", padding: "24px" }}>
                      Esta configuración no tiene receta cargada. ¿Corriste el SQL de producción?
                    </p>
                  ) : (
                    <table className="mf-tabla">
                      <thead>
                        <tr>
                          <th>Insumo</th><th>Cálculo</th>
                          <th style={{ textAlign: "right" }}>Cantidad por km</th>
                          <th>Estado</th><th style={{ textAlign: "right" }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recetasDeConfig.map((r) => {
                          const mp = insumos.find((m) => m.id === r.materia_prima_id);
                          const listo = r.calibrado && Number(r.cantidad_por_km) > 0;
                          return (
                            <tr key={r.id}>
                              <td>
                                <span style={{ color: "#DAA520", fontWeight: 600 }}>{mp?.codigo}</span>
                                <div style={{ fontSize: "0.72rem", color: "#aaa" }}>{mp?.nombre}</div>
                              </td>
                              <td style={{ fontSize: "0.72rem" }}>
                                {r.tipo_calculo === "por_hilo" ? (
                                  <span style={{ color: "#3498db" }}>× nº de hilos</span>
                                ) : r.tipo_calculo === "empirico" ? (
                                  <span style={{ color: "#e67e22" }}>empírico</span>
                                ) : (
                                  <span style={{ color: "#2ecc71" }}>fijo</span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                                  <input className="mf-in" type="number" min={0} step="0.0001"
                                    defaultValue={r.cantidad_por_km}
                                    style={{ width: "110px", textAlign: "right", padding: "6px 8px" }}
                                    onBlur={(e) => {
                                      const v = Number(e.target.value) || 0;
                                      if (v !== Number(r.cantidad_por_km)) guardarCantidadReceta(r, v);
                                    }} />
                                  <span style={{ fontSize: "0.7rem", color: "#777", width: "28px" }}>{mp?.unidad}</span>
                                </div>
                              </td>
                              <td>
                                {listo ? (
                                  <span className="mf-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>
                                    Listo
                                  </span>
                                ) : (
                                  <span className="mf-chip" style={{ background: "rgba(230,126,34,0.15)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.35)" }}>
                                    Por calibrar
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button className="mf-mini" onClick={() => abrirCalibrar(r)}>📐 Calibrar</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ============ INSUMOS ============ */}
            {tab === "insumos" && (
              <div className="mf-card">
                <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", marginTop: 0, marginBottom: "6px" }}>
                  Existencias de Materia Prima ({insumos.length})
                </h3>
                <p style={{ color: "#777", fontSize: "0.76rem", margin: "0 0 16px 0" }}>
                  Datos reales de la tabla materia_prima. Suben con las recepciones de compra y bajan al cerrar producción.
                </p>

                {insumos.length === 0 ? (
                  <p style={{ color: "#777", textAlign: "center", padding: "24px" }}>No hay insumos cargados.</p>
                ) : (
                  <table className="mf-tabla">
                    <thead>
                      <tr><th>Código</th><th>Insumo</th><th>Categoría</th>
                        <th style={{ textAlign: "right" }}>Existencia</th><th>Unidad</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {insumos.map((m) => {
                        const min = Number(m.stock_minimo || 0);
                        const bajo = min > 0 && Number(m.stock_actual) < min;
                        const enCero = Number(m.stock_actual) <= 0;
                        return (
                          <tr key={m.id}>
                            <td style={{ color: "#DAA520", fontWeight: 700 }}>{m.codigo}</td>
                            <td style={{ fontSize: "0.8rem" }}>{m.nombre}</td>
                            <td style={{ fontSize: "0.74rem", color: "#aaa" }}>{m.categoria || "—"}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: enCero ? "#e74c3c" : bajo ? "#e67e22" : "#2ecc71" }}>
                              {num(m.stock_actual, 3)}
                            </td>
                            <td style={{ fontSize: "0.74rem", color: "#aaa" }}>{m.unidad}</td>
                            <td>
                              {enCero ? (
                                <span className="mf-chip" style={{ background: "rgba(231,76,60,0.15)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.35)" }}>Sin stock</span>
                              ) : bajo ? (
                                <span className="mf-chip" style={{ background: "rgba(230,126,34,0.15)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.35)" }}>Bajo mínimo</span>
                              ) : (
                                <span className="mf-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>Disponible</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ============ MODAL: APROBAR COTIZACIÓN ============ */}
      {modalAprobar.open && modalAprobar.quote && (
        <div className="mf-ov">
          <div className="mf-md" style={{ maxWidth: "480px" }}>
            <h2 style={{ color: "#2ecc71", marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>Aprobar Cotización</h2>
            <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "18px" }}>
              <strong style={{ color: "#DAA520" }}>{modalAprobar.quote.referencia}</strong> — {modalAprobar.quote.empresa}
              <br /><span style={{ fontSize: "0.8rem", color: "#888" }}>Total: {fmt(modalAprobar.quote.total)}</span>
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label className="mf-lb">¿Cómo se aprobó?</label>
              <select className="mf-in" value={formAprob.tipo} onChange={(e) => setFormAprob({ ...formAprob, tipo: e.target.value })}>
                <option value="Correo">Aceptación por correo</option>
                <option value="OC Cliente">Orden de compra del cliente</option>
                <option value="Abono">Abono recibido (parcial)</option>
                <option value="Pago total">Pago total en el portal</option>
              </select>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label className="mf-lb">Referencia del respaldo</label>
              <input className="mf-in" placeholder="N° de OC, transferencia o asunto del correo"
                value={formAprob.referencia} onChange={(e) => setFormAprob({ ...formAprob, referencia: e.target.value })} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label className="mf-lb">Aprobada por</label>
              <input className="mf-in" placeholder="Tu nombre" value={formAprob.autor}
                onChange={(e) => setFormAprob({ ...formAprob, autor: e.target.value })} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setModalAprobar({ open: false, quote: null })}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                Cancelar
              </button>
              <button className="mf-gold" style={{ background: "#2ecc71" }} onClick={confirmarAprobacion}>Confirmar Aprobación</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: ORDEN DE PRODUCCIÓN ============ */}
      {modalOP.open && (
        <div className="mf-ov">
          <div className="mf-md" style={{ maxWidth: "760px" }}>
            <h2 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>
              {modalOP.quote ? `Orden de Producción — ${modalOP.quote.referencia}` : "Orden de Producción Manual"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div><label className="mf-lb">Configuración *</label>
                <select className="mf-in" value={formOP.configuracion_id}
                  onChange={(e) => setFormOP({ ...formOP, configuracion_id: e.target.value })}>
                  <option value="">— Selecciona —</option>
                  {configs.map((c) => <option key={c.id} value={String(c.id)}>{c.codigo} — {c.nombre}</option>)}
                </select></div>
              <div><label className="mf-lb">N° de hilos</label>
                <input className="mf-in" type="number" min={1} value={formOP.numero_hilos}
                  onChange={(e) => setFormOP({ ...formOP, numero_hilos: e.target.value })} /></div>
              <div><label className="mf-lb">Carretes</label>
                <input className="mf-in" type="number" min={1} value={formOP.carretes}
                  onChange={(e) => setFormOP({ ...formOP, carretes: e.target.value })} /></div>
              <div><label className="mf-lb">Km por carrete</label>
                <input className="mf-in" type="number" min={0} step="0.5" value={(Number(formOP.metros_por_carrete) || 0) / 1000}
                  onChange={(e) => setFormOP({ ...formOP, metros_por_carrete: (Number(e.target.value) || 0) * 1000 })} /></div>
              <div><label className="mf-lb">SKU destino</label>
                <input className="mf-in" placeholder="En cablesdb" value={formOP.sku_destino}
                  onChange={(e) => setFormOP({ ...formOP, sku_destino: e.target.value })} /></div>
            </div>

            {kmDeFormOP > 0 && (
              <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.35)", borderRadius: "8px", padding: "13px 16px", marginBottom: "16px" }}>
                <span style={{ color: "#fff", fontSize: "0.85rem" }}>
                  {formOP.carretes} carrete(s) × {(Number(formOP.metros_por_carrete) || 0) / 1000} km ={" "}
                  <strong style={{ color: "#DAA520", fontSize: "1.05rem" }}>{num(kmDeFormOP)} km</strong> de cable
                </span>
              </div>
            )}

            {previewOP.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "0.7rem", color: "#DAA520", margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Materia prima que va a consumir
                </p>
                <div style={{ maxHeight: "230px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px" }}>
                  <table className="mf-tabla">
                    <thead><tr><th>Insumo</th><th style={{ textAlign: "right" }}>Requiere</th><th style={{ textAlign: "right" }}>Hay</th><th>Estado</th></tr></thead>
                    <tbody>
                      {previewOP.map((l) => (
                        <tr key={l.materia_prima_id}>
                          <td style={{ fontSize: "0.76rem" }}>
                            <span style={{ color: "#DAA520" }}>{l.codigo}</span>
                            <div style={{ fontSize: "0.68rem", color: "#777" }}>{l.nombre}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {l.sinReceta ? <span style={{ color: "#e67e22" }}>sin receta</span> : `${num(l.requerido, 3)} ${l.unidad}`}
                          </td>
                          <td style={{ textAlign: "right", color: "#aaa" }}>{num(l.disponible, 2)}</td>
                          <td>
                            {l.sinReceta ? (
                              <span style={{ color: "#e67e22", fontSize: "0.7rem" }}>calibrar</span>
                            ) : l.falta > 0 ? (
                              <span style={{ color: "#e74c3c", fontSize: "0.7rem" }}>faltan {num(l.falta, 2)}</span>
                            ) : (
                              <span style={{ color: "#2ecc71", fontSize: "0.7rem" }}>✓ alcanza</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "18px" }}>
              <label className="mf-lb">Notas</label>
              <textarea className="mf-in" rows={2} style={{ resize: "vertical" }} value={formOP.notas}
                onChange={(e) => setFormOP({ ...formOP, notas: e.target.value })} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setModalOP({ open: false, quote: null })}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                Cancelar
              </button>
              <button className="mf-gold" disabled={guardandoOP} onClick={crearOrdenProduccion}>
                {guardandoOP ? "Creando..." : "Crear Orden"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: REQUERIMIENTO Y CIERRE ============ */}
      {modalReq.open && modalReq.orden && (() => {
        const o = modalReq.orden!;
        const cfg = configs.find((c) => c.id === o.configuracion_id);
        const req = o.configuracion_id ? explotarReceta(o.configuracion_id, Number(o.km_totales), o.numero_hilos) : [];
        const completada = o.estado === "Completada";
        const faltantes = req.filter((r) => r.falta > 0).length;
        return (
          <div className="mf-ov">
            <div className="mf-md" style={{ maxWidth: "720px" }}>
              <h2 style={{ color: completada ? "#DAA520" : "#2ecc71", marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>
                {completada ? "Consumo de la Orden" : "Requerimiento de Materia Prima"}
              </h2>
              <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "16px" }}>
                <strong style={{ color: "#DAA520" }}>{o.numero}</strong> — {cfg?.nombre}
                <br />
                <span style={{ fontSize: "0.8rem", color: "#888" }}>
                  {o.carretes} carrete(s) · {o.numero_hilos} hilos · {num(o.km_totales)} km
                  {o.cliente_nombre ? ` · ${o.cliente_nombre}` : ""}
                </span>
              </p>

              <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", marginBottom: "16px" }}>
                <table className="mf-tabla">
                  <thead><tr><th>Insumo</th><th>Cálculo</th><th style={{ textAlign: "right" }}>Requiere</th><th style={{ textAlign: "right" }}>Existencia</th><th>Estado</th></tr></thead>
                  <tbody>
                    {req.map((l) => (
                      <tr key={l.materia_prima_id}>
                        <td style={{ fontSize: "0.76rem" }}>
                          <span style={{ color: "#DAA520" }}>{l.codigo}</span>
                          <div style={{ fontSize: "0.68rem", color: "#777" }}>{l.nombre}</div>
                        </td>
                        <td style={{ fontSize: "0.68rem", color: "#888" }}>
                          {l.tipo_calculo === "por_hilo" ? `${num(l.receta.cantidad_por_km, 4)} × ${num(o.km_totales)} km × ${o.numero_hilos} hilos` : `${num(l.receta.cantidad_por_km, 4)} × ${num(o.km_totales)} km`}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: l.sinReceta ? "#e67e22" : "#fff" }}>
                          {l.sinReceta ? "sin receta" : `${num(l.requerido, 3)} ${l.unidad}`}
                        </td>
                        <td style={{ textAlign: "right", color: "#aaa" }}>{num(l.disponible, 2)} {l.unidad}</td>
                        <td>
                          {l.sinReceta ? (
                            <span style={{ color: "#e67e22", fontSize: "0.7rem" }}>no descuenta</span>
                          ) : l.falta > 0 ? (
                            <span style={{ color: "#e74c3c", fontSize: "0.7rem" }}>faltan {num(l.falta, 2)}</span>
                          ) : (
                            <span style={{ color: "#2ecc71", fontSize: "0.7rem" }}>✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!completada && (
                <div style={{ background: "rgba(46,204,113,0.06)", border: "1px dashed rgba(46,204,113,0.35)", borderRadius: "8px", padding: "13px 16px", marginBottom: "16px" }}>
                  <p style={{ fontSize: "0.7rem", color: "#2ecc71", margin: "0 0 8px 0", textTransform: "uppercase" }}>Al cerrar la producción</p>
                  <ul style={{ color: "#ccc", fontSize: "0.78rem", margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
                    <li>Se descuenta cada insumo de materia prima</li>
                    <li>Queda el movimiento registrado para auditoría</li>
                    {o.sku_destino
                      ? <li>Entran {o.carretes} carrete(s) al SKU <strong style={{ color: "#DAA520" }}>{o.sku_destino}</strong> en bodega</li>
                      : <li style={{ color: "#e67e22" }}>Sin SKU destino: el cable no entrará a bodega</li>}
                  </ul>
                  {faltantes > 0 && (
                    <p style={{ color: "#e74c3c", fontSize: "0.74rem", margin: "10px 0 0 0" }}>
                      ⚠ {faltantes} insumo(s) sin existencia suficiente. Se puede cerrar igual, pero el stock quedará negativo.
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button onClick={() => setModalReq({ open: false, orden: null })}
                  style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                  {completada ? "Cerrar" : "Cancelar"}
                </button>
                {!completada && (
                  <button className="mf-gold" style={{ background: "#2ecc71" }} disabled={cerrando} onClick={cerrarProduccion}>
                    {cerrando ? "Procesando..." : "Cerrar Producción"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============ MODAL: CALIBRAR ============ */}
      {modalCal.open && modalCal.receta && (() => {
        const r = modalCal.receta!;
        const mp = insumos.find((m) => m.id === r.materia_prima_id);
        const km = Number(formCal.km_producidos) || 0;
        const real = Number(formCal.consumo_real) || 0;
        const resultado = km > 0 ? real / km : 0;
        return (
          <div className="mf-ov">
            <div className="mf-md" style={{ maxWidth: "480px" }}>
              <h2 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>Calibrar Receta</h2>
              <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "8px" }}>
                <strong style={{ color: "#DAA520" }}>{mp?.codigo}</strong> — {mp?.nombre}
              </p>
              <p style={{ color: "#777", fontSize: "0.76rem", marginBottom: "18px", lineHeight: 1.6 }}>
                Anota lo que realmente consumiste en un lote ya producido. El sistema deduce el consumo por km
                y actualiza la receta. Con dos o tres lotes el número deja de ser estimado.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div><label className="mf-lb">Km producidos</label>
                  <input className="mf-in" type="number" min={0} step="0.01" value={formCal.km_producidos}
                    onChange={(e) => setFormCal({ ...formCal, km_producidos: Number(e.target.value) || 0 })} /></div>
                <div><label className="mf-lb">Consumo real ({mp?.unidad})</label>
                  <input className="mf-in" type="number" min={0} step="0.01" value={formCal.consumo_real}
                    onChange={(e) => setFormCal({ ...formCal, consumo_real: Number(e.target.value) || 0 })} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label className="mf-lb">Registrado por</label>
                  <input className="mf-in" placeholder="Tu nombre" value={formCal.autor}
                    onChange={(e) => setFormCal({ ...formCal, autor: e.target.value })} /></div>
              </div>

              <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "8px", padding: "14px", marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "6px" }}>
                  <span style={{ color: "#888" }}>Receta actual</span>
                  <strong style={{ color: "#aaa" }}>{num(r.cantidad_por_km, 4)} {mp?.unidad}/km</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <span style={{ color: "#888" }}>Nueva receta</span>
                  <strong style={{ color: "#2ecc71", fontSize: "1rem" }}>{num(resultado, 4)} {mp?.unidad}/km</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button onClick={() => setModalCal({ open: false, receta: null })}
                  style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                  Cancelar
                </button>
                <button className="mf-gold" onClick={aplicarCalibracion}>Aplicar Calibración</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
