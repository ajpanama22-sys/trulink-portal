import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import {
  Card,
  Heading,
  PageHeader,
  Button,
  Badge,
  inputStyle,
} from "../../lib/ui";

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type PuntoTendencia = {
  clave: string;
  mes: string;
  cotizado: number;
  facturado: number;
  cobrado: number;
  esProyeccion: boolean;
};

// ------- Utilidades de Inteligencia Predictiva (Regresión Lineal Simple) -------
function regresionLineal(valores: number[]) {
  const n = valores.length;
  if (n < 2) return { pendiente: 0, intercepto: valores[0] || 0, r2: 0 };

  const xs = valores.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = valores.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * valores[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX || 1;

  const pendiente = (n * sumXY - sumX * sumY) / denom;
  const intercepto = (sumY - pendiente * sumX) / n;

  const mediaY = sumY / n;
  let ssTot = 0, ssRes = 0;
  valores.forEach((y, i) => {
    const pred = pendiente * i + intercepto;
    ssRes += (y - pred) ** 2;
    ssTot += (y - mediaY) ** 2;
  });
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { pendiente, intercepto, r2: Math.max(0, Math.min(1, r2)) };
}

function agregarPorMes(quotes: any[], mesesHistoria: number): PuntoTendencia[] {
  const hoy = new Date();
  const buckets: PuntoTendencia[] = [];
  for (let i = mesesHistoria - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    buckets.push({ clave: `${d.getFullYear()}-${d.getMonth()}`, mes: NOMBRES_MES[d.getMonth()], cotizado: 0, facturado: 0, cobrado: 0, esProyeccion: false });
  }
  const mapa = new Map(buckets.map((b) => [b.clave, b]));

  quotes.forEach((q) => {
    if (!q.created_at) return;
    const d = new Date(q.created_at);
    const clave = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = mapa.get(clave);
    if (!bucket) return;

    const monto = Number(q.total || 0);
    const esPagado = q.estado_pago === "pagado" || q.status === "facturado" || q.status === "pagado";
    const esFacturado = esPagado || !!q.pdf_url;

    bucket.cotizado += monto;
    if (esFacturado) bucket.facturado += monto;
    if (esPagado) bucket.cobrado += monto;
  });

  return buckets;
}

// Carga el logo público como base64 para incrustarlo en el PDF generado (con fecha y hora)
function cargarLogoBase64(): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve({ data: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = "/images/logo.png";
    } catch (e) {
      resolve(null);
    }
  });
}

export default function Analitica() {
  const [cargando, setCargando] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState("mes_actual");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaHoraActual, setFechaHoraActual] = useState("");

  // 1. Métricas Financieras, Comerciales y Contables (CXC / CXP)
  const [volumenCotizaciones, setVolumenCotizaciones] = useState(0);
  const [montoCotizaciones, setMontoCotizaciones] = useState(0);
  const [numFacturas, setNumFacturas] = useState(0);
  const [montoFacturas, setMontoFacturas] = useState(0);
  const [cotizacionesEliminadas, setCotizacionesEliminadas] = useState(0);
  const [valorNegocioPerdido, setValorNegocioPerdido] = useState(0);

  // Contabilidad Avanzada
  const [cuentasPorCobrarMonto, setCuentasPorCobrarMonto] = useState(0);
  const [cuentasPorPagarMonto, setCuentasPorPagarMonto] = useState(0);
  const [montoTotalCobrado, setMontoTotalCobrado] = useState(0);
  const [flujoNetoOperativo, setFlujoNetoOperativo] = useState(0);
  const [cxcVencidas, setCxcVencidas] = useState<any[]>([]);
  const [cxpPorCuenta, setCxpPorCuenta] = useState<{ cuenta: string; monto: number }[]>([]);

  // KPIs de rendimiento comercial
  const [tasaConversion, setTasaConversion] = useState(0);
  const [ticketPromedio, setTicketPromedio] = useState(0);
  const [crecimientoMoM, setCrecimientoMoM] = useState(0);

  // 2. Pasarelas de Pago & Cobros
  const [pagosStripe, setPagosStripe] = useState(0);
  const [pagosPaypal, setPagosPaypal] = useState(0);
  const [pagosWise, setPagosWise] = useState(0);
  const [pagosTransferencia, setPagosTransferencia] = useState(0);

  // 3. Inventario y SKUs (Normativa Nylon 66 / Fibra sin metal)
  const [skusCables, setSkusCables] = useState(0);
  const [skusHerrajes, setSkusHerrajes] = useState(0);
  const [skusAccesorios, setSkusAccesorios] = useState(0);
  const [totalSkusFabricacion, setTotalSkusFabricacion] = useState(0);

  // 4. Operaciones, Proveedores y Garantías
  const [totalProveedores, setTotalProveedores] = useState(0);
  const [totalRmas, setTotalRmas] = useState(0);

  // 5. Clientes y Geolocalización
  const [registrosInscripciones, setRegistrosInscripciones] = useState(0);
  const [segmentacionPerfil, setSegmentacionPerfil] = useState<{ perfil: string; cantidad: number }[]>([]);
  const [segmentacionListaPrecio, setSegmentacionListaPrecio] = useState<{ lista: string; cantidad: number }[]>([]);

  // 6. Rotación de Productos
  const [productosTop, setProductosTop] = useState<any[]>([]);

  // 7. Top Clientes
  const [topClientes, setTopClientes] = useState<any[]>([]);

  // 8. Tendencia real + Proyección IA
  const [historicoVentas, setHistoricoVentas] = useState<PuntoTendencia[]>([]);
  const [confianzaModelo, setConfianzaModelo] = useState(0);
  const [proyeccionMes1, setProyeccionMes1] = useState(0);
  const [proyeccionMes2, setProyeccionMes2] = useState(0);
  const [proyeccionMes3, setProyeccionMes3] = useState(0);
  const [tendenciaPendiente, setTendenciaPendiente] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [cargandoIA, setCargandoIA] = useState(true);

  // 9. Manufactura (ordenes_produccion + orden_produccion_lineas)
  const [ordenesPorEstado, setOrdenesPorEstado] = useState<{ estado: string; cantidad: number }[]>([]);
  const [totalOrdenesProduccion, setTotalOrdenesProduccion] = useState(0);
  const [kmTotalesProducidos, setKmTotalesProducidos] = useState(0);
  const [ordenesConFaltantes, setOrdenesConFaltantes] = useState(0);

  // 10. Bodega & Materia Prima
  const [totalMateriasPrimas, setTotalMateriasPrimas] = useState(0);
  const [valorInventarioMP, setValorInventarioMP] = useState(0);
  const [alertasStockBajo, setAlertasStockBajo] = useState<any[]>([]);
  const [ultimosMovimientos, setUltimosMovimientos] = useState<any[]>([]);

  // 11. Marketing
  const [campanasActivas, setCampanasActivas] = useState(0);
  const [presupuestoTotal, setPresupuestoTotal] = useState(0);
  const [gastoRealMarketing, setGastoRealMarketing] = useState(0);
  const [ingresosPorCampanas, setIngresosPorCampanas] = useState(0);
  const [leadsPorEstado, setLeadsPorEstado] = useState<{ estado: string; cantidad: number }[]>([]);
  const [leadsPorOrigen, setLeadsPorOrigen] = useState<{ origen: string; cantidad: number }[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  // 12. Personal (solo headcount / asistencia, sin montos de planilla)
  const [totalColaboradores, setTotalColaboradores] = useState(0);
  const [colaboradoresActivos, setColaboradoresActivos] = useState(0);
  const [colaboradoresPorDepto, setColaboradoresPorDepto] = useState<{ depto: string; cantidad: number }[]>([]);
  const [marcajesHoy, setMarcajesHoy] = useState(0);

  useEffect(() => {
    const actualizarReloj = () => {
      const now = new Date();
      setFechaHoraActual(now.toISOString().replace("T", " ").substring(0, 19));
    };
    actualizarReloj();
    inicializarFechasYCargar();
    cargarTendenciaEInteligenciaPredictiva();
  }, [tipoFiltro]);

  const inicializarFechasYCargar = () => {
    const hoy = new Date();
    let desde = "";
    let hasta = hoy.toISOString().split("T")[0];

    if (tipoFiltro === "mes_actual") {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
    } else if (tipoFiltro === "ano_actual") {
      desde = new Date(hoy.getFullYear(), 0, 1).toISOString().split("T")[0];
    } else if (tipoFiltro === "historico") {
      desde = "2023-01-01";
    } else {
      desde = fechaDesde || "2026-01-01";
    }

    setFechaDesde(desde);
    setFechaHasta(hasta);
    cargarDatosAnalitica(desde, hasta);
  };

  const cargarDatosAnalitica = async (desde: string, hasta: string) => {
    if (!supabase) return;
    setCargando(true);

    try {
      const [
        { data: quotesData },
        { data: cables },
        { data: herrajes },
        { data: accesorios },
        { data: provData },
        { data: rmaData },
        { data: usuariosData },
        cxcRes,
        cxpRes,
        ordenesProdRes,
        lineasProdRes,
        materiaPrimaRes,
        movimientosInvRes,
        campanasRes,
        gastosMktRes,
        leadsRes,
        colaboradoresRes,
        marcajesRes,
      ] = await Promise.all([
        supabase.from("quotes").select("*").gte("created_at", `${desde}T00:00:00`).lte("created_at", `${hasta}T23:59:59`),
        supabase.from("cablesdb").select("*"),
        supabase.from("herrajesdb").select("*"),
        supabase.from("accesoriosdb").select("*"),
        supabase.from("proveedores").select("*"),
        supabase.from("rmas").select("*"),
        supabase.from("clientes").select("*"),
        supabase.from("cuentas_por_cobrar").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("cuentas_por_pagar").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("ordenes_produccion").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("orden_produccion_lineas").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("materia_prima").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("movimientos_inventario").select("*").order("created_at", { ascending: false }).limit(10).then((res) => res, () => ({ data: [] })),
        supabase.from("marketing_campaigns").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("marketing_gastos").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("marketing_leads").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("colaboradores").select("*").then((res) => res, () => ({ data: [] })),
        supabase.from("marcajes").select("*").gte("marcado_en", `${hasta}T00:00:00`).then((res) => res, () => ({ data: [] })),
      ]);

      const quotes = quotesData || [];
      const cxcData = cxcRes?.data || [];
      const cxpData = cxpRes?.data || [];

      setVolumenCotizaciones(quotes.length);
      const totalCot = quotes.reduce((acc, item) => acc + Number(item.total || 0), 0);
      setMontoCotizaciones(totalCot);

      const facturadas = quotes.filter(
        (item) => item.estado_pago === "pagado" || item.pdf_url || item.status === "facturado" || item.status === "pagado"
      );
      setNumFacturas(facturadas.length);
      const totalFac = facturadas.reduce((acc, item) => acc + Number(item.total || 0), 0);
      setMontoFacturas(totalFac);

      const eliminadas = quotes.filter(
        (item) => item.status === "eliminado" || item.status === "perdido" || item.status === "cancelado"
      );
      setCotizacionesEliminadas(eliminadas.length);
      setValorNegocioPerdido(eliminadas.reduce((acc, item) => acc + Number(item.total || 0), 0));

      // KPIs de rendimiento comercial
      setTasaConversion(quotes.length > 0 ? (facturadas.length / quotes.length) * 100 : 0);
      setTicketPromedio(quotes.length > 0 ? totalCot / quotes.length : 0);

      let stripe = 0, paypal = 0, wise = 0, trans = 0, cobradoTotal = 0;
      quotes.forEach((item) => {
        const metodo = (item.metodo_pago || "").toLowerCase();
        const monto = Number(item.monto_abonado ?? item.total ?? 0);
        if (item.estado_pago === "pagado" || item.status === "facturado" || item.status === "pagado") {
          cobradoTotal += monto;
        }
        if (metodo.includes("stripe")) stripe += monto;
        else if (metodo.includes("paypal")) paypal += monto;
        else if (metodo.includes("wise")) wise += monto;
        else if (metodo) trans += monto;
      });

      setPagosStripe(stripe);
      setPagosPaypal(paypal);
      setPagosWise(wise);
      setPagosTransferencia(trans);
      setMontoTotalCobrado(cobradoTotal);

      // ── CxC / CxP con columnas reales confirmadas (saldo_pendiente) ──
      const totalCXC = cxcData.reduce((acc: number, item: any) => acc + Number(item.saldo_pendiente || 0), 0);
      const totalCXP = cxpData.reduce((acc: number, item: any) => acc + Number(item.saldo_pendiente || 0), 0);
      setCuentasPorCobrarMonto(totalCXC);
      setCuentasPorPagarMonto(totalCXP);
      setFlujoNetoOperativo(cobradoTotal - totalCXP);

      // Cuentas por cobrar vencidas (fecha_vencimiento ya pasó y con saldo)
      const hoyStr = new Date().toISOString().split("T")[0];
      const vencidas = cxcData
        .filter((c: any) => Number(c.saldo_pendiente || 0) > 0 && c.fecha_vencimiento && c.fecha_vencimiento < hoyStr)
        .sort((a: any, b: any) => Number(b.saldo_pendiente || 0) - Number(a.saldo_pendiente || 0))
        .slice(0, 8);
      setCxcVencidas(vencidas);

      // Cuentas por pagar agrupadas por cuenta contable (catálogo nuevo)
      const cxpAgrupado: { [key: string]: number } = {};
      cxpData.forEach((c: any) => {
        const clave = c.cuenta_nombre || c.cuenta_codigo || "Sin Clasificar";
        cxpAgrupado[clave] = (cxpAgrupado[clave] || 0) + Number(c.monto_total || 0);
      });
      setCxpPorCuenta(
        Object.entries(cxpAgrupado)
          .map(([cuenta, monto]) => ({ cuenta, monto }))
          .sort((a, b) => b.monto - a.monto)
          .slice(0, 8)
      );

      const cCount = cables?.length || 0;
      const hCount = herrajes?.length || 0;
      const aCount = accesorios?.length || 0;
      setSkusCables(cCount);
      setSkusHerrajes(hCount);
      setSkusAccesorios(aCount);
      setTotalSkusFabricacion(cCount + hCount + aCount);

      setTotalProveedores(provData?.length || 0);
      setTotalRmas(rmaData?.length || 0);

      const usuarios = usuariosData || [];
      setRegistrosInscripciones(usuarios.length);

      // ── Segmentación de clientes por perfil (ISP / MAYORISTA / INTEGRADOR / USUARIO FINAL) ──
      const perfilCount: { [key: string]: number } = {};
      const listaCount: { [key: string]: number } = {};
      usuarios.forEach((u: any) => {
        const perfil = u.perfil_cliente || "Sin Perfil";
        const lista = u.price_list || "Sin Lista";
        perfilCount[perfil] = (perfilCount[perfil] || 0) + 1;
        listaCount[lista] = (listaCount[lista] || 0) + 1;
      });
      setSegmentacionPerfil(
        Object.entries(perfilCount).map(([perfil, cantidad]) => ({ perfil, cantidad })).sort((a, b) => b.cantidad - a.cantidad)
      );
      setSegmentacionListaPrecio(
        Object.entries(listaCount).map(([lista, cantidad]) => ({ lista, cantidad })).sort((a, b) => a.lista.localeCompare(b.lista))
      );

      const clientesMapMonto: { [key: string]: { empresa: string; total: number } } = {};
      quotes.forEach((q) => {
        const clienteKey = q.empresa || q.cliente || q.email || "Cliente Corporativo";
        if (!clientesMapMonto[clienteKey]) clientesMapMonto[clienteKey] = { empresa: clienteKey, total: 0 };
        clientesMapMonto[clienteKey].total += Number(q.total || 0);
      });
      setTopClientes(Object.values(clientesMapMonto).sort((a, b) => b.total - a.total).slice(0, 10));

      const conteoItems: { [key: string]: number } = {};
      quotes.forEach((q) => {
        let itemsList: any[] = [];
        if (typeof q.items === "string") {
          try { itemsList = JSON.parse(q.items); } catch (e) { itemsList = []; }
        } else if (Array.isArray(q.items)) {
          itemsList = q.items;
        }
        itemsList.forEach((it: any) => {
          const clave = it.SKU || it.sku || it.descripcion || it.nombre || "Sin SKU";
          conteoItems[clave] = (conteoItems[clave] || 0) + Number(it.cantidad || 1);
        });
      });

      const todosLosProductos = [
        ...(cables || []).map((i) => ({ sku: i.SKU || "Sin SKU", nombre: i.Descripción || i.SKU || "Cable Fibra", tipo: "Cable" })),
        ...(herrajes || []).map((i) => ({ sku: i.SKU || "Sin SKU", nombre: i.Descripción || i.SKU || "Herraje", tipo: "Herraje" })),
        ...(accesorios || []).map((i) => ({ sku: i.SKU || "Sin SKU", nombre: i.Descripción || i.SKU || "Accesorio", tipo: "Accesorio" })),
      ];
      const listaMovimiento = todosLosProductos
        .map((prod) => ({
          sku: prod.sku,
          nombre: prod.nombre,
          tipo: prod.tipo,
          movimientos: conteoItems[prod.sku] ?? conteoItems[prod.nombre] ?? 0,
        }))
        .sort((a, b) => b.movimientos - a.movimientos);
      setProductosTop(listaMovimiento.slice(0, 5));

      // ── Manufactura: ordenes_produccion + orden_produccion_lineas (tablas reales) ──
      const ordenesProd = ordenesProdRes?.data || [];
      const lineasProd = lineasProdRes?.data || [];
      setTotalOrdenesProduccion(ordenesProd.length);
      const estadoCount: { [key: string]: number } = {};
      ordenesProd.forEach((o: any) => {
        const est = o.estado || "Sin Estado";
        estadoCount[est] = (estadoCount[est] || 0) + 1;
      });
      setOrdenesPorEstado(Object.entries(estadoCount).map(([estado, cantidad]) => ({ estado, cantidad })).sort((a, b) => b.cantidad - a.cantidad));
      setKmTotalesProducidos(lineasProd.reduce((acc: number, l: any) => acc + Number(l.km_totales || 0), 0));
      setOrdenesConFaltantes(ordenesProd.filter((o: any) => o.faltantes && String(o.faltantes).trim() !== "").length);

      // ── Bodega & Materia Prima (tabla real: materia_prima) ──
      const materiaPrima = materiaPrimaRes?.data || [];
      setTotalMateriasPrimas(materiaPrima.length);
      setValorInventarioMP(materiaPrima.reduce((acc: number, m: any) => acc + Number(m.stock_actual || 0) * Number(m.costo_promedio || 0), 0));
      setAlertasStockBajo(
        materiaPrima
          .filter((m: any) => Number(m.stock_actual || 0) <= Number(m.stock_minimo || 0))
          .sort((a: any, b: any) => Number(a.stock_actual || 0) - Number(b.stock_actual || 0))
          .slice(0, 8)
      );
      setUltimosMovimientos(movimientosInvRes?.data || []);

      // ── Marketing ──
      const campanas = campanasRes?.data || [];
      const gastosMkt = gastosMktRes?.data || [];
      const leads = leadsRes?.data || [];
      setCampanasActivas(campanas.filter((c: any) => c.estado === "activa" || c.estado === "Activa").length);
      setPresupuestoTotal(campanas.reduce((acc: number, c: any) => acc + Number(c.presupuesto || 0), 0));
      setIngresosPorCampanas(campanas.reduce((acc: number, c: any) => acc + Number(c.ingresos_generados || 0), 0));
      setGastoRealMarketing(gastosMkt.reduce((acc: number, g: any) => acc + Number(g.monto || 0), 0));
      setTotalLeads(leads.length);
      const estadoLeadsCount: { [key: string]: number } = {};
      const origenLeadsCount: { [key: string]: number } = {};
      leads.forEach((l: any) => {
        const est = l.estado || "Sin Estado";
        const org = l.origen || "Sin Origen";
        estadoLeadsCount[est] = (estadoLeadsCount[est] || 0) + 1;
        origenLeadsCount[org] = (origenLeadsCount[org] || 0) + 1;
      });
      setLeadsPorEstado(Object.entries(estadoLeadsCount).map(([estado, cantidad]) => ({ estado, cantidad })).sort((a, b) => b.cantidad - a.cantidad));
      setLeadsPorOrigen(Object.entries(origenLeadsCount).map(([origen, cantidad]) => ({ origen, cantidad })).sort((a, b) => b.cantidad - a.cantidad));

      // ── Personal (solo headcount / asistencia — sin datos de planilla) ──
      const colaboradores = colaboradoresRes?.data || [];
      setTotalColaboradores(colaboradores.length);
      setColaboradoresActivos(colaboradores.filter((c: any) => c.activo).length);
      const deptoCount: { [key: string]: number } = {};
      colaboradores.forEach((c: any) => {
        const depto = c.departamento || "Sin Departamento";
        deptoCount[depto] = (deptoCount[depto] || 0) + 1;
      });
      setColaboradoresPorDepto(Object.entries(deptoCount).map(([depto, cantidad]) => ({ depto, cantidad })).sort((a, b) => b.cantidad - a.cantidad));
      const marcajesHoyData = marcajesRes?.data || [];
      const colaboradoresConMarcajeHoy = new Set(marcajesHoyData.map((m: any) => m.colaborador_id));
      setMarcajesHoy(colaboradoresConMarcajeHoy.size);
    } catch (err) {
      console.error("Error generando analítica BI Enterprise:", err);
    } finally {
      setCargando(false);
    }
  };

  // -------- Motor de Inteligencia Predictiva (ventana móvil de 6 meses reales + proyección a 3 meses) --------
  const cargarTendenciaEInteligenciaPredictiva = async () => {
    if (!supabase) return;
    setCargandoIA(true);
    try {
      const hoy = new Date();
      const desde12 = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().split("T")[0];
      const { data } = await supabase
        .from("quotes")
        .select("*")
        .gte("created_at", `${desde12}T00:00:00`);

      const quotes = data || [];
      const buckets = agregarPorMes(quotes, 6);

      const serieCobrado = buckets.map((b) => b.cobrado);
      const serieCotizado = buckets.map((b) => b.cotizado);
      const { pendiente, intercepto, r2 } = regresionLineal(serieCobrado);
      const regCot = regresionLineal(serieCotizado);

      const n = buckets.length;
      const proyecciones: PuntoTendencia[] = [1, 2, 3].map((k) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
        const cobradoProyectado = Math.max(0, pendiente * (n - 1 + k) + intercepto);
        const cotizadoProyectado = Math.max(0, regCot.pendiente * (n - 1 + k) + regCot.intercepto);
        return {
          clave: `p-${k}`,
          mes: NOMBRES_MES[d.getMonth()],
          cotizado: cotizadoProyectado,
          facturado: 0,
          cobrado: cobradoProyectado,
          esProyeccion: true,
        };
      });

      setHistoricoVentas([...buckets, ...proyecciones]);
      setConfianzaModelo(r2);
      setTendenciaPendiente(pendiente);
      setProyeccionMes1(proyecciones[0].cobrado);
      setProyeccionMes2(proyecciones[1].cobrado);
      setProyeccionMes3(proyecciones[2].cobrado);

      const ultimo = buckets[buckets.length - 1]?.cobrado || 0;
      const anterior = buckets[buckets.length - 2]?.cobrado || 0;
      const crecimiento = anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : ultimo > 0 ? 100 : 0;
      setCrecimientoMoM(crecimiento);

      const nuevosInsights: string[] = [];
      nuevosInsights.push(
        crecimiento >= 0
          ? `Los cobros crecieron ${crecimiento.toFixed(1)}% respecto al mes anterior (${buckets[buckets.length - 2]?.mes} → ${buckets[buckets.length - 1]?.mes}).`
          : `Los cobros cayeron ${Math.abs(crecimiento).toFixed(1)}% respecto al mes anterior (${buckets[buckets.length - 2]?.mes} → ${buckets[buckets.length - 1]?.mes}).`
      );
      nuevosInsights.push(
        pendiente >= 0
          ? `La tendencia de cobros es ascendente: el modelo proyecta $${proyecciones[0].cobrado.toLocaleString("en-US", { maximumFractionDigits: 0 })} para el próximo mes.`
          : `La tendencia de cobros es descendente: el modelo proyecta $${proyecciones[0].cobrado.toLocaleString("en-US", { maximumFractionDigits: 0 })} para el próximo mes; conviene reforzar la gestión de cobranza.`
      );
      const sumaTrimestre = proyecciones.reduce((acc, p) => acc + p.cobrado, 0);
      nuevosInsights.push(`Proyección acumulada del próximo trimestre: $${sumaTrimestre.toLocaleString("en-US", { maximumFractionDigits: 0 })}, con un ${(r2 * 100).toFixed(0)}% de confianza estadística (R²).`);
      setInsights(nuevosInsights);
    } catch (err) {
      console.error("Error calculando inteligencia predictiva:", err);
    } finally {
      setCargandoIA(false);
    }
  };

  const exportarReporteXLS = () => {
    let contenido = "REPORTE EXECUTIVE BI & CONTABILIDAD - TRULINK FIBER LLC\n";
    contenido += `Generado: ${fechaHoraActual}\n\n`;
    contenido += `Métrica Financiera\tMonto / Valor\n`;
    contenido += `Pipeline Cotizado\t$${montoCotizaciones.toFixed(2)}\n`;
    contenido += `Facturación Efectiva\t$${montoFacturas.toFixed(2)}\n`;
    contenido += `Cobros Recibidos (Total)\t$${montoTotalCobrado.toFixed(2)}\n`;
    contenido += `Cuentas por Cobrar (CXC)\t$${cuentasPorCobrarMonto.toFixed(2)}\n`;
    contenido += `Cuentas por Pagar (CXP)\t$${cuentasPorPagarMonto.toFixed(2)}\n`;
    contenido += `Flujo Neto Operativo\t$${flujoNetoOperativo.toFixed(2)}\n`;
    contenido += `Tasa de Conversión\t${tasaConversion.toFixed(1)}%\n`;
    contenido += `Ticket Promedio\t$${ticketPromedio.toFixed(2)}\n`;
    contenido += `Crecimiento Mensual (MoM)\t${crecimientoMoM.toFixed(1)}%\n`;
    contenido += `Stripe\t$${pagosStripe.toFixed(2)}\n`;
    contenido += `PayPal\t$${pagosPaypal.toFixed(2)}\n`;
    contenido += `Wise\t$${pagosWise.toFixed(2)}\n`;
    contenido += `Transferencias Bancarias\t$${pagosTransferencia.toFixed(2)}\n\n`;
    contenido += `MANUFACTURA\n`;
    contenido += `Órdenes de Producción Totales\t${totalOrdenesProduccion}\n`;
    contenido += `Km Totales Producidos\t${kmTotalesProducidos.toFixed(2)}\n\n`;
    contenido += `BODEGA / MATERIA PRIMA\n`;
    contenido += `Materias Primas Registradas\t${totalMateriasPrimas}\n`;
    contenido += `Valor de Inventario MP\t$${valorInventarioMP.toFixed(2)}\n`;
    contenido += `Alertas de Stock Bajo\t${alertasStockBajo.length}\n\n`;
    contenido += `MARKETING\n`;
    contenido += `Campañas Activas\t${campanasActivas}\n`;
    contenido += `Presupuesto Total\t$${presupuestoTotal.toFixed(2)}\n`;
    contenido += `Gasto Real\t$${gastoRealMarketing.toFixed(2)}\n`;
    contenido += `Leads Totales\t${totalLeads}\n\n`;
    contenido += `PERSONAL\n`;
    contenido += `Colaboradores Totales\t${totalColaboradores}\n`;
    contenido += `Colaboradores Activos\t${colaboradoresActivos}\n`;
    contenido += `Marcajes Hoy\t${marcajesHoy}\n\n`;
    contenido += `PROYECCIÓN IA (Regresión Lineal, confianza R² ${(confianzaModelo * 100).toFixed(0)}%)\n`;
    contenido += `Mes\tCobrado Real / Proyectado\n`;
    historicoVentas.forEach((p) => {
      contenido += `${p.mes}${p.esProyeccion ? " (Proyección)" : ""}\t$${p.cobrado.toFixed(2)}\n`;
    });

    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Trulink_Executive_Accounting_${fechaHoraActual.split(" ")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarJSON = () => {
    const payload = {
      generado: fechaHoraActual,
      rango: { desde: fechaDesde, hasta: fechaHasta },
      kpis: {
        montoCotizaciones, montoFacturas, montoTotalCobrado, cuentasPorCobrarMonto,
        cuentasPorPagarMonto, flujoNetoOperativo, tasaConversion, ticketPromedio, crecimientoMoM,
      },
      pasarelas: { pagosStripe, pagosPaypal, pagosWise, pagosTransferencia },
      manufactura: { totalOrdenesProduccion, kmTotalesProducidos, ordenesPorEstado, ordenesConFaltantes },
      bodega: { totalMateriasPrimas, valorInventarioMP, alertasStockBajo },
      marketing: { campanasActivas, presupuestoTotal, gastoRealMarketing, ingresosPorCampanas, totalLeads, leadsPorEstado, leadsPorOrigen },
      personal: { totalColaboradores, colaboradoresActivos, colaboradoresPorDepto, marcajesHoy },
      segmentacionClientes: { porPerfil: segmentacionPerfil, porListaPrecio: segmentacionListaPrecio },
      proyeccionIA: { confianza: confianzaModelo, historicoVentas },
      insights,
      topClientes,
      productosTop,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Trulink_Analitica_${fechaHoraActual.split(" ")[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportación PDF real (jsPDF + autoTable) con logo, fecha y hora impresos en el documento
  const exportarPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const logo = await cargarLogoBase64();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let xTexto = 14;

      if (logo) {
        const anchoLogo = 30;
        const altoLogo = anchoLogo * (logo.height / logo.width);
        doc.addImage(logo.data, "PNG", 14, 10, anchoLogo, altoLogo);
        xTexto = 14 + anchoLogo + 8;
      }

      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text("Trulink Fiber LLC - Enterprise Intelligence & Accounting BI", xTexto, 17);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generado: ${fechaHoraActual}`, xTexto, 23);
      doc.text(`Periodo: ${fechaDesde} a ${fechaHasta}`, xTexto, 28);

      autoTable(doc, {
        startY: 38,
        head: [["Métrica Financiera", "Valor"]],
        body: [
          ["Pipeline Cotizado", `$${montoCotizaciones.toFixed(2)}`],
          ["Cobros Realizados", `$${montoTotalCobrado.toFixed(2)}`],
          ["Cuentas por Cobrar (CXC)", `$${cuentasPorCobrarMonto.toFixed(2)}`],
          ["Cuentas por Pagar (CXP)", `$${cuentasPorPagarMonto.toFixed(2)}`],
          ["Flujo Neto Operativo", `$${flujoNetoOperativo.toFixed(2)}`],
          ["Tasa de Conversión", `${tasaConversion.toFixed(1)}%`],
          ["Ticket Promedio", `$${ticketPromedio.toFixed(2)}`],
          ["Crecimiento Mensual (MoM)", `${crecimientoMoM.toFixed(1)}%`],
        ],
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 215, 0] },
        styles: { fontSize: 9 },
      });

      const finalY1 = (doc as any).lastAutoTable?.finalY || 38;

      autoTable(doc, {
        startY: finalY1 + 10,
        head: [["Mes", "Cobrado (Real / Proyección IA)"]],
        body: historicoVentas.map((p) => [`${p.mes}${p.esProyeccion ? " (Proyección IA)" : ""}`, `$${p.cobrado.toFixed(2)}`]),
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [179, 136, 255] },
        styles: { fontSize: 9 },
      });

      const finalY2 = (doc as any).lastAutoTable?.finalY || finalY1 + 10;
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text("Insights Automáticos:", 14, finalY2 + 10);
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      let cursorY = finalY2 + 16;
      insights.forEach((texto) => {
        const lineas = doc.splitTextToSize(`• ${texto}`, pageWidth - 28);
        doc.text(lineas, 14, cursorY);
        cursorY += lineas.length * 4.5 + 2;
      });

      doc.save(`Trulink_Analitica_${fechaHoraActual.split(" ")[0]}.pdf`);
    } catch (err) {
      console.error("Error generando PDF, usando impresión del navegador como respaldo:", err);
      window.print();
    }
  };

  const totalPagosGlobal = pagosStripe + pagosPaypal + pagosWise + pagosTransferencia || 1;
  const pctStripe = Number(((pagosStripe / totalPagosGlobal) * 100).toFixed(1));
  const pctPaypal = Number(((pagosPaypal / totalPagosGlobal) * 100).toFixed(1));
  const pctWise = Number(((pagosWise / totalPagosGlobal) * 100).toFixed(1));
  const pctTrans = Number(((pagosTransferencia / totalPagosGlobal) * 100).toFixed(1));

  // -------- Escalado dinámico del gráfico de tendencia + proyección --------
  const ANCHO_GRAFICO = 600;
  const ALTO_GRAFICO = 200;
  const maxValorGrafico = Math.max(1, ...historicoVentas.map((p) => Math.max(p.cotizado, p.cobrado)));
  const puntoAXY = (valor: number, idx: number, total: number) => {
    const x = total <= 1 ? 0 : (idx / (total - 1)) * ANCHO_GRAFICO;
    const y = ALTO_GRAFICO - (valor / maxValorGrafico) * ALTO_GRAFICO;
    return { x, y };
  };
  const totalPuntos = historicoVentas.length;
  const idxCorte = Math.max(0, historicoVentas.findIndex((p) => p.esProyeccion) - 1);

  const generarPolilinea = (clave: "cotizado" | "cobrado", desdeIdx: number, hastaIdx: number) => {
    return historicoVentas
      .slice(desdeIdx, hastaIdx + 1)
      .map((p, i) => {
        const idxReal = desdeIdx + i;
        const { x, y } = puntoAXY(p[clave], idxReal, totalPuntos);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <div style={{ display: "flex" }}>
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
          body { background: #030303 !important; }
        }
      `}</style>
      <Sidebar currentActive="analitica" />

      <div style={pageWrapStyle()}>

        {/* ENCABEZADO */}
        <PageHeader
          title="Enterprise Intelligence & Accounting BI"
          subtitle="Consola Financiera, Operativa y de Personal Consolidada • Trulink Fiber LLC"
          counterLabel="Global Edition"
        />

        <div
          className="no-imprimir"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 28 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/images/logo.png" alt="Trulink Fiber" style={{ height: "40px", objectFit: "contain", filter: "drop-shadow(0 0 12px rgba(255,215,0,0.5))" }} />
            <div style={{ background: "rgba(20, 20, 20, 0.8)", border: `1px solid ${theme.borderGold}`, padding: "8px 16px", borderRadius: theme.radiusSm }}>
              <span style={{ display: "block", fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "1px" }}>Sincronización Supabase</span>
              <strong style={{ fontSize: "0.85rem", color: theme.gold, fontFamily: "monospace" }}>{fechaHoraActual}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button variant="outline-gold" onClick={exportarReporteXLS}>📊 CSV</Button>
            <Button variant="outline-gold" onClick={exportarJSON}>🗂️ JSON</Button>
            <Button variant="gold" onClick={exportarPDF}>📄 PDF</Button>
          </div>
        </div>

        {/* PARÁMETROS TEMPORALES */}
        <div className="no-imprimir">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.2rem", color: theme.gold }}>💎</span>
              <div>
                <Heading style={{ marginBottom: 2 }}>Filtro de Inteligencia Contable y Temporal</Heading>
                <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>Control en tiempo real de ingresos, CXC y CXP</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} style={inputStyle}>
                <option value="mes_actual" style={{ background: theme.inputBg, color: theme.gold }}>Mes en Curso</option>
                <option value="ano_actual" style={{ background: theme.inputBg, color: theme.gold }}>Año Fiscal 2026</option>
                <option value="historico" style={{ background: theme.inputBg, color: theme.gold }}>Histórico Global</option>
                <option value="personalizado" style={{ background: theme.inputBg, color: theme.gold }}>Rango Personalizado</option>
              </select>

              {tipoFiltro === "personalizado" && (
                <>
                  <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
                  <span style={{ color: theme.gold, fontWeight: "bold" }}>→</span>
                  <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
                  <Button variant="gold" onClick={() => cargarDatosAnalitica(fechaDesde, fechaHasta)}>Aplicar</Button>
                </>
              )}
            </div>
          </div>
        </Card>
        </div>

        {cargando ? (
          <div style={{ padding: "100px", textAlign: "center" }}>
            <div style={{ width: "50px", height: "50px", border: "3px solid rgba(218,165,32,0.1)", borderTop: `3px solid ${theme.gold}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px auto" }} />
            <p style={{ color: theme.gold, letterSpacing: "2px", textTransform: "uppercase", fontSize: "0.85rem" }}>Consolidando Contabilidad y Red Trulink...</p>
          </div>
        ) : (
          <>
            {/* TOP KPI CARDS CONTABLES Y FINANCIERAS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "20px" }}>
              <MetricKpiCard title="Pipeline Cotizado" amount={`$${montoCotizaciones.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count={`${volumenCotizaciones} Cotizaciones`} badge="Demanda Activa" isUp={true} glow="#FFD700" />
              <MetricKpiCard title="Cobros Realizados" amount={`$${montoTotalCobrado.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count={`${numFacturas} Facturas Pagadas`} badge="Ingreso Real" isUp={true} glow="#00E676" />
              <MetricKpiCard title="Cuentas por Cobrar (CXC)" amount={`$${cuentasPorCobrarMonto.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count="Pendiente de clientes" badge="CxC Activo" isUp={true} glow="#29B6F6" />
              <MetricKpiCard title="Cuentas por Pagar (CXP)" amount={`$${cuentasPorPagarMonto.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count="Compromisos y gastos" badge="CxP Real" isUp={false} glow="#FF5252" />
              <MetricKpiCard title="Flujo Neto Operativo" amount={`$${flujoNetoOperativo.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count="Cobros menos CXP" badge="Balance Neto" isUp={flujoNetoOperativo >= 0} glow="#FFD700" />
            </div>

            {/* KPIs DE RENDIMIENTO COMERCIAL */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "35px" }}>
              <MetricKpiCard title="Tasa de Conversión" amount={`${tasaConversion.toFixed(1)}%`} count="Cotización → Factura" badge="Efectividad" isUp={tasaConversion >= 50} glow="#B388FF" />
              <MetricKpiCard title="Ticket Promedio" amount={`$${ticketPromedio.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count="Por cotización" badge="Valor Medio" isUp={true} glow="#40C4FF" />
              <MetricKpiCard title="Crecimiento Mensual" amount={`${crecimientoMoM >= 0 ? "+" : ""}${crecimientoMoM.toFixed(1)}%`} count="Cobros vs mes anterior" badge="MoM" isUp={crecimientoMoM >= 0} glow={crecimientoMoM >= 0 ? "#00E676" : "#FF5252"} />
              <MetricKpiCard title="Negocio Perdido" amount={`$${valorNegocioPerdido.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} count={`${cotizacionesEliminadas} cotizaciones`} badge="Oportunidad" isUp={false} glow="#FF5252" />
            </div>

            {/* SECCIÓN IA: PROYECCIONES PREDICTIVAS */}
            <Card style={{ marginBottom: "35px", border: "1px solid rgba(179,136,255,0.4)", boxShadow: "0 12px 35px rgba(0,0,0,0.6), 0 0 25px rgba(179,136,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem" }}>🤖</span>
                  <div>
                    <Heading style={{ marginBottom: 2, color: theme.textLight }}>Proyecciones Predictivas con IA</Heading>
                    <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>Regresión lineal sobre 6 meses reales de cobros · proyección a 3 meses</span>
                  </div>
                </div>
                <span style={{ fontSize: "0.7rem", color: "#B388FF", border: "1px solid rgba(179,136,255,0.4)", padding: "4px 10px", borderRadius: "6px", fontWeight: "bold" }}>
                  Confianza del Modelo (R²): {(confianzaModelo * 100).toFixed(0)}%
                </span>
              </div>

              {cargandoIA ? (
                <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>Entrenando modelo de proyección...</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "25px" }}>
                    <div style={{ width: "100%", height: "230px", position: "relative" }}>
                      <svg viewBox={`0 0 ${ANCHO_GRAFICO} ${ALTO_GRAFICO}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
                        <defs>
                          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={theme.goldBright} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={theme.goldBright} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1={ALTO_GRAFICO * 0.2} x2={ANCHO_GRAFICO} y2={ALTO_GRAFICO * 0.2} stroke="#1f1f1f" strokeDasharray="4" />
                        <line x1="0" y1={ALTO_GRAFICO * 0.5} x2={ANCHO_GRAFICO} y2={ALTO_GRAFICO * 0.5} stroke="#1f1f1f" strokeDasharray="4" />
                        <line x1="0" y1={ALTO_GRAFICO * 0.8} x2={ANCHO_GRAFICO} y2={ALTO_GRAFICO * 0.8} stroke="#1f1f1f" strokeDasharray="4" />

                        <polyline points={generarPolilinea("cobrado", 0, idxCorte)} fill="none" stroke={theme.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 6px rgba(0,230,118,0.6))" />
                        <polyline points={generarPolilinea("cobrado", idxCorte, totalPuntos - 1)} fill="none" stroke={theme.green} strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />

                        <polyline points={generarPolilinea("cotizado", 0, idxCorte)} fill="none" stroke={theme.goldBright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
                        <polyline points={generarPolilinea("cotizado", idxCorte, totalPuntos - 1)} fill="none" stroke={theme.goldBright} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                      </svg>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#666", fontSize: "0.7rem", marginTop: "8px" }}>
                        {historicoVentas.map((p, idx) => (
                          <span key={idx} style={{ color: p.esProyeccion ? "#B388FF" : "#666" }}>{p.mes}{p.esProyeccion ? "*" : ""}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "14px", fontSize: "0.7rem", marginTop: "10px" }}>
                        <span style={{ color: theme.green }}>● Cobrado</span>
                        <span style={{ color: theme.goldBright }}>● Cotizado</span>
                        <span style={{ color: "#B388FF" }}>┄ * Proyección IA</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <ForecastCard label="Próximo Mes" valor={proyeccionMes1} />
                      <ForecastCard label="Mes +2" valor={proyeccionMes2} />
                      <ForecastCard label="Mes +3" valor={proyeccionMes3} />
                      <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)", border: "1px solid rgba(179,136,255,0.3)" }}>
                        <span style={{ fontSize: "0.68rem", color: theme.textMuted, textTransform: "uppercase" }}>Tendencia Mensual</span>
                        <strong style={{ display: "block", fontSize: "0.95rem", color: tendenciaPendiente >= 0 ? theme.green : theme.red, marginTop: "4px" }}>
                          {tendenciaPendiente >= 0 ? "↗ Ascendente" : "↘ Descendente"} (${Math.abs(tendenciaPendiente).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mes)
                        </strong>
                      </Card>
                    </div>
                  </div>

                  <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <h4 style={{ color: theme.textLight, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>💡 Insights Automáticos</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                      {insights.map((texto, idx) => (
                        <div key={idx} style={{ background: "rgba(179,136,255,0.06)", border: "1px solid rgba(179,136,255,0.2)", borderRadius: "8px", padding: "12px 14px", fontSize: "0.78rem", color: "#DDD", lineHeight: 1.5 }}>
                          {texto}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* SECCIÓN: PASARELAS DE PAGO Y TOP PRODUCTOS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "35px" }}>

              <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ color: theme.textLight, fontSize: "1.05rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>Pasarelas & Bancos</h3>
                  <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>Distribución de cobros recibidos</span>
                </div>

                <div style={{ position: "relative", width: "150px", height: "150px", margin: "15px auto" }}>
                  <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#111" strokeWidth="3.8" />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#635BFF" strokeWidth="3.8" strokeDasharray={`${pctStripe} ${100 - pctStripe}`} strokeDashoffset="0" />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#00457C" strokeWidth="3.8" strokeDasharray={`${pctPaypal} ${100 - pctPaypal}`} strokeDashoffset={`-${pctStripe}`} />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#9FE870" strokeWidth="3.8" strokeDasharray={`${pctWise} ${100 - pctWise}`} strokeDashoffset={`-${pctStripe + pctPaypal}`} />
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#FFD700" strokeWidth="3.8" strokeDasharray={`${pctTrans} ${100 - pctTrans}`} strokeDashoffset={`-${pctStripe + pctPaypal + pctWise}`} />
                  </svg>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: "900", color: theme.goldBright }}>${(totalPagosGlobal / 1000).toFixed(1)}k</span>
                    <span style={{ fontSize: "0.6rem", color: theme.textMuted, textTransform: "uppercase" }}>Global</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.72rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "8px", height: "8px", background: "#635BFF", borderRadius: "50%" }}></span> Stripe ({pctStripe}%)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "8px", height: "8px", background: "#00457C", borderRadius: "50%" }}></span> PayPal ({pctPaypal}%)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "8px", height: "8px", background: "#9FE870", borderRadius: "50%" }}></span> Wise ({pctWise}%)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "8px", height: "8px", background: theme.goldBright, borderRadius: "50%" }}></span> Banco ({pctTrans}%)</div>
                </div>
              </Card>

              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ color: theme.textLight, fontSize: "1rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>🔥 Top 5 Demanda de Productos</h3>
                  <Badge tone="gold">Catálogo Activo</Badge>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {productosTop.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>Cargando catálogo dinámico...</p>
                  ) : (
                    productosTop.map((prod, idx) => {
                      const maxMov = productosTop[0]?.movimientos || 1;
                      const pctBar = Math.max(15, (prod.movimientos / maxMov) * 100);
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
                            <span style={{ color: theme.textLight, fontWeight: "600" }}>
                              {idx + 1}. {prod.nombre}
                              {prod.sku && prod.sku !== "Sin SKU" && (
                                <span style={{ color: theme.goldBright, fontWeight: 700, marginLeft: "6px" }}>[{prod.sku}]</span>
                              )}
                            </span>
                            <strong style={{ color: theme.goldBright }}>{prod.movimientos} uds</strong>
                          </div>
                          <div style={{ width: "100%", backgroundColor: "#111", height: "8px", borderRadius: "4px", overflow: "hidden", border: `1px solid ${theme.borderGoldLight}` }}>
                            <div style={{ width: `${pctBar}%`, height: "100%", background: theme.goldGradient, boxShadow: "0 0 10px rgba(255,215,0,0.5)", borderRadius: "4px" }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* SECCIÓN: SKUs y CONTROL OPERATIVO */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "35px" }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ color: theme.textLight, fontSize: "1rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>📦 SKUs en Bases de Datos</h3>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>cablesdb, herrajesdb, accesoriosdb</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <ProgressBarItem label="Cables de Fibra Óptica (cablesdb)" count={skusCables} total={totalSkusFabricacion} color={theme.goldBright} />
                  <ProgressBarItem label="Herrajes de Tendido (herrajesdb)" count={skusHerrajes} total={totalSkusFabricacion} color={theme.green} />
                  <ProgressBarItem label="Accesorios y Empalmes (accesoriosdb)" count={skusAccesorios} total={totalSkusFabricacion} color="#29B6F6" />
                  <div style={{ marginTop: "10px", padding: "14px", background: theme.goldSoft, border: `1px solid ${theme.borderGoldLight}`, borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ display: "block", fontSize: "0.75rem", color: theme.textMuted }}>Especificación Técnica</span>
                      <strong style={{ color: theme.textLight, fontSize: "0.9rem" }}>Normativa 100% Nylon 66 / Sin Metal</strong>
                    </div>
                    <span style={{ color: theme.green, fontSize: "0.8rem", fontWeight: "bold" }}>✓ Verificado</span>
                  </div>
                </div>
              </Card>

              <Card>
                <Heading>⚙️ Control Operativo</Heading>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                    <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Fábricas / Proveedores</span>
                    <strong style={{ fontSize: "1.6rem", color: theme.goldBright, display: "block", marginTop: "4px" }}>{totalProveedores}</strong>
                    <span style={{ fontSize: "0.68rem", color: theme.green }}>Asia / Internacional</span>
                  </Card>
                  <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                    <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Órdenes de Producción</span>
                    <strong style={{ fontSize: "1.6rem", color: theme.textLight, display: "block", marginTop: "4px" }}>{totalOrdenesProduccion}</strong>
                    <span style={{ fontSize: "0.68rem", color: theme.goldBright }}>ordenes_produccion</span>
                  </Card>
                  <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                    <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Garantías / RMAs</span>
                    <strong style={{ fontSize: "1.6rem", color: theme.red, display: "block", marginTop: "4px" }}>{totalRmas}</strong>
                    <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Soporte posventa</span>
                  </Card>
                  <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                    <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Usuarios Portal</span>
                    <strong style={{ fontSize: "1.6rem", color: "#29B6F6", display: "block", marginTop: "4px" }}>{registrosInscripciones}</strong>
                    <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>Registrados</span>
                  </Card>
                </div>
              </Card>
            </div>

            {/* SECCIÓN NUEVA: MANUFACTURA Y PRODUCCIÓN */}
            <Card style={{ marginBottom: "35px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ color: theme.textLight, fontSize: "1.05rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>🏭 Manufactura y Producción</h3>
                <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>ordenes_produccion + orden_produccion_lineas</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "20px" }}>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Órdenes Totales</span>
                  <strong style={{ fontSize: "1.6rem", color: theme.goldBright, display: "block", marginTop: "4px" }}>{totalOrdenesProduccion}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Km Totales Producidos</span>
                  <strong style={{ fontSize: "1.6rem", color: theme.green, display: "block", marginTop: "4px" }}>{kmTotalesProducidos.toLocaleString("en-US", { maximumFractionDigits: 1 })}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Órdenes con Faltantes</span>
                  <strong style={{ fontSize: "1.6rem", color: ordenesConFaltantes > 0 ? theme.red : theme.green, display: "block", marginTop: "4px" }}>{ordenesConFaltantes}</strong>
                </Card>
              </div>
              <h4 style={{ color: theme.textMuted, fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "10px" }}>Distribución por Estado</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {ordenesPorEstado.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>Sin órdenes registradas en el período.</p>
                ) : (
                  ordenesPorEstado.map((o, idx) => (
                    <Badge key={idx} tone="gold">{o.estado}: {o.cantidad}</Badge>
                  ))
                )}
              </div>
            </Card>

            {/* SECCIÓN NUEVA: BODEGA & MATERIA PRIMA */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "35px" }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ color: theme.textLight, fontSize: "1rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>🧵 Bodega & Materia Prima</h3>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>materia_prima</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "18px" }}>
                  <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                    <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Materias Primas</span>
                    <strong style={{ fontSize: "1.5rem", color: theme.goldBright, display: "block", marginTop: "4px" }}>{totalMateriasPrimas}</strong>
                  </Card>
                  <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                    <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Valor Inventario</span>
                    <strong style={{ fontSize: "1.5rem", color: theme.green, display: "block", marginTop: "4px" }}>${valorInventarioMP.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
                  </Card>
                </div>
                <h4 style={{ color: theme.textMuted, fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "10px" }}>⚠️ Alertas de Stock Bajo</h4>
                {alertasStockBajo.length === 0 ? (
                  <p style={{ color: theme.green, fontSize: "0.8rem" }}>✓ Todo el stock está por encima del mínimo.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {alertasStockBajo.map((m, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: "6px", fontSize: "0.78rem" }}>
                        <span style={{ color: theme.textLight }}>{m.nombre}</span>
                        <span style={{ color: theme.red, fontWeight: 700 }}>{m.stock_actual} / min {m.stock_minimo} {m.unidad}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 style={{ color: theme.textLight, fontSize: "1rem", margin: "0 0 20px 0", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>📋 Últimos Movimientos de Inventario</h3>
                {ultimosMovimientos.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>Sin movimientos registrados.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {ultimosMovimientos.map((m, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(15,15,15,0.8)", borderRadius: "6px", fontSize: "0.76rem" }}>
                        <span style={{ color: theme.textLight }}>{m.descripcion || m.tipo}</span>
                        <span style={{ color: m.tipo === "entrada" || m.tipo === "ingreso" ? theme.green : theme.red, fontWeight: 700 }}>
                          {m.cantidad} {m.unidad}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* SECCIÓN NUEVA: CxC VENCIDAS Y CxP POR CUENTA */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "35px" }}>
              <Card>
                <h3 style={{ color: theme.textLight, fontSize: "1rem", margin: "0 0 20px 0", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>⏰ Cuentas por Cobrar Vencidas</h3>
                {cxcVencidas.length === 0 ? (
                  <p style={{ color: theme.green, fontSize: "0.8rem" }}>✓ Sin cuentas vencidas.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {cxcVencidas.map((c, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: "6px", fontSize: "0.78rem" }}>
                        <div>
                          <div style={{ color: theme.textLight, fontWeight: 600 }}>{c.cliente_nombre}</div>
                          <div style={{ color: theme.textMuted, fontSize: "0.7rem" }}>Venció: {c.fecha_vencimiento}</div>
                        </div>
                        <strong style={{ color: theme.red }}>${Number(c.saldo_pendiente).toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 style={{ color: theme.textLight, fontSize: "1rem", margin: "0 0 20px 0", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>🏷️ Cuentas por Pagar por Categoría</h3>
                {cxpPorCuenta.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>Sin egresos registrados en el período.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {cxpPorCuenta.map((c, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(15,15,15,0.8)", borderRadius: "6px", fontSize: "0.78rem" }}>
                        <span style={{ color: theme.textLight }}>{c.cuenta}</span>
                        <strong style={{ color: theme.goldBright }}>${c.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* SECCIÓN NUEVA: MARKETING */}
            <Card style={{ marginBottom: "35px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ color: theme.textLight, fontSize: "1.05rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>📣 Marketing</h3>
                <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>marketing_campaigns, marketing_leads, marketing_gastos</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "20px" }}>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Campañas Activas</span>
                  <strong style={{ fontSize: "1.5rem", color: theme.goldBright, display: "block", marginTop: "4px" }}>{campanasActivas}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Presupuesto Total</span>
                  <strong style={{ fontSize: "1.5rem", color: theme.textLight, display: "block", marginTop: "4px" }}>${presupuestoTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Gasto Real</span>
                  <strong style={{ fontSize: "1.5rem", color: theme.red, display: "block", marginTop: "4px" }}>${gastoRealMarketing.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Ingresos Generados</span>
                  <strong style={{ fontSize: "1.5rem", color: theme.green, display: "block", marginTop: "4px" }}>${ingresosPorCampanas.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Leads Totales</span>
                  <strong style={{ fontSize: "1.5rem", color: "#29B6F6", display: "block", marginTop: "4px" }}>{totalLeads}</strong>
                </Card>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <h4 style={{ color: theme.textMuted, fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "10px" }}>Leads por Estado</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {leadsPorEstado.length === 0 ? (
                      <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>Sin leads registrados.</p>
                    ) : (
                      leadsPorEstado.map((l, idx) => <Badge key={idx} tone="gold">{l.estado}: {l.cantidad}</Badge>)
                    )}
                  </div>
                </div>
                <div>
                  <h4 style={{ color: theme.textMuted, fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "10px" }}>Leads por Origen</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {leadsPorOrigen.length === 0 ? (
                      <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>Sin leads registrados.</p>
                    ) : (
                      leadsPorOrigen.map((l, idx) => <Badge key={idx} tone="neutral">{l.origen}: {l.cantidad}</Badge>)
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* SECCIÓN: TOP CLIENTES + SEGMENTACIÓN */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "35px" }}>
              <Card>
                <Heading>🏆 Top Clientes Corporativos</Heading>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {topClientes.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>Sin clientes facturados aún</p>
                  ) : (
                    topClientes.map((cli, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(20,20,20,0.6)", borderRadius: "6px", borderLeft: `3px solid ${theme.goldBright}` }}>
                        <span style={{ fontSize: "0.85rem", color: theme.textLight, fontWeight: "600" }}>{idx + 1}. {cli.empresa}</span>
                        <strong style={{ color: theme.goldBright, fontSize: "0.9rem" }}>${cli.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <Heading>🧭 Segmentación de Clientes</Heading>
                <h4 style={{ color: theme.textMuted, fontSize: "0.72rem", textTransform: "uppercase", marginBottom: "10px" }}>Por Perfil (ISP / Mayorista / Integrador / Usuario Final)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
                  {segmentacionPerfil.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>Sin clientes registrados.</p>
                  ) : (
                    segmentacionPerfil.map((s, idx) => {
                      const maxCant = segmentacionPerfil[0]?.cantidad || 1;
                      const pctBar = Math.max(10, (s.cantidad / maxCant) * 100);
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "4px" }}>
                            <span style={{ color: theme.textLight }}>{s.perfil}</span>
                            <strong style={{ color: theme.goldBright }}>{s.cantidad}</strong>
                          </div>
                          <div style={{ width: "100%", backgroundColor: "#111", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${pctBar}%`, height: "100%", background: theme.goldGradient, borderRadius: "3px" }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <h4 style={{ color: theme.textMuted, fontSize: "0.72rem", textTransform: "uppercase", marginBottom: "10px" }}>Por Lista de Precios (A/B/C/D)</h4>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {segmentacionListaPrecio.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>Sin datos.</p>
                  ) : (
                    segmentacionListaPrecio.map((s, idx) => <Badge key={idx} tone="neutral">Lista {s.lista}: {s.cantidad}</Badge>)
                  )}
                </div>
              </Card>
            </div>

            {/* SECCIÓN NUEVA: PERSONAL (sin montos de planilla) */}
            <Card style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ color: theme.textLight, fontSize: "1.05rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>👥 Personal</h3>
                <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>colaboradores, marcajes — solo headcount / asistencia</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "20px" }}>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Colaboradores Totales</span>
                  <strong style={{ fontSize: "1.6rem", color: theme.goldBright, display: "block", marginTop: "4px" }}>{totalColaboradores}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Activos</span>
                  <strong style={{ fontSize: "1.6rem", color: theme.green, display: "block", marginTop: "4px" }}>{colaboradoresActivos}</strong>
                </Card>
                <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)" }}>
                  <span style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase" }}>Con Marcaje Hoy</span>
                  <strong style={{ fontSize: "1.6rem", color: "#29B6F6", display: "block", marginTop: "4px" }}>{marcajesHoy}</strong>
                </Card>
              </div>
              <h4 style={{ color: theme.textMuted, fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "10px" }}>Por Departamento</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {colaboradoresPorDepto.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem" }}>Sin colaboradores registrados.</p>
                ) : (
                  colaboradoresPorDepto.map((c, idx) => <Badge key={idx} tone="gold">{c.depto}: {c.cantidad}</Badge>)
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// COMPONENTES DE DISEÑO EXCLUSIVO
function MetricKpiCard({ title, amount, count, badge, isUp, glow }: any) {
  return (
    <Card style={{
      boxShadow: `0 8px 25px rgba(0,0,0,0.5), inset 0 0 15px ${glow}10`,
      backdropFilter: "blur(10px)",
      marginBottom: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "bold" }}>{title}</span>
        <Badge tone={isUp ? "success" : "danger"}>{badge}</Badge>
      </div>
      <h3 style={{ fontSize: "1.55rem", color: theme.textLight, margin: "5px 0", fontWeight: "900", letterSpacing: "0.5px" }}>{amount}</h3>
      <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>{count}</span>
    </Card>
  );
}

function ForecastCard({ label, valor }: { label: string; valor: number }) {
  return (
    <Card style={{ padding: 16, marginBottom: 0, boxShadow: "none", background: "rgba(15,15,15,0.8)", border: "1px solid rgba(179,136,255,0.3)" }}>
      <span style={{ fontSize: "0.68rem", color: theme.textMuted, textTransform: "uppercase" }}>{label}</span>
      <strong style={{ display: "block", fontSize: "1.2rem", color: "#B388FF", marginTop: "4px" }}>
        ${valor.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </strong>
    </Card>
  );
}

function ProgressBarItem({ label, count, total, color }: any) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
        <span style={{ color: theme.textMuted }}>{label}</span>
        <strong style={{ color: color }}>{count} SKUs ({pct}%)</strong>
      </div>
      <div style={{ width: "100%", backgroundColor: "#111", height: "8px", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, boxShadow: `0 0 8px ${color}88`, borderRadius: "4px" }} />
      </div>
    </div>
  );
}