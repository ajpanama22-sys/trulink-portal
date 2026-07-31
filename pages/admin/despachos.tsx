import { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

/* ============================================================
   CENTRO DE DESPACHOS EXW — TRULINK FIBER LLC
   ------------------------------------------------------------
   Qué cambió respecto a la versión anterior:

   1. LA VERIFICACIÓN DE PAGO YA NO ES UN CHECKBOX.
      Antes se le preguntaba al operador si estaba pagado y se
      confiaba en su respuesta. Ahora se consulta el saldo real
      en cuentas_por_cobrar. La regla EXW se cumple de verdad.

   2. LA PESTAÑA DE PRODUCTOS YA FUNCIONA.
      Antes filtraba por tipo_cotizacion, un campo que nunca
      existió, así que todo caía en "fábrica" y la otra pestaña
      quedaba siempre vacía. Ahora filtra por quotes.type.

   3. EL INVENTARIO SE DESCUENTA DE VERDAD.
      Antes el desplegable decía "descuenta insumos" pero no
      descontaba nada. Ahora rebaja el stock y deja el
      movimiento registrado.

   4. SE VERIFICA QUE HAYA QUÉ DESPACHAR.
      Fabricación: exige una orden de producción completada.
      Productos: exige stock suficiente en bodega.
   ============================================================ */

type Quote = {
  id: string | number;
  referencia: string;
  empresa: string | null;
  representante: string | null;
  email: string | null;
  status: string | null;
  type: string | null;
  tipo?: string | null;        // alias antiguo, algunas cotizaciones viejas lo usan
  total: number;
  items: any;
  created_at: string | null;
  fecha_estimada_entrega: string | null;
  pagado_total: boolean | null;
  origen_despacho: string | null;
  encargado_despacho: string | null;
  supervisor: string | null;
  transportista: string | null;
  guia_envio: string | null;
  fecha_despacho: string | null;
  saldo_al_despachar: number | null;
  autorizacion_excepcional: string | null;
};

type CuentaCobrar = {
  id: number;
  quote_id: string | null;
  quote_referencia: string | null;
  monto_total: number;
  saldo_pendiente: number;
  estado: string;
};

type OrdenProduccion = {
  id: number;
  numero: string | null;
  quote_id: string | null;
  estado: string;
  carretes: number;
  sku_destino: string | null;
};

type LineaDespacho = {
  sku: string;
  descripcion: string;
  cantidad: number;
  tabla: string | null;
  idProducto: any;
  stockActual: number;
  alcanza: boolean;
};

const TABLAS_BODEGA = ["cablesdb", "accesoriosdb", "herrajesdb"];

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (n: any, d = 2) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });

/** Los items de quotes vienen en formatos distintos según la antigüedad. */
const parseItems = (v: any): any[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return [v];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [p];
  } catch {
    return [];
  }
};

export default function DespachosDashboard() {
  const supabase = getSupabase();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCobrar[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [cargando, setCargando] = useState(true);

  const [pestana, setPestana] = useState<"fabrica" | "producto">("fabrica");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("PENDIENTES");

  // --- Modal de despacho ---
  const [sel, setSel] = useState<Quote | null>(null);
  const [lineas, setLineas] = useState<LineaDespacho[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [despachando, setDespachando] = useState(false);
  const [form, setForm] = useState({
    encargado: "", supervisor: "", transportista: "", guia: "", notas: "",
  });
  const [autorizacionExcepcional, setAutorizacionExcepcional] = useState("");

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [qRes, cRes, oRes] = await Promise.all([
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("cuentas_por_cobrar").select("id, quote_id, quote_referencia, monto_total, saldo_pendiente, estado"),
        supabase.from("ordenes_produccion").select("id, numero, quote_id, estado, carretes, sku_destino"),
      ]);
      if (qRes.error) console.error("quotes:", qRes.error.message);
      if (cRes.error) console.error("cuentas_por_cobrar (¿corriste el SQL?):", cRes.error.message);
      if (oRes.error) console.error("ordenes_produccion:", oRes.error.message);

      setQuotes(qRes.data || []);
      setCuentas(cRes.data || []);
      setOrdenes(oRes.data || []);
    } catch (err) {
      console.error("Error cargando despachos:", err);
    } finally {
      setCargando(false);
    }
  };

  const auditar = async (accion: string, id: any, detalle: string, autor?: string) => {
    if (!supabase) return;
    try {
      await supabase.from("audit_log").insert([{
        accion, entidad: "despacho",
        entidad_id: id != null ? String(id) : null, detalle, autor: autor || null,
      }]);
    } catch { /* nunca frena el despacho */ }
  };

  /* ========================================================
     VERIFICACIONES
     ======================================================== */

  /** Saldo real del cliente para esa cotización. */
  const cuentaDe = (q: Quote): CuentaCobrar | undefined =>
    cuentas.find(
      (c) => String(c.quote_id) === String(q.id) || c.quote_referencia === q.referencia
    );

  /**
   * Estado de pago REAL, no declarado.
   *   sin_cuenta -> todavía no se ha facturado
   *   pagado     -> saldo en cero
   *   parcial    -> hay saldo pendiente
   */
  const estadoPago = (q: Quote) => {
    const c = cuentaDe(q);
    if (!c) return { estado: "sin_cuenta" as const, saldo: Number(q.total || 0), cuenta: undefined };
    const saldo = Number(c.saldo_pendiente || 0);
    return {
      estado: saldo <= 0.009 ? ("pagado" as const) : ("parcial" as const),
      saldo,
      cuenta: c,
    };
  };

  /** Orden de producción completada asociada a la cotización. */
  const produccionDe = (q: Quote): OrdenProduccion | undefined =>
    ordenes.find((o) => String(o.quote_id) === String(q.id) && o.estado === "Completada");

  /**
   * Busca cada SKU de la cotización en las tres tablas de bodega
   * y compara la cantidad pedida contra la existencia real.
   */
  const verificarStock = async (q: Quote): Promise<LineaDespacho[]> => {
    if (!supabase) return [];
    const items = parseItems(q.items);
    const salida: LineaDespacho[] = [];

    for (const it of items) {
      const sku = String(it.SKU || it.sku || it.codigo || "").trim();
      const cantidad = Number(it.cantidad || it.quantity || 1);
      const descripcion = it.descripcion || it.Descripción || it.description || sku;

      if (!sku) {
        salida.push({ sku: "(sin SKU)", descripcion, cantidad, tabla: null, idProducto: null, stockActual: 0, alcanza: false });
        continue;
      }

      let encontrado = false;
      for (const tabla of TABLAS_BODEGA) {
        const { data } = await supabase
          .from(tabla).select("id, cantidad")
          .or(`SKU.eq.${sku},sku.eq.${sku}`).maybeSingle();

        if (data) {
          const stock = Number(data.cantidad || 0);
          salida.push({
            sku, descripcion, cantidad, tabla, idProducto: data.id,
            stockActual: stock, alcanza: stock >= cantidad,
          });
          encontrado = true;
          break;
        }
      }

      if (!encontrado) {
        salida.push({ sku, descripcion, cantidad, tabla: null, idProducto: null, stockActual: 0, alcanza: false });
      }
    }
    return salida;
  };

  /* ========================================================
     ABRIR EL MODAL
     ======================================================== */

  const abrirDespacho = async (q: Quote) => {
    setSel(q);
    setForm({
      encargado: q.encargado_despacho || "",
      supervisor: q.supervisor || "",
      transportista: q.transportista || "",
      guia: q.guia_envio || "",
      notas: "",
    });
    setAutorizacionExcepcional("");
    setLineas([]);

    // Solo los productos de bodega requieren verificar existencias.
    // Lo fabricado se valida contra la orden de producción.
    if (pestana === "producto") {
      setVerificando(true);
      const l = await verificarStock(q);
      setLineas(l);
      setVerificando(false);
    }
  };

  /* ========================================================
     EJECUTAR EL DESPACHO
     ======================================================== */

  const ejecutarDespacho = async () => {
    const q = sel;
    if (!q || !supabase) return;

    const pago = estadoPago(q);
    const prod = produccionDe(q);

    // --- Validaciones de forma ---
    if (!form.encargado.trim() || !form.supervisor.trim()) {
      return alert("El encargado de despacho y el supervisor son obligatorios. Son los responsables de la salida.");
    }

    // --- Regla EXW: cancelado al 100% ---
    if (pago.estado !== "pagado") {
      const motivo = pago.estado === "sin_cuenta"
        ? "Esta cotización todavía no tiene cuenta por cobrar generada."
        : `Queda un saldo pendiente de ${fmt(pago.saldo)}.`;

      if (!autorizacionExcepcional.trim()) {
        return alert(
          `RESTRICCIÓN EXW — no se puede despachar.\n\n${motivo}\n\n` +
          `La condición EXW exige el pago total antes de la salida.\n\n` +
          `Si existe una autorización de la gerencia, escríbela en el campo de autorización excepcional. Quedará registrada.`
        );
      }

      if (!confirm(
        `⚠️ DESPACHO CON SALDO PENDIENTE\n\n${motivo}\n\n` +
        `Motivo: ${autorizacionExcepcional}\n\n` +
        `Esto queda registrado en la auditoría con tu nombre. ¿Confirmas?`
      )) return;
    }

    // --- Verificar que exista qué despachar ---
    if (pestana === "fabrica" && !prod) {
      if (!confirm(
        "No hay una orden de producción completada para esta cotización.\n\n" +
        "El cable podría no estar fabricado todavía. ¿Despachar de todos modos?"
      )) return;
    }

    const faltantes = lineas.filter((l) => !l.alcanza);
    if (pestana === "producto" && faltantes.length > 0) {
      const det = faltantes.map((l) =>
        l.tabla ? `${l.sku}: pide ${l.cantidad}, hay ${l.stockActual}` : `${l.sku}: no existe en bodega`
      ).join("\n");
      if (!confirm(`Hay problemas de existencia:\n\n${det}\n\n¿Despachar igual? El stock quedará en negativo.`)) return;
    }

    setDespachando(true);
    const errores: string[] = [];

    try {
      // --- Descuento de inventario ---
      if (pestana === "producto") {
        for (const l of lineas) {
          if (!l.tabla || l.idProducto == null) {
            errores.push(`${l.sku}: no se pudo descontar, no existe en bodega`);
            continue;
          }
          const despues = Number((l.stockActual - l.cantidad).toFixed(3));

          const { error } = await supabase.from(l.tabla)
            .update({ cantidad: despues }).eq("id", l.idProducto);
          if (error) { errores.push(`${l.sku}: ${error.message}`); continue; }

          await supabase.from("movimientos_inventario").insert([{
            tipo: "salida", origen: "venta", referencia_id: String(q.id),
            destino: "bodega", tabla_bodega: l.tabla, sku_bodega: l.sku,
            descripcion: l.descripcion,
            cantidad_anterior: l.stockActual, cantidad: l.cantidad, cantidad_nueva: despues,
            unidad: "und", motivo: `Despacho EXW ${q.referencia}`,
            autor: form.encargado || null,
          }]);
        }
      } else if (prod?.sku_destino) {
        // Lo fabricado entró a cablesdb al cerrar la producción.
        // Al despacharlo, sale.
        const { data: p } = await supabase
          .from("cablesdb").select("id, cantidad")
          .or(`SKU.eq.${prod.sku_destino},sku.eq.${prod.sku_destino}`).maybeSingle();

        if (p) {
          const antes = Number(p.cantidad || 0);
          const despues = antes - Number(prod.carretes || 0);
          await supabase.from("cablesdb").update({ cantidad: despues }).eq("id", p.id);
          await supabase.from("movimientos_inventario").insert([{
            tipo: "salida", origen: "venta", referencia_id: String(q.id),
            destino: "bodega", tabla_bodega: "cablesdb", sku_bodega: prod.sku_destino,
            descripcion: `Cable fabricado — orden ${prod.numero}`,
            cantidad_anterior: antes, cantidad: Number(prod.carretes || 0), cantidad_nueva: despues,
            unidad: "carrete", motivo: `Despacho EXW ${q.referencia}`,
            autor: form.encargado || null,
          }]);
        } else {
          errores.push(`SKU ${prod.sku_destino}: no existe en cablesdb`);
        }
      }

      // --- Marcar la cotización como despachada ---
      const { error: errUpd } = await supabase.from("quotes").update({
        status: "despachado_exw",
        pagado_total: pago.estado === "pagado",
        origen_despacho: pestana === "fabrica" ? "manufactura" : "bodega",
        encargado_despacho: form.encargado,
        supervisor: form.supervisor,
        transportista: form.transportista || null,
        guia_envio: form.guia || null,
        fecha_despacho: new Date().toISOString(),
        saldo_al_despachar: pago.saldo,
        autorizacion_excepcional: pago.estado === "pagado" ? null : autorizacionExcepcional,
        notas_despacho: form.notas || null,
      }).eq("id", q.id);

      if (errUpd) throw errUpd;

      auditar(
        pago.estado === "pagado" ? "despacho_exw" : "despacho_excepcional",
        q.id,
        `${q.referencia} despachado a ${q.empresa}. ` +
        `Encargado: ${form.encargado}, supervisor: ${form.supervisor}. ` +
        (form.guia ? `Guía ${form.guia}. ` : "") +
        (pago.estado === "pagado"
          ? "Pago verificado al 100%."
          : `SALDO PENDIENTE ${fmt(pago.saldo)}. Autorización: ${autorizacionExcepcional}`),
        form.supervisor
      );

      setSel(null);
      cargar();

      if (errores.length > 0) alert("Despacho registrado con avisos:\n\n" + errores.join("\n"));
      else alert(`Despacho de ${q.referencia} autorizado y registrado bajo EXW Panamá.`);
    } catch (err: any) {
      alert("Error al ejecutar el despacho: " + (err.message || err));
    } finally {
      setDespachando(false);
    }
  };

  /* ========================================================
     DERIVADOS
     ======================================================== */

  /**
   * Filtra por el campo REAL "type", no por tipo_cotizacion.
   * Ese campo nunca existió: por eso antes todo caía en la
   * pestaña de fábrica y la de productos quedaba vacía.
   */
  const deLaPestana = quotes.filter((q) => {
    const t = String(q.type || q.tipo || "").toLowerCase();
    return pestana === "fabrica" ? t.includes("fabric") : !t.includes("fabric");
  });

  const filtrados = deLaPestana.filter((q) => {
    const desp = q.status === "despachado_exw";
    if (filtroEstado === "PENDIENTES" && desp) return false;
    if (filtroEstado === "DESPACHADOS" && !desp) return false;
    if (filtroEstado === "LISTOS") {
      if (desp) return false;
      if (estadoPago(q).estado !== "pagado") return false;
    }
    const t = busqueda.toLowerCase().trim();
    if (!t) return true;
    return [q.referencia, q.empresa, q.guia_envio, q.representante]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
  });

  const kpis = useMemo(() => {
    const pend = deLaPestana.filter((q) => q.status !== "despachado_exw");
    return {
      total: deLaPestana.length,
      listos: pend.filter((q) => estadoPago(q).estado === "pagado").length,
      bloqueados: pend.filter((q) => estadoPago(q).estado !== "pagado").length,
      despachados: deLaPestana.filter((q) => q.status === "despachado_exw").length,
    };
  }, [deLaPestana, cuentas]);

  const acento = pestana === "fabrica" ? "#3498db" : "#9b59b6";

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <div style={{ display: "flex", backgroundColor: "#000", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="despachos" />

      <main style={{ flex: 1, padding: "35px 30px", color: "#DAA520", boxSizing: "border-box", overflowX: "auto" }}>
        <style jsx global>{`
          .dp-card { background:#080808; border:1px solid rgba(218,165,32,0.3); border-radius:12px; padding:22px; }
          .dp-kpi { background:#0d0d0d; border:1px solid rgba(218,165,32,0.25); border-radius:10px; padding:16px 18px; }
          .dp-in { background:#050505; color:#DAA520; border:1px solid rgba(218,165,32,0.4);
                   padding:9px 11px; border-radius:6px; outline:none; font-size:0.82rem;
                   box-sizing:border-box; font-family:inherit; width:100%; }
          .dp-lb { display:block; font-size:0.66rem; color:rgba(255,255,255,0.55); margin-bottom:5px;
                   text-transform:uppercase; letter-spacing:0.5px; }
          .dp-gold { background:#DAA520; color:#000; border:none; padding:9px 16px; border-radius:6px;
                     font-weight:700; font-size:0.76rem; cursor:pointer; }
          .dp-gold:disabled { opacity:.5; cursor:not-allowed; }
          .dp-ghost { background:transparent; color:#aaa; border:1px solid #444; padding:9px 18px;
                      border-radius:6px; cursor:pointer; font-size:0.78rem; }
          .dp-chip { padding:3px 9px; border-radius:10px; font-size:0.66rem; font-weight:600; white-space:nowrap; }
          .dp-tabla { width:100%; border-collapse:collapse; font-size:0.82rem; }
          .dp-tabla th { background:#0a0a0a; color:#DAA520; text-transform:uppercase; font-size:0.66rem;
                         letter-spacing:1px; padding:11px 10px; text-align:left;
                         border-bottom:1px solid rgba(218,165,32,0.35); }
          .dp-tabla td { padding:11px 10px; color:#fff; border-bottom:1px solid #141414; }
          .dp-ov { position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center;
                   justify-content:center; z-index:1000; padding:20px; }
          .dp-md { background:#0a0a0a; border:1px solid rgba(218,165,32,0.5); border-radius:12px;
                   padding:26px; width:100%; max-height:90vh; overflow-y:auto; }
        `}</style>

        <div style={{ marginBottom: "22px" }}>
          <span style={{ fontSize: "0.68rem", color: "rgba(218,165,32,0.7)", letterSpacing: "3px", textTransform: "uppercase", display: "block", marginBottom: "5px" }}>
            Trulink Fiber LLC — Logística Global
          </span>
          <h1 style={{ color: "#DAA520", fontSize: "1.5rem", fontWeight: 300, letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 6px 0" }}>
            Centro de Despachos EXW Panamá
          </h1>
          <p style={{ color: "#888", fontSize: "0.8rem", margin: 0 }}>
            La salida solo se autoriza con el pago verificado contra las cuentas por cobrar reales.
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "22px" }}>
          <div className="dp-kpi">
            <span className="dp-lb">Listos para Despachar</span>
            <h2 style={{ color: "#2ecc71", fontSize: "1.5rem", margin: "5px 0 0 0", fontWeight: 400 }}>{kpis.listos}</h2>
            <span style={{ fontSize: "0.68rem", color: "#666" }}>Pago verificado al 100%</span>
          </div>
          <div className="dp-kpi">
            <span className="dp-lb">Bloqueados por Pago</span>
            <h2 style={{ color: kpis.bloqueados > 0 ? "#e74c3c" : "#666", fontSize: "1.5rem", margin: "5px 0 0 0", fontWeight: 400 }}>{kpis.bloqueados}</h2>
            <span style={{ fontSize: "0.68rem", color: "#666" }}>Con saldo o sin facturar</span>
          </div>
          <div className="dp-kpi">
            <span className="dp-lb">Despachados</span>
            <h2 style={{ color: "#DAA520", fontSize: "1.5rem", margin: "5px 0 0 0", fontWeight: 400 }}>{kpis.despachados}</h2>
          </div>
          <div className="dp-kpi">
            <span className="dp-lb">Total en esta Línea</span>
            <h2 style={{ color: "#fff", fontSize: "1.5rem", margin: "5px 0 0 0", fontWeight: 400 }}>{kpis.total}</h2>
          </div>
        </div>

        {/* Pestañas */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "22px", borderBottom: "1px solid rgba(218,165,32,0.2)", paddingBottom: "15px", flexWrap: "wrap" }}>
          <button onClick={() => { setPestana("fabrica"); setSel(null); }}
            style={{
              padding: "12px 22px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold",
              fontSize: "0.82rem", letterSpacing: "1px", textTransform: "uppercase",
              border: pestana === "fabrica" ? "1px solid #3498db" : "1px solid rgba(218,165,32,0.3)",
              background: pestana === "fabrica" ? "rgba(52,152,219,0.15)" : "#080808",
              color: pestana === "fabrica" ? "#3498db" : "rgba(255,255,255,0.6)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
            🏭 Línea de Fábrica
            <span style={{ fontSize: "0.68rem", background: "rgba(52,152,219,0.2)", padding: "2px 6px", borderRadius: "4px" }}>
              Cable fabricado
            </span>
          </button>

          <button onClick={() => { setPestana("producto"); setSel(null); }}
            style={{
              padding: "12px 22px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold",
              fontSize: "0.82rem", letterSpacing: "1px", textTransform: "uppercase",
              border: pestana === "producto" ? "1px solid #9b59b6" : "1px solid rgba(218,165,32,0.3)",
              background: pestana === "producto" ? "rgba(155,89,182,0.15)" : "#080808",
              color: pestana === "producto" ? "#9b59b6" : "rgba(255,255,255,0.6)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
            📦 Productos Terminados
            <span style={{ fontSize: "0.68rem", background: "rgba(155,89,182,0.2)", padding: "2px 6px", borderRadius: "4px" }}>
              Bodega comercial
            </span>
          </button>
        </div>

        <div className="dp-card">
          <div style={{
            backgroundColor: `${acento}0d`, border: `1px solid ${acento}4d`,
            padding: "15px 20px", borderRadius: "8px", marginBottom: "20px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px",
          }}>
            <div>
              <h2 style={{ fontSize: "0.92rem", color: acento, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "1px" }}>
                {pestana === "fabrica" ? "⚙️ Despachos de Cable Fabricado" : "📦 Despachos desde Bodega"}
              </h2>
              <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>
                {pestana === "fabrica"
                  ? "Exige una orden de producción completada. Al despachar, sale de bodega el cable que la producción había ingresado."
                  : "Verifica existencias en los tres catálogos y descuenta el stock al autorizar la salida."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <select className="dp-in" style={{ width: "auto" }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="PENDIENTES">Pendientes</option>
                <option value="LISTOS">Solo listos (pagados)</option>
                <option value="DESPACHADOS">Despachados</option>
                <option value="TODOS">Todos</option>
              </select>
              <input className="dp-in" style={{ width: "230px" }} placeholder="Referencia, empresa o guía..."
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>

          {cargando ? (
            <p style={{ textAlign: "center", color: "#777", padding: "35px" }}>Cargando despachos...</p>
          ) : filtrados.length === 0 ? (
            <p style={{ textAlign: "center", color: "#777", fontStyle: "italic", padding: "35px" }}>
              No hay registros en esta sección.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="dp-tabla">
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th>Cliente</th>
                    <th>Estado de Pago (real)</th>
                    <th>{pestana === "fabrica" ? "Producción" : "Ítems"}</th>
                    <th>Responsables</th>
                    <th>Guía / Estado</th>
                    <th style={{ textAlign: "right" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((q) => {
                    const pago = estadoPago(q);
                    const prod = produccionDe(q);
                    const desp = q.status === "despachado_exw";
                    const items = parseItems(q.items);

                    return (
                      <tr key={q.id}>
                        <td>
                          <span style={{ color: "#DAA520", fontWeight: 700 }}>{q.referencia}</span>
                          <div style={{ fontSize: "0.68rem", color: "#777" }}>
                            {q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"} · {fmt(q.total)}
                          </div>
                        </td>
                        <td>
                          {q.empresa || "N/D"}
                          {q.representante && <div style={{ fontSize: "0.68rem", color: "#777" }}>{q.representante}</div>}
                        </td>
                        <td>
                          {pago.estado === "pagado" ? (
                            <span className="dp-chip" style={{ background: "rgba(46,204,113,0.15)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.35)" }}>
                              ✓ CANCELADO 100%
                            </span>
                          ) : pago.estado === "parcial" ? (
                            <>
                              <span className="dp-chip" style={{ background: "rgba(231,76,60,0.15)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.35)" }}>
                                SALDO PENDIENTE
                              </span>
                              <div style={{ fontSize: "0.7rem", color: "#e74c3c", marginTop: "3px" }}>{fmt(pago.saldo)}</div>
                            </>
                          ) : (
                            <>
                              <span className="dp-chip" style={{ background: "rgba(230,126,34,0.15)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.35)" }}>
                                SIN FACTURAR
                              </span>
                              <div style={{ fontSize: "0.66rem", color: "#777", marginTop: "3px" }}>Genera la CxC primero</div>
                            </>
                          )}
                        </td>
                        <td style={{ fontSize: "0.74rem" }}>
                          {pestana === "fabrica" ? (
                            prod ? (
                              <>
                                <span style={{ color: "#2ecc71" }}>✓ {prod.numero}</span>
                                <div style={{ fontSize: "0.66rem", color: "#777" }}>{prod.carretes} carrete(s)</div>
                              </>
                            ) : (
                              <span style={{ color: "#e67e22" }}>sin producción</span>
                            )
                          ) : (
                            <span style={{ color: "#aaa" }}>{items.length} ítem(s)</span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.72rem" }}>
                          <div><span style={{ color: "#777" }}>Enc:</span> {q.encargado_despacho || "—"}</div>
                          <div><span style={{ color: "#777" }}>Sup:</span> {q.supervisor || "—"}</div>
                        </td>
                        <td>
                          <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#DAA520" }}>
                            {q.guia_envio || "S/G"}
                          </div>
                          <span className="dp-chip" style={{
                            background: desp ? "rgba(46,204,113,0.15)" : "rgba(241,196,15,0.15)",
                            color: desp ? "#2ecc71" : "#f1c40f",
                            border: `1px solid ${desp ? "rgba(46,204,113,0.35)" : "rgba(241,196,15,0.35)"}`,
                          }}>
                            {desp ? "despachado" : q.status || "pendiente"}
                          </span>
                          {q.autorizacion_excepcional && (
                            <div style={{ fontSize: "0.64rem", color: "#e67e22", marginTop: "3px" }}>⚠ excepcional</div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {desp ? (
                            <span style={{ color: "#2ecc71", fontSize: "0.72rem" }}>
                              ✓ {q.fecha_despacho ? new Date(q.fecha_despacho).toLocaleDateString() : ""}
                            </span>
                          ) : (
                            <button className="dp-gold" style={{ padding: "6px 12px", fontSize: "0.72rem" }}
                              onClick={() => abrirDespacho(q)}>
                              Autorizar Despacho
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
      </main>

      {/* ============ MODAL DE DESPACHO ============ */}
      {sel && (() => {
        const pago = estadoPago(sel);
        const prod = produccionDe(sel);
        const pagado = pago.estado === "pagado";
        const faltantes = lineas.filter((l) => !l.alcanza);

        return (
          <div className="dp-ov">
            <div className="dp-md" style={{ maxWidth: "620px" }}>
              <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.05rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                📦 Autorización de Salida EXW — {sel.referencia}
              </h3>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>
                Cliente: <strong style={{ color: "#fff" }}>{sel.empresa}</strong> · Total {fmt(sel.total)} ·
                Flujo <span style={{ color: acento, textTransform: "uppercase" }}>{pestana}</span>
              </p>

              {/* --- Verificaciones --- */}
              <div style={{
                background: pagado ? "rgba(46,204,113,0.06)" : "rgba(231,76,60,0.06)",
                border: `1px dashed ${pagado ? "rgba(46,204,113,0.4)" : "rgba(231,76,60,0.4)"}`,
                borderRadius: "8px", padding: "15px 18px", marginBottom: "16px",
              }}>
                <p style={{ fontSize: "0.7rem", color: pagado ? "#2ecc71" : "#e74c3c", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Verificación automática
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "7px" }}>
                  <span style={{ color: "#aaa" }}>Estado de pago</span>
                  <strong style={{ color: pagado ? "#2ecc71" : pago.estado === "parcial" ? "#e74c3c" : "#e67e22" }}>
                    {pagado ? "✓ Cancelado 100%"
                      : pago.estado === "parcial" ? `✗ Saldo ${fmt(pago.saldo)}`
                      : "✗ Sin cuenta por cobrar"}
                  </strong>
                </div>

                {pestana === "fabrica" && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "#aaa" }}>Producción</span>
                    <strong style={{ color: prod ? "#2ecc71" : "#e67e22" }}>
                      {prod ? `✓ ${prod.numero} completada` : "✗ Sin orden completada"}
                    </strong>
                  </div>
                )}

                {pestana === "producto" && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "#aaa" }}>Existencias</span>
                    <strong style={{ color: verificando ? "#aaa" : faltantes.length === 0 ? "#2ecc71" : "#e74c3c" }}>
                      {verificando ? "verificando..." : faltantes.length === 0 ? "✓ Stock suficiente" : `✗ ${faltantes.length} con problema`}
                    </strong>
                  </div>
                )}
              </div>

              {/* --- Detalle de ítems (solo productos) --- */}
              {pestana === "producto" && lineas.length > 0 && (
                <div style={{ maxHeight: "170px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", marginBottom: "16px" }}>
                  <table className="dp-tabla">
                    <thead><tr><th>SKU</th><th style={{ textAlign: "right" }}>Pide</th><th style={{ textAlign: "right" }}>Hay</th><th>Estado</th></tr></thead>
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: "0.74rem" }}>
                            <span style={{ color: "#DAA520" }}>{l.sku}</span>
                            {l.tabla && <div style={{ fontSize: "0.64rem", color: "#666" }}>{l.tabla}</div>}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{num(l.cantidad)}</td>
                          <td style={{ textAlign: "right", color: "#aaa" }}>{num(l.stockActual)}</td>
                          <td style={{ fontSize: "0.7rem", color: l.alcanza ? "#2ecc71" : "#e74c3c" }}>
                            {!l.tabla ? "no existe" : l.alcanza ? "✓" : `faltan ${num(l.cantidad - l.stockActual)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* --- Autorización excepcional --- */}
              {!pagado && (
                <div style={{ marginBottom: "16px" }}>
                  <label className="dp-lb" style={{ color: "#e67e22" }}>
                    ⚠ Autorización excepcional (obligatoria para despachar con saldo)
                  </label>
                  <input className="dp-in" placeholder="Quién autorizó y por qué. Queda en la auditoría."
                    value={autorizacionExcepcional}
                    onChange={(e) => setAutorizacionExcepcional(e.target.value)} />
                </div>
              )}

              {/* --- Responsables --- */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div><label className="dp-lb">Encargado de despacho *</label>
                  <input className="dp-in" placeholder="Embalaje y logística" value={form.encargado}
                    onChange={(e) => setForm({ ...form, encargado: e.target.value })} /></div>
                <div><label className="dp-lb">Supervisor *</label>
                  <input className="dp-in" placeholder="Control y entrega EXW" value={form.supervisor}
                    onChange={(e) => setForm({ ...form, supervisor: e.target.value })} /></div>
                <div><label className="dp-lb">Empresa transportista</label>
                  <input className="dp-in" value={form.transportista}
                    onChange={(e) => setForm({ ...form, transportista: e.target.value })} /></div>
                <div><label className="dp-lb">Guía / comprobante</label>
                  <input className="dp-in" placeholder="Código de tracking" value={form.guia}
                    onChange={(e) => setForm({ ...form, guia: e.target.value })} /></div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label className="dp-lb">Notas del despacho</label>
                <input className="dp-in" placeholder="Observaciones de embalaje, condiciones de entrega..."
                  value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>

              <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)",
                borderRadius: "8px", padding: "13px 16px", marginBottom: "18px" }}>
                <p style={{ fontSize: "0.7rem", color: "#DAA520", margin: "0 0 7px 0", textTransform: "uppercase" }}>Al autorizar</p>
                <ul style={{ color: "#ccc", fontSize: "0.76rem", margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
                  {pestana === "producto"
                    ? <li>Se descuenta el stock de cada SKU en su catálogo</li>
                    : prod?.sku_destino
                      ? <li>Salen {prod.carretes} carrete(s) del SKU <strong style={{ color: "#DAA520" }}>{prod.sku_destino}</strong></li>
                      : <li style={{ color: "#e67e22" }}>Sin SKU de producción: no se descuenta inventario</li>}
                  <li>Queda el movimiento registrado para auditoría</li>
                  <li>La cotización pasa a estado despachado_exw</li>
                  <li>Se congela el saldo del cliente al momento del despacho</li>
                </ul>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button className="dp-ghost" onClick={() => setSel(null)}>Cancelar</button>
                <button className="dp-gold" disabled={despachando || verificando}
                  style={{ background: pagado ? "#2ecc71" : "#e67e22", color: "#000" }}
                  onClick={ejecutarDespacho}>
                  {despachando ? "Procesando..." : pagado ? "Validar y Ejecutar Salida" : "⚠ Despachar con Saldo"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
