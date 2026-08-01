import { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { getSupabase } from "../../lib/supabaseClient";
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
} from "../../lib/ui";

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

type LineaOrden = {
  id: number;
  orden_produccion_id: number;
  posicion: number;
  configuracion_id: number | null;
  descripcion: string | null;
  numero_hilos: number;
  carretes: number;
  metros_por_carrete: number;
  km_totales: number;
  sku_destino: string | null;
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
  const [lineasOrden, setLineasOrden] = useState<LineaOrden[]>([]);

  // --- Filtros ---
  const [filtroQuotes, setFiltroQuotes] = useState<"PENDIENTES" | "APROBADAS" | "TODAS">("PENDIENTES");
  const [buscarQuote, setBuscarQuote] = useState("");
  const [filtroOP, setFiltroOP] = useState("ABIERTAS");
  const [configReceta, setConfigReceta] = useState<string>("");

  // Simulador de la pestaña Recetas: deja ver el consumo TOTAL de una
  // corrida concreta, no solo la tasa por kilómetro.
  const [simHilos, setSimHilos] = useState<number>(96);
  const [simCarretes, setSimCarretes] = useState<number>(1);
  const [simKmCarrete, setSimKmCarrete] = useState<number>(3);

  // --- Modal aprobación ---
  const [modalAprobar, setModalAprobar] = useState<{ open: boolean; quote: any | null }>({ open: false, quote: null });
  const [formAprob, setFormAprob] = useState({ tipo: "Correo", referencia: "", autor: "" });

  // --- Modal orden de producción ---
  const [modalOP, setModalOP] = useState<{ open: boolean; quote: any | null }>({ open: false, quote: null });
  // Una cotización puede traer varios cables distintos (por ejemplo un ASU
  // y un FTTX). Cada uno necesita SU PROPIA orden de producción, porque son
  // recetas distintas en máquinas distintas. Por eso se maneja una lista de
  // renglones y no un formulario único.
  const [lineasOP, setLineasOP] = useState<any[]>([]);
  const [notasOP, setNotasOP] = useState("");
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
      const [qRes, cRes, mRes, rRes, oRes, lRes] = await Promise.all([
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("producto_configuraciones").select("*").eq("activo", true).order("codigo"),
        supabase.from("materia_prima").select("*").eq("activo", true).order("codigo"),
        supabase.from("recetas").select("*"),
        supabase.from("ordenes_produccion").select("*").order("id", { ascending: false }),
        supabase.from("orden_produccion_lineas").select("*").order("posicion"),
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

      const listaConfigs = cRes.data || [];

      setQuotes(soloFabrica);
      setConfigs(listaConfigs);
      setInsumos(mRes.data || []);
      setRecetas(rRes.data || []);
      setOrdenes(oRes.data || []);
      setLineasOrden(lRes.data || []);
      if (!configReceta && listaConfigs.length > 0) setConfigReceta(String(listaConfigs[0].id));
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

  /** Renglones de una orden. Si es antigua y no tiene, se arma uno desde el resumen. */
  const renglonesDe = (o: OrdenProduccion): LineaOrden[] => {
    const l = lineasOrden.filter((x) => x.orden_produccion_id === o.id);
    if (l.length > 0) return l;
    return [{
      id: -o.id, orden_produccion_id: o.id, posicion: 1,
      configuracion_id: o.configuracion_id, descripcion: "Renglón único",
      numero_hilos: o.numero_hilos, carretes: o.carretes,
      metros_por_carrete: 1000, km_totales: Number(o.km_totales || 0),
      sku_destino: o.sku_destino,
    }];
  };

  /**
   * Requerimiento de una orden completa: suma el consumo de todos
   * sus renglones. Si un insumo aparece en dos cables distintos,
   * las cantidades se acumulan.
   */
  const requerimientoOrden = (o: OrdenProduccion) => {
    const acum: Record<number, any> = {};
    renglonesDe(o).forEach((l) => {
      if (!l.configuracion_id) return;
      explotarReceta(l.configuracion_id, Number(l.km_totales || 0), l.numero_hilos)
        .forEach((r) => {
          if (!acum[r.materia_prima_id]) acum[r.materia_prima_id] = { ...r };
          else acum[r.materia_prima_id].requerido += r.requerido;
        });
    });
    return Object.values(acum).map((r: any) => ({
      ...r, falta: Math.max(0, r.requerido - r.disponible),
    })).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
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
    let items: any[] = [];
    try {
      items = q ? (typeof q.items === "string" ? JSON.parse(q.items) : (q.items || [])) : [];
    } catch { items = []; }
    if (!Array.isArray(items)) items = items ? [items] : [];

    // Se recorre CADA renglón de la cotización, no solo el primero.
    // De cada uno se deduce su configuración, hilos y tamaño de carrete
    // desde los campos estructurados que guarda el cotizador.
    const lineas = items.map((it: any, idx: number) => {
      const codigo = inferirCodigoConfig(it);
      const cfg = configs.find((c) => c.codigo === codigo);
      const kmCotizado = Number(it?.longitudKm || it?.km_carrete || 0);
      const metros = kmCotizado > 0 ? kmCotizado * 1000 : (cfg?.metros_por_carrete || 1000);

      return {
        key: `l${idx}`,
        incluir: true,
        descripcion: it?.descripcion || it?.SKU || `Renglón ${idx + 1}`,
        configuracion_id: cfg ? String(cfg.id) : "",
        numero_hilos: Number(it?.hilos || it?.numero_hilos || 12),
        carretes: Number(it?.cantidad || 1),
        metros_por_carrete: metros,
        sku_destino: "",
        reconocido: !!cfg,
      };
    });

    // Si la cotización no trajo renglones utilizables, se abre con uno vacío
    // para que se pueda cargar a mano.
    setLineasOP(lineas.length > 0 ? lineas : [{
      key: "l0", incluir: true, descripcion: "Renglón manual",
      configuracion_id: "", numero_hilos: 12, carretes: 1,
      metros_por_carrete: 1000, sku_destino: "", reconocido: false,
    }]);

    setNotasOP(q ? `Generada desde cotización ${q.referencia}` : "");
    setModalOP({ open: true, quote: q });
  };

  const actualizarLinea = (key: string, campo: string, valor: any) => {
    setLineasOP((prev) => prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  };

  const agregarLineaManual = () => {
    setLineasOP((prev) => [...prev, {
      key: `l${Date.now()}`, incluir: true, descripcion: "Renglón manual",
      configuracion_id: "", numero_hilos: 12, carretes: 1,
      metros_por_carrete: 1000, sku_destino: "", reconocido: false,
    }]);
  };

  const kmDeLinea = (l: any) =>
    (Number(l.carretes) || 0) * ((Number(l.metros_por_carrete) || 0) / 1000);

  /**
   * Suma el requerimiento de TODOS los renglones incluidos.
   * Si un insumo se usa en dos cables distintos, sus cantidades
   * se acumulan para saber si el stock alcanza para la corrida
   * completa, no para cada cable por separado.
   */
  const previewOP = useMemo(() => {
    const acumulado: Record<number, any> = {};

    lineasOP.filter((l) => l.incluir && l.configuracion_id).forEach((l) => {
      const km = kmDeLinea(l);
      if (km <= 0) return;
      explotarReceta(Number(l.configuracion_id), km, Number(l.numero_hilos) || 1)
        .forEach((r) => {
          if (!acumulado[r.materia_prima_id]) {
            acumulado[r.materia_prima_id] = { ...r };
          } else {
            acumulado[r.materia_prima_id].requerido += r.requerido;
          }
        });
    });

    return Object.values(acumulado).map((r: any) => ({
      ...r,
      falta: Math.max(0, r.requerido - r.disponible),
    })).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
  }, [lineasOP, recetas, insumos]);

  const kmTotalOP = lineasOP
    .filter((l) => l.incluir)
    .reduce((a, l) => a + kmDeLinea(l), 0);

  /**
   * Crea UNA ORDEN POR CADA RENGLÓN incluido.
   * Antes solo se tomaba el primer ítem de la cotización, así que si el
   * cliente pedía ASU y FTTX, el segundo cable simplemente no se producía.
   */
  /**
   * Crea UNA orden con TODOS sus renglones.
   * Antes solo se leía el primer ítem de la cotización, así que si el
   * cliente pedía ASU y FTTX, el segundo cable nunca se producía.
   */
  const crearOrdenProduccion = async () => {
    const q = modalOP.quote;
    if (!supabase) return;

    const activas = lineasOP.filter((l) => l.incluir);
    if (activas.length === 0) return alert("Marca al menos un renglón para producir.");

    const sinConfig = activas.filter((l) => !l.configuracion_id);
    if (sinConfig.length > 0) {
      return alert(
        `Hay ${sinConfig.length} renglón(es) sin configuración asignada:\n\n` +
        sinConfig.map((l) => `· ${l.descripcion}`).join("\n") +
        `\n\nElige la configuración de cada uno o desmárcalos.`
      );
    }
    if (activas.some((l) => (Number(l.carretes) || 0) <= 0)) {
      return alert("Todos los renglones deben tener al menos un carrete.");
    }

    setGuardandoOP(true);
    try {
      const numero = "OP-" + Date.now().toString().slice(-8);
      const kmTotal = activas.reduce((a, l) => a + kmDeLinea(l), 0);
      const carretesTotal = activas.reduce((a, l) => a + (Number(l.carretes) || 0), 0);
      const primera = activas[0];

      // La orden guarda el total; el detalle por producto va en los renglones
      const { data: orden, error } = await supabase.from("ordenes_produccion").insert([{
        numero,
        quote_id: q ? String(q.id) : null,
        quote_referencia: q?.referencia || null,
        cliente_nombre: q?.empresa || q?.razon_social || null,
        configuracion_id: Number(primera.configuracion_id),
        numero_hilos: Number(primera.numero_hilos) || 1,
        carretes: carretesTotal,
        metros_por_carrete: Number(primera.metros_por_carrete) || 1000,
        km_totales: kmTotal,
        sku_destino: primera.sku_destino || null,
        estado: "Planificada",
        fecha_inicio: hoyISO(),
        notas: notasOP || null,
      }]).select().single();

      if (error) throw error;

      const filas = activas.map((l, i) => ({
        orden_produccion_id: orden.id,
        posicion: i + 1,
        configuracion_id: Number(l.configuracion_id),
        descripcion: l.descripcion || null,
        numero_hilos: Number(l.numero_hilos) || 1,
        carretes: Number(l.carretes) || 1,
        metros_por_carrete: Number(l.metros_por_carrete) || 1000,
        km_totales: kmDeLinea(l),
        sku_destino: l.sku_destino || null,
      }));

      const { error: errL } = await supabase.from("orden_produccion_lineas").insert(filas);
      if (errL) throw errL;

      const resumen = activas.map((l) => {
        const cfg = configs.find((c) => String(c.id) === String(l.configuracion_id));
        return `${cfg?.codigo}: ${l.carretes} carrete(s), ${l.numero_hilos} hilos`;
      }).join(" · ");

      auditar("op_creada", "orden_produccion", orden?.id ?? null,
        `${numero} con ${activas.length} renglón(es), ${num(kmTotal)} km. ${resumen}`);

      setModalOP({ open: false, quote: null });
      setLineasOP([]);
      cargarTodo();
      alert(`Orden ${numero} creada con ${activas.length} renglón(es):\n\n${resumen}\n\nTotal: ${num(kmTotal)} km`);
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

    const renglones = renglonesDe(o);
    const req = requerimientoOrden(o);
    const conFaltante = req.filter((r) => r.falta > 0);

    if (conFaltante.length > 0) {
      const detalle = conFaltante.map((r) => `${r.codigo}: faltan ${num(r.falta, 3)} ${r.unidad}`).join("\n");
      if (!confirm(`Hay insumos insuficientes:\n\n${detalle}\n\n¿Cerrar de todos modos? El stock quedará en negativo.`)) return;
    }

    const sinCalibrar = req.filter((r) => r.sinReceta);
    if (sinCalibrar.length > 0) {
      const lista = sinCalibrar.map((r) => r.codigo).join(", ");
      if (!confirm(`Estos insumos tienen receta en cero y NO se van a descontar:\n\n${lista}\n\nCalíbralos en la pestaña Recetas. ¿Continuar?`)) return;
    }

    setCerrando(true);
    const errores: string[] = [];

    try {
      // El consumo se descuenta renglón por renglón, para que quede
      // registrado qué insumo se fue en qué producto.
      for (const linea of renglones) {
        if (!linea.configuracion_id) continue;
        const detalleLinea = explotarReceta(
          linea.configuracion_id, Number(linea.km_totales || 0), linea.numero_hilos
        );

        for (const l of detalleLinea) {
          if (l.requerido <= 0) continue;

          const { data: mp } = await supabase
            .from("materia_prima").select("stock_actual").eq("id", l.materia_prima_id).maybeSingle();

          const antes = Number(mp?.stock_actual || 0);
          const despues = Number((antes - l.requerido).toFixed(4));

          const { error } = await supabase.from("materia_prima")
            .update({ stock_actual: despues }).eq("id", l.materia_prima_id);
          if (error) { errores.push(`${l.codigo}: ${error.message}`); continue; }

          await supabase.from("movimientos_inventario").insert([{
            tipo: "salida", origen: "produccion", referencia_id: String(o.id),
            destino: "materia_prima", materia_prima_id: l.materia_prima_id,
            descripcion: `${l.codigo} — ${l.nombre}`,
            cantidad_anterior: antes, cantidad: l.requerido, cantidad_nueva: despues,
            unidad: l.unidad,
            motivo: `Producción ${o.numero}${renglones.length > 1 ? ` · renglón ${linea.posicion}` : ""}`,
          }]);

          await supabase.from("orden_produccion_consumos").insert([{
            orden_produccion_id: o.id,
            linea_id: linea.id > 0 ? linea.id : null,
            materia_prima_id: l.materia_prima_id,
            codigo_insumo: l.codigo, descripcion: l.nombre, unidad: l.unidad,
            cantidad_planificada: l.requerido, cantidad_consumida: l.requerido,
            stock_antes: antes, stock_despues: despues,
          }]);
        }

        // Entrada a bodega del cable fabricado de ESTE renglón
        if (linea.sku_destino) {
          const { data: prod } = await supabase
            .from("cablesdb").select("id, cantidad")
            .or(`SKU.eq.${linea.sku_destino},sku.eq.${linea.sku_destino}`).maybeSingle();

          if (prod) {
            const antes = Number(prod.cantidad || 0);
            const despues = antes + Number(linea.carretes || 0);
            await supabase.from("cablesdb").update({ cantidad: despues }).eq("id", prod.id);
            await supabase.from("movimientos_inventario").insert([{
              tipo: "entrada", origen: "produccion", referencia_id: String(o.id),
              destino: "bodega", tabla_bodega: "cablesdb", sku_bodega: linea.sku_destino,
              descripcion: `Cable fabricado — ${linea.descripcion || ""}`,
              cantidad_anterior: antes, cantidad: Number(linea.carretes || 0), cantidad_nueva: despues,
              unidad: "carrete", motivo: `Producción ${o.numero}`,
            }]);
          } else {
            errores.push(`SKU ${linea.sku_destino}: no existe en cablesdb`);
          }
        }
      }

      await supabase.from("ordenes_produccion").update({
        estado: "Completada",
        fecha_fin: hoyISO(),
        faltantes: conFaltante.length > 0
          ? conFaltante.map((r) => `${r.codigo}: ${num(r.falta, 3)} ${r.unidad}`).join(" | ")
          : null,
      }).eq("id", o.id);

      auditar("op_completada", "orden_produccion", o.id,
        `${o.numero} cerrada: ${renglones.length} renglón(es), ${num(o.km_totales)} km. Materia prima descontada.`);

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

  const simKmTotales = (Number(simCarretes) || 0) * (Number(simKmCarrete) || 0);

  /** Consumo total de la corrida simulada, insumo por insumo. */
  const consumoSimulado = (r: Receta): number => {
    const factor = r.tipo_calculo === "por_hilo" ? (Number(simHilos) || 1) : 1;
    return Number(r.cantidad_por_km || 0) * simKmTotales * factor;
  };

  const insumosBajos = insumos.filter((m) => Number(m.stock_minimo || 0) > 0 && Number(m.stock_actual) < Number(m.stock_minimo));
  const recetasPendientes = recetas.filter((r) => !r.calibrado).length;

  /* ========================================================
     RENDER
     ======================================================== */

  const kpiCardStyle: CSSProperties = { padding: "18px", marginBottom: 0 };
  const lbStyle: CSSProperties = {
    display: "block",
    fontSize: "0.66rem",
    color: theme.textMuted,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };
  const miniBtnStyle: CSSProperties = { padding: "5px 10px", fontSize: "0.7rem" };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="manufactura" />

      <div style={pageWrapStyle({ overflowX: "auto" })}>
        <style jsx global>{`
          .mf-tabla { width:100%; border-collapse:collapse; font-size:0.82rem; }
          .mf-tabla th { background:${theme.background}; color:${theme.gold}; text-transform:uppercase; font-size:0.66rem;
                         letter-spacing:1px; padding:11px 10px; text-align:left; border-bottom:1px solid ${theme.borderGoldCounter}; }
          .mf-tabla td { padding:10px; color:${theme.textLight}; border-bottom:1px solid #141414; }
          .mf-ov { position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center;
                   justify-content:center; z-index:1000; padding:20px; }
        `}</style>

        <PageHeader
          title="Panel de Manufactura"
          subtitle="De la cotización aprobada al cable terminado, descontando materia prima real."
        />

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "25px" }}>
          <Button variant={tab === "cotizaciones" ? "gold" : "outline-gold"} onClick={() => setTab("cotizaciones")}>📄 Cotizaciones</Button>
          <Button variant={tab === "produccion" ? "gold" : "outline-gold"} onClick={() => setTab("produccion")}>⚙️ Producción</Button>
          <Button variant={tab === "recetas" ? "gold" : "outline-gold"} onClick={() => setTab("recetas")}>🧪 Recetas</Button>
          <Button variant={tab === "insumos" ? "gold" : "outline-gold"} onClick={() => setTab("insumos")}>📦 Insumos</Button>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <Card style={kpiCardStyle}>
            <span style={lbStyle}>Por Aprobar</span>
            <h2 style={{ color: theme.red, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {quotes.filter((q) => !q.aprobada).length}
            </h2>
          </Card>
          <Card style={kpiCardStyle}>
            <span style={lbStyle}>Órdenes Abiertas</span>
            <h2 style={{ color: theme.gold, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {ordenes.filter((o) => o.estado !== "Completada" && o.estado !== "Cancelada").length}
            </h2>
          </Card>
          <Card style={kpiCardStyle}>
            <span style={lbStyle}>Recetas sin Calibrar</span>
            <h2 style={{ color: recetasPendientes > 0 ? "#e67e22" : theme.green, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {recetasPendientes}
            </h2>
          </Card>
          <Card style={kpiCardStyle}>
            <span style={lbStyle}>Insumos Bajo Mínimo</span>
            <h2 style={{ color: insumosBajos.length > 0 ? theme.red : theme.green, fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {insumosBajos.length}
            </h2>
          </Card>
        </div>

        {cargando ? (
          <Card style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: theme.textMuted }}>Cargando planta...</p>
          </Card>
        ) : (
          <>
            {/* ============ COTIZACIONES ============ */}
            {tab === "cotizaciones" && (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <Heading style={{ margin: 0, fontSize: "1rem", textTransform: "uppercase" }}>
                    Cotizaciones de Fábrica ({quotesFiltradas.length})
                  </Heading>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input style={{ ...inputStyle, width: "230px" }} placeholder="Buscar referencia o empresa..."
                      value={buscarQuote} onChange={(e) => setBuscarQuote(e.target.value)} />
                    <select style={{ ...inputStyle, width: "auto" }} value={filtroQuotes}
                      onChange={(e) => setFiltroQuotes(e.target.value as any)}>
                      <option value="PENDIENTES">Por aprobar</option>
                      <option value="APROBADAS">Aprobadas</option>
                      <option value="TODAS">Todas</option>
                    </select>
                  </div>
                </div>

                {quotesFiltradas.length === 0 ? (
                  <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>
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
                              <td style={{ color: theme.gold, fontWeight: 700 }}>{q.referencia}</td>
                              <td>
                                {q.empresa || "N/D"}
                                {q.representante && <div style={{ fontSize: "0.7rem", color: "#777" }}>Atn: {q.representante}</div>}
                              </td>
                              <td style={{ fontSize: "0.74rem", color: "#aaa" }}>
                                {q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}
                              </td>
                              <td style={{ textAlign: "right", color: theme.gold, fontWeight: 600 }}>{fmt(total)}</td>
                              <td style={{ fontSize: "0.76rem", color: abonado > 0 ? theme.green : "#666" }}>
                                {abonado > 0 ? fmt(abonado) : "—"}
                              </td>
                              <td>
                                {q.aprobada ? (
                                  <div>
                                    <Badge tone="success">{q.tipo_aprobacion || "Aprobada"}</Badge>
                                    {q.referencia_aprobacion && (
                                      <div style={{ fontSize: "0.66rem", color: "#777", marginTop: "3px" }}>{q.referencia_aprobacion}</div>
                                    )}
                                  </div>
                                ) : (
                                  <Badge tone="danger">Sin aprobar</Badge>
                                )}
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {!q.aprobada ? (
                                  <Button variant="outline-green" style={miniBtnStyle} onClick={() => abrirAprobar(q)}>✓ Aprobar</Button>
                                ) : yaTieneOP ? (
                                  <span style={{ color: theme.green, fontSize: "0.7rem" }}>✓ En producción</span>
                                ) : (
                                  <Button variant="gold" style={miniBtnStyle} onClick={() => abrirGenerarOP(q)}>
                                    ⚙️ Generar OP
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* ============ PRODUCCIÓN ============ */}
            {tab === "produccion" && (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <Heading style={{ margin: 0, fontSize: "1rem", textTransform: "uppercase" }}>
                    Órdenes de Producción ({ordenesFiltradas.length})
                  </Heading>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <select style={{ ...inputStyle, width: "auto" }} value={filtroOP} onChange={(e) => setFiltroOP(e.target.value)}>
                      <option value="ABIERTAS">Abiertas</option>
                      <option value="COMPLETADAS">Completadas</option>
                      <option value="TODAS">Todas</option>
                    </select>
                    <Button variant="gold" onClick={() => abrirGenerarOP(null)}>
                      + Orden Manual
                    </Button>
                  </div>
                </div>

                {ordenesFiltradas.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px" }}>
                    <p style={{ color: theme.textMuted, marginBottom: "6px" }}>No hay órdenes de producción.</p>
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
                          const rs = renglonesDe(o);
                          const cfg = configs.find((c) => c.id === rs[0]?.configuracion_id);
                          const completada = o.estado === "Completada";
                          return (
                            <tr key={o.id}>
                              <td style={{ color: theme.gold, fontWeight: 700 }}>
                                {o.numero}
                                {o.cliente_nombre && <div style={{ fontSize: "0.68rem", color: "#777" }}>{o.cliente_nombre}</div>}
                              </td>
                              <td style={{ fontSize: "0.76rem" }}>{o.quote_referencia || "Manual"}</td>
                              <td style={{ fontSize: "0.76rem" }}>
                                {rs.length === 1 ? (
                                  <>
                                    {cfg?.nombre || "—"}
                                    {cfg?.vano_metros && <div style={{ fontSize: "0.66rem", color: "#777" }}>Vano {cfg.vano_metros} m</div>}
                                    {cfg?.con_mensajero && <div style={{ fontSize: "0.66rem", color: "#777" }}>Con mensajero</div>}
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: "#9b59b6", fontWeight: 600 }}>{rs.length} productos</span>
                                    <div style={{ fontSize: "0.66rem", color: "#777" }}>
                                      {rs.map((l) => configs.find((c) => c.id === l.configuracion_id)?.codigo || "?").join(" · ")}
                                    </div>
                                  </>
                                )}
                              </td>
                              <td style={{ fontSize: "0.78rem" }}>
                                {rs.length === 1 ? rs[0].numero_hilos : rs.map((l) => l.numero_hilos).join(" / ")}
                              </td>
                              <td style={{ color: theme.gold, fontWeight: 600 }}>{o.carretes}</td>
                              <td>{num(o.km_totales)} km</td>
                              <td>
                                <select style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: "0.7rem" }}
                                  value={o.estado} disabled={completada}
                                  onChange={(e) => cambiarEstadoOP(o, e.target.value)}>
                                  {ESTADOS_OP.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {o.faltantes && (
                                  <div style={{ fontSize: "0.64rem", color: "#e67e22", marginTop: "3px" }}>Cerró con faltantes</div>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <Button
                                  variant={completada ? "outline-gold" : "outline-green"}
                                  style={miniBtnStyle}
                                  onClick={() => setModalReq({ open: true, orden: o })}
                                >
                                  {completada ? "Ver consumo" : "🧾 Requerimiento"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* ============ RECETAS ============ */}
            {tab === "recetas" && (
              <div>
                <Card style={{ marginBottom: "20px" }}>
                  <label style={lbStyle}>Configuración de producto</label>
                  <select style={{ ...inputStyle, maxWidth: "460px" }} value={configReceta}
                    onChange={(e) => {
                      setConfigReceta(e.target.value);
                      const c = configs.find((x) => String(x.id) === e.target.value);
                      if (c) setSimKmCarrete(c.metros_por_carrete / 1000);
                    }}>
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
                </Card>

                {/* Simulador: convierte las tasas por km en el total de una corrida */}
                <Card style={{ marginBottom: "20px" }}>
                  <Heading style={{ fontSize: "0.95rem", marginBottom: "6px" }}>
                    Simular una Corrida
                  </Heading>
                  <p style={{ color: "#777", fontSize: "0.76rem", margin: "0 0 14px 0" }}>
                    Define hilos y carretes para ver el consumo total, no solo la tasa por kilómetro.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr", gap: "14px", alignItems: "end" }}>
                    <div><label style={lbStyle}>N° de hilos</label>
                      <input style={inputStyle} type="number" min={1} value={simHilos}
                        onChange={(e) => setSimHilos(Number(e.target.value) || 1)} /></div>
                    <div><label style={lbStyle}>Carretes</label>
                      <input style={inputStyle} type="number" min={1} value={simCarretes}
                        onChange={(e) => setSimCarretes(Number(e.target.value) || 1)} /></div>
                    <div><label style={lbStyle}>Km por carrete</label>
                      <input style={inputStyle} type="number" min={0} step="0.5" value={simKmCarrete}
                        onChange={(e) => setSimKmCarrete(Number(e.target.value) || 0)} /></div>
                    <div style={{ background: theme.goldSoft, border: `1px solid ${theme.borderGold}`, borderRadius: theme.radiusSm, padding: "11px 16px" }}>
                      <div style={{ fontSize: "0.66rem", color: "#888", textTransform: "uppercase" }}>Producción total</div>
                      <div style={{ color: theme.gold, fontSize: "1.3rem", fontWeight: 700 }}>{num(simKmTotales)} km</div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <Heading style={{ marginBottom: "6px" }}>
                    Consumo por Kilómetro
                  </Heading>
                  <p style={{ color: "#777", fontSize: "0.76rem", margin: "0 0 16px 0", lineHeight: 1.6 }}>
                    Las líneas de geometría ya están calculadas. Las empíricas dependen de tu máquina:
                    edítalas a mano si conoces el número, o usa <strong style={{ color: theme.gold }}>Calibrar</strong> para
                    deducirlo de un lote real que ya produjiste.
                  </p>

                  {recetasDeConfig.length === 0 ? (
                    <p style={{ color: theme.textMuted, textAlign: "center", padding: "24px" }}>
                      Esta configuración no tiene receta cargada. ¿Corriste el SQL de producción?
                    </p>
                  ) : (
                    <table className="mf-tabla">
                      <thead>
                        <tr>
                          <th>Insumo</th><th>Cálculo</th>
                          <th style={{ textAlign: "right" }}>Cantidad por km</th>
                          <th style={{ textAlign: "right" }}>Total de la corrida</th>
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
                                <span style={{ color: theme.gold, fontWeight: 600 }}>{mp?.codigo}</span>
                                <div style={{ fontSize: "0.72rem", color: "#aaa" }}>{mp?.nombre}</div>
                              </td>
                              <td style={{ fontSize: "0.72rem" }}>
                                {r.tipo_calculo === "por_hilo" ? (
                                  <span style={{ color: "#3498db" }}>× nº de hilos</span>
                                ) : r.tipo_calculo === "empirico" ? (
                                  <span style={{ color: "#e67e22" }}>empírico</span>
                                ) : (
                                  <span style={{ color: theme.green }}>fijo</span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                                  <input style={{ ...inputStyle, width: "110px", textAlign: "right", padding: "6px 8px" }}
                                    type="number" min={0} step="0.0001"
                                    defaultValue={r.cantidad_por_km}
                                    onBlur={(e) => {
                                      const v = Number(e.target.value) || 0;
                                      if (v !== Number(r.cantidad_por_km)) guardarCantidadReceta(r, v);
                                    }} />
                                  <span style={{ fontSize: "0.7rem", color: "#777", width: "28px" }}>{mp?.unidad}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {(() => {
                                  const total = consumoSimulado(r);
                                  const hay = Number(mp?.stock_actual || 0);
                                  const alcanza = total <= hay;
                                  return (
                                    <>
                                      <div style={{ color: total > 0 ? theme.textLight : "#666", fontWeight: 700 }}>
                                        {num(total, 2)} {mp?.unidad}
                                      </div>
                                      {total > 0 && (
                                        <div style={{ fontSize: "0.66rem", color: alcanza ? theme.green : theme.red }}>
                                          {alcanza ? `hay ${num(hay, 1)}` : `faltan ${num(total - hay, 1)}`}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td>
                                {listo ? (
                                  <Badge tone="success">Listo</Badge>
                                ) : (
                                  <span style={{ padding: "3px 9px", borderRadius: "10px", fontSize: "0.66rem", fontWeight: 600, background: "rgba(230,126,34,0.15)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.35)" }}>
                                    Por calibrar
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <Button variant="outline-gold" style={miniBtnStyle} onClick={() => abrirCalibrar(r)}>📐 Calibrar</Button>
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

            {/* ============ INSUMOS ============ */}
            {tab === "insumos" && (
              <Card>
                <Heading style={{ marginBottom: "6px" }}>
                  Existencias de Materia Prima ({insumos.length})
                </Heading>
                <p style={{ color: theme.textMuted, fontSize: "0.76rem", margin: "0 0 16px 0" }}>
                  Datos reales de la tabla materia_prima. Suben con las recepciones de compra y bajan al cerrar producción.
                </p>

                {insumos.length === 0 ? (
                  <p style={{ color: theme.textMuted, textAlign: "center", padding: "24px" }}>No hay insumos cargados.</p>
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
                            <td style={{ color: theme.gold, fontWeight: 700 }}>{m.codigo}</td>
                            <td style={{ fontSize: "0.8rem" }}>{m.nombre}</td>
                            <td style={{ fontSize: "0.74rem", color: "#aaa" }}>{m.categoria || "—"}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: enCero ? theme.red : bajo ? "#e67e22" : theme.green }}>
                              {num(m.stock_actual, 3)}
                            </td>
                            <td style={{ fontSize: "0.74rem", color: "#aaa" }}>{m.unidad}</td>
                            <td>
                              {enCero ? (
                                <Badge tone="danger">Sin stock</Badge>
                              ) : bajo ? (
                                <span style={{ padding: "3px 9px", borderRadius: "10px", fontSize: "0.66rem", fontWeight: 600, background: "rgba(230,126,34,0.15)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.35)" }}>Bajo mínimo</span>
                              ) : (
                                <Badge tone="success">Disponible</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            )}
          </>
        )}
      </div>

      {/* ============ MODAL: APROBAR COTIZACIÓN ============ */}
      {modalAprobar.open && modalAprobar.quote && (
        <div className="mf-ov">
          <Card style={{ maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
            <h2 style={{ color: theme.green, marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>Aprobar Cotización</h2>
            <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "18px" }}>
              <strong style={{ color: theme.gold }}>{modalAprobar.quote.referencia}</strong> — {modalAprobar.quote.empresa}
              <br /><span style={{ fontSize: "0.8rem", color: "#888" }}>Total: {fmt(modalAprobar.quote.total)}</span>
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={lbStyle}>¿Cómo se aprobó?</label>
              <select style={inputStyle} value={formAprob.tipo} onChange={(e) => setFormAprob({ ...formAprob, tipo: e.target.value })}>
                <option value="Correo">Aceptación por correo</option>
                <option value="OC Cliente">Orden de compra del cliente</option>
                <option value="Abono">Abono recibido (parcial)</option>
                <option value="Pago total">Pago total en el portal</option>
              </select>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={lbStyle}>Referencia del respaldo</label>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="N° de OC, transferencia o asunto del correo"
                value={formAprob.referencia} onChange={(e) => setFormAprob({ ...formAprob, referencia: e.target.value })} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={lbStyle}>Aprobada por</label>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Tu nombre" value={formAprob.autor}
                onChange={(e) => setFormAprob({ ...formAprob, autor: e.target.value })} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalAprobar({ open: false, quote: null })}>
                Cancelar
              </Button>
              <Button variant="gold" style={{ background: theme.green, boxShadow: "none" }} onClick={confirmarAprobacion}>Confirmar Aprobación</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ============ MODAL: ORDEN DE PRODUCCIÓN ============ */}
      {modalOP.open && (() => {
        const activas = lineasOP.filter((l) => l.incluir);
        const noReconocidos = lineasOP.filter((l) => !l.reconocido).length;
        return (
          <div className="mf-ov">
            <Card style={{ maxWidth: "980px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
              <h2 style={{ color: theme.gold, marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>
                {modalOP.quote ? `Orden de Producción — ${modalOP.quote.referencia}` : "Orden de Producción Manual"}
              </h2>
              <p style={{ color: "#888", fontSize: "0.78rem", margin: "0 0 16px 0" }}>
                Una sola orden con todos los renglones de la cotización. Cada cable lleva su propia
                configuración, hilos y carretes; el consumo de materia prima se suma.
              </p>

              {noReconocidos > 0 && (
                <div style={{ background: "rgba(230,126,34,0.07)", border: "1px dashed rgba(230,126,34,0.4)",
                  borderRadius: "8px", padding: "12px 16px", marginBottom: "14px" }}>
                  <p style={{ color: "#e67e22", fontSize: "0.78rem", margin: 0 }}>
                    ⚠ {noReconocidos} renglón(es) sin configuración deducida. Suele pasar con cotizaciones
                    viejas que no guardaron vano ni mensajero. Elígela a mano.
                  </p>
                </div>
              )}

              {/* Renglones */}
              <div style={{ border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", overflow: "hidden", marginBottom: "14px" }}>
                <table className="mf-tabla">
                  <thead>
                    <tr>
                      <th style={{ width: "34px" }}></th>
                      <th>Renglón</th>
                      <th style={{ width: "190px" }}>Configuración</th>
                      <th style={{ width: "78px" }}>Hilos</th>
                      <th style={{ width: "78px" }}>Carretes</th>
                      <th style={{ width: "90px" }}>Km/carrete</th>
                      <th style={{ width: "115px" }}>SKU destino</th>
                      <th style={{ textAlign: "right", width: "70px" }}>Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasOP.map((l) => (
                      <tr key={l.key} style={{ opacity: l.incluir ? 1 : 0.4 }}>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={l.incluir}
                            style={{ width: "15px", height: "15px", accentColor: "#DAA520" }}
                            onChange={(e) => actualizarLinea(l.key, "incluir", e.target.checked)} />
                        </td>
                        <td style={{ fontSize: "0.74rem" }}>
                          {l.descripcion}
                          {!l.reconocido && (
                            <div style={{ fontSize: "0.64rem", color: "#e67e22" }}>sin deducir</div>
                          )}
                        </td>
                        <td>
                          <select style={{ ...inputStyle, padding: "5px 7px", fontSize: "0.72rem" }}
                            value={l.configuracion_id}
                            onChange={(e) => {
                              actualizarLinea(l.key, "configuracion_id", e.target.value);
                              const c = configs.find((x) => String(x.id) === e.target.value);
                              if (c) actualizarLinea(l.key, "metros_por_carrete", c.metros_por_carrete);
                            }}>
                            <option value="">— elegir —</option>
                            {configs.map((c) => <option key={c.id} value={String(c.id)}>{c.codigo}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" min={1} value={l.numero_hilos}
                            style={{ ...inputStyle, padding: "5px", textAlign: "center", fontSize: "0.74rem" }}
                            onChange={(e) => actualizarLinea(l.key, "numero_hilos", Number(e.target.value) || 1)} />
                        </td>
                        <td>
                          <input type="number" min={1} value={l.carretes}
                            style={{ ...inputStyle, padding: "5px", textAlign: "center", fontSize: "0.74rem" }}
                            onChange={(e) => actualizarLinea(l.key, "carretes", Number(e.target.value) || 1)} />
                        </td>
                        <td>
                          <input type="number" min={0} step="0.5"
                            value={(Number(l.metros_por_carrete) || 0) / 1000}
                            style={{ ...inputStyle, padding: "5px", textAlign: "center", fontSize: "0.74rem" }}
                            onChange={(e) => actualizarLinea(l.key, "metros_por_carrete", (Number(e.target.value) || 0) * 1000)} />
                        </td>
                        <td>
                          <input placeholder="cablesdb" value={l.sku_destino}
                            style={{ ...inputStyle, padding: "5px", fontSize: "0.72rem" }}
                            onChange={(e) => actualizarLinea(l.key, "sku_destino", e.target.value)} />
                        </td>
                        <td style={{ textAlign: "right", color: theme.gold, fontWeight: 700, fontSize: "0.78rem" }}>
                          {num(kmDeLinea(l))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <Button variant="outline-gold" style={miniBtnStyle} onClick={agregarLineaManual}>+ Agregar renglón</Button>
                <div style={{ background: theme.goldSoft, border: `1px solid ${theme.borderGold}`,
                  borderRadius: "8px", padding: "9px 18px" }}>
                  <span style={{ color: theme.textLight, fontSize: "0.84rem" }}>
                    {activas.length} renglón(es) ={" "}
                    <strong style={{ color: theme.gold, fontSize: "1.05rem" }}>{num(kmTotalOP)} km</strong> de cable
                  </span>
                </div>
              </div>

              {/* Requerimiento consolidado */}
              {previewOP.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <p style={{ fontSize: "0.7rem", color: theme.gold, margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Materia prima total de la orden
                  </p>
                  <div style={{ maxHeight: "215px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px" }}>
                    <table className="mf-tabla">
                      <thead><tr><th>Insumo</th><th style={{ textAlign: "right" }}>Requiere</th><th style={{ textAlign: "right" }}>Hay</th><th>Estado</th></tr></thead>
                      <tbody>
                        {previewOP.map((l: any) => (
                          <tr key={l.materia_prima_id}>
                            <td style={{ fontSize: "0.76rem" }}>
                              <span style={{ color: theme.gold }}>{l.codigo}</span>
                              <div style={{ fontSize: "0.66rem", color: "#777" }}>{l.nombre}</div>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                              {l.sinReceta ? <span style={{ color: "#e67e22" }}>sin receta</span> : `${num(l.requerido, 3)} ${l.unidad}`}
                            </td>
                            <td style={{ textAlign: "right", color: "#aaa" }}>{num(l.disponible, 2)}</td>
                            <td>
                              {l.sinReceta ? <span style={{ color: "#e67e22", fontSize: "0.7rem" }}>calibrar</span>
                                : l.falta > 0 ? <span style={{ color: theme.red, fontSize: "0.7rem" }}>faltan {num(l.falta, 2)}</span>
                                : <span style={{ color: theme.green, fontSize: "0.7rem" }}>✓ alcanza</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "18px" }}>
                <label style={lbStyle}>Notas de la orden</label>
                <textarea rows={2} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }} value={notasOP}
                  onChange={(e) => setNotasOP(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="ghost" onClick={() => { setModalOP({ open: false, quote: null }); setLineasOP([]); }}>
                  Cancelar
                </Button>
                <Button variant="gold" disabled={guardandoOP || activas.length === 0} onClick={crearOrdenProduccion}>
                  {guardandoOP ? "Creando..." : `Crear Orden (${activas.length} renglón${activas.length !== 1 ? "es" : ""})`}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ============ MODAL: REQUERIMIENTO Y CIERRE ============ */}
      {modalReq.open && modalReq.orden && (() => {
        const o = modalReq.orden!;
        const renglones = renglonesDe(o);
        const req = requerimientoOrden(o);
        const completada = o.estado === "Completada";
        const faltantes = req.filter((r) => r.falta > 0).length;
        const conSku = renglones.filter((l) => l.sku_destino);

        return (
          <div className="mf-ov">
            <Card style={{ maxWidth: "780px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
              <h2 style={{ color: completada ? theme.gold : theme.green, marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>
                {completada ? "Consumo de la Orden" : "Requerimiento de Materia Prima"}
              </h2>
              <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "16px" }}>
                <strong style={{ color: theme.gold }}>{o.numero}</strong>
                {o.cliente_nombre ? ` — ${o.cliente_nombre}` : ""}
                <br />
                <span style={{ fontSize: "0.8rem", color: "#888" }}>
                  {renglones.length} renglón(es) · {num(o.km_totales)} km en total
                </span>
              </p>

              {/* Renglones de la orden */}
              <div style={{ border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                <table className="mf-tabla">
                  <thead><tr><th>#</th><th>Producto</th><th style={{ textAlign: "center" }}>Hilos</th><th style={{ textAlign: "center" }}>Carretes</th><th style={{ textAlign: "right" }}>Km</th><th>SKU destino</th></tr></thead>
                  <tbody>
                    {renglones.map((l) => {
                      const cfg = configs.find((c) => c.id === l.configuracion_id);
                      return (
                        <tr key={l.id}>
                          <td style={{ color: "#666", fontSize: "0.74rem" }}>{l.posicion}</td>
                          <td style={{ fontSize: "0.76rem" }}>
                            <span style={{ color: theme.gold }}>{cfg?.codigo || "—"}</span>
                            {cfg?.vano_metros && <div style={{ fontSize: "0.66rem", color: "#777" }}>vano {cfg.vano_metros} m</div>}
                            {cfg?.con_mensajero && <div style={{ fontSize: "0.66rem", color: "#777" }}>con mensajero</div>}
                          </td>
                          <td style={{ textAlign: "center" }}>{l.numero_hilos}</td>
                          <td style={{ textAlign: "center", color: theme.gold, fontWeight: 600 }}>{l.carretes}</td>
                          <td style={{ textAlign: "right" }}>{num(l.km_totales)}</td>
                          <td style={{ fontSize: "0.72rem", color: l.sku_destino ? "#aaa" : "#e67e22" }}>
                            {l.sku_destino || "sin SKU"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: "0.7rem", color: theme.gold, margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Consumo consolidado de todos los renglones
              </p>
              <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", marginBottom: "16px" }}>
                <table className="mf-tabla">
                  <thead><tr><th>Insumo</th><th style={{ textAlign: "right" }}>Requiere</th><th style={{ textAlign: "right" }}>Existencia</th><th>Estado</th></tr></thead>
                  <tbody>
                    {req.map((l: any) => (
                      <tr key={l.materia_prima_id}>
                        <td style={{ fontSize: "0.76rem" }}>
                          <span style={{ color: theme.gold }}>{l.codigo}</span>
                          <div style={{ fontSize: "0.66rem", color: "#777" }}>{l.nombre}</div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: l.sinReceta ? "#e67e22" : theme.textLight }}>
                          {l.sinReceta ? "sin receta" : `${num(l.requerido, 3)} ${l.unidad}`}
                        </td>
                        <td style={{ textAlign: "right", color: "#aaa" }}>{num(l.disponible, 2)} {l.unidad}</td>
                        <td>
                          {l.sinReceta ? <span style={{ color: "#e67e22", fontSize: "0.7rem" }}>no descuenta</span>
                            : l.falta > 0 ? <span style={{ color: theme.red, fontSize: "0.7rem" }}>faltan {num(l.falta, 2)}</span>
                            : <span style={{ color: theme.green, fontSize: "0.7rem" }}>✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!completada && (
                <div style={{ background: theme.greenBg, border: `1px dashed ${theme.greenBorder}`, borderRadius: "8px", padding: "13px 16px", marginBottom: "16px" }}>
                  <p style={{ fontSize: "0.7rem", color: theme.green, margin: "0 0 8px 0", textTransform: "uppercase" }}>Al cerrar la producción</p>
                  <ul style={{ color: "#ccc", fontSize: "0.78rem", margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
                    <li>Se descuenta la materia prima de cada renglón por separado</li>
                    <li>Cada movimiento queda registrado con su renglón de origen</li>
                    {conSku.length > 0
                      ? <li>Entran a bodega: {conSku.map((l) => `${l.carretes} de ${l.sku_destino}`).join(", ")}</li>
                      : <li style={{ color: "#e67e22" }}>Ningún renglón tiene SKU destino: nada entrará a bodega</li>}
                  </ul>
                  {faltantes > 0 && (
                    <p style={{ color: theme.red, fontSize: "0.74rem", margin: "10px 0 0 0" }}>
                      ⚠ {faltantes} insumo(s) sin existencia suficiente. Se puede cerrar, pero el stock quedará negativo.
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="ghost" onClick={() => setModalReq({ open: false, orden: null })}>
                  {completada ? "Cerrar" : "Cancelar"}
                </Button>
                {!completada && (
                  <Button variant="gold" style={{ background: theme.green, boxShadow: "none" }} disabled={cerrando} onClick={cerrarProduccion}>
                    {cerrando ? "Procesando..." : "Cerrar Producción"}
                  </Button>
                )}
              </div>
            </Card>
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
            <Card style={{ maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto", marginBottom: 0 }}>
              <h2 style={{ color: theme.gold, marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>Calibrar Receta</h2>
              <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "8px" }}>
                <strong style={{ color: theme.gold }}>{mp?.codigo}</strong> — {mp?.nombre}
              </p>
              <p style={{ color: theme.textMuted, fontSize: "0.76rem", marginBottom: "18px", lineHeight: 1.6 }}>
                Anota lo que realmente consumiste en un lote ya producido. El sistema deduce el consumo por km
                y actualiza la receta. Con dos o tres lotes el número deja de ser estimado.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div><label style={lbStyle}>Km producidos</label>
                  <input style={inputStyle} type="number" min={0} step="0.01" value={formCal.km_producidos}
                    onChange={(e) => setFormCal({ ...formCal, km_producidos: Number(e.target.value) || 0 })} /></div>
                <div><label style={lbStyle}>Consumo real ({mp?.unidad})</label>
                  <input style={inputStyle} type="number" min={0} step="0.01" value={formCal.consumo_real}
                    onChange={(e) => setFormCal({ ...formCal, consumo_real: Number(e.target.value) || 0 })} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={lbStyle}>Registrado por</label>
                  <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Tu nombre" value={formCal.autor}
                    onChange={(e) => setFormCal({ ...formCal, autor: e.target.value })} /></div>
              </div>

              <div style={{ background: theme.goldSoft, border: `1px dashed ${theme.borderGold}`, borderRadius: "8px", padding: "14px", marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "6px" }}>
                  <span style={{ color: "#888" }}>Receta actual</span>
                  <strong style={{ color: "#aaa" }}>{num(r.cantidad_por_km, 4)} {mp?.unidad}/km</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <span style={{ color: "#888" }}>Nueva receta</span>
                  <strong style={{ color: theme.green, fontSize: "1rem" }}>{num(resultado, 4)} {mp?.unidad}/km</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="ghost" onClick={() => setModalCal({ open: false, receta: null })}>
                  Cancelar
                </Button>
                <Button variant="gold" onClick={aplicarCalibracion}>Aplicar Calibración</Button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
