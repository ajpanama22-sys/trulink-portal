import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, PageHeader, Button, Badge, estadoToTone, inputStyle } from "../../lib/ui";

type CategoriaReporte = "ventas" | "contable" | "inventario" | "proveedores" | "clientes" | "proyecciones";

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Tasa oficial de ITBMS en Panamá. Se aplica u omite según el toggle
// `aplicaItbms`, porque el negocio opera en Zona Franca (exento) pero
// puede necesitar facturar con ITBMS en otros escenarios (dualidad real).
const TASA_ITBMS = 0.07;

// -------- Motor de Inteligencia Predictiva (compartido con Analítica) --------
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

function agregarPorMes(quotes: any[], mesesHistoria: number) {
  const hoy = new Date();
  const buckets = [] as { clave: string; mes: string; cotizado: number; facturado: number; cobrado: number }[];
  for (let i = mesesHistoria - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    buckets.push({ clave: `${d.getFullYear()}-${d.getMonth()}`, mes: NOMBRES_MES[d.getMonth()], cotizado: 0, facturado: 0, cobrado: 0 });
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

export default function Reportes() {
  const [cargando, setCargando] = useState(true);
  const [categoria, setCategoria] = useState<CategoriaReporte>("contable");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [fechaHoraActual, setFechaHoraActual] = useState("");

  // Dualidad ITBMS: false = Zona Franca (exento, default del negocio),
  // true = aplica el 7% normal. El usuario decide en cada consulta.
  const [aplicaItbms, setAplicaItbms] = useState(false);

  // Datasets consolidados desde Supabase
  const [reporteVentas, setReporteVentas] = useState<any[]>([]);
  const [reporteContable, setReporteContable] = useState<any[]>([]);
  const [reporteInventario, setReporteInventario] = useState<any[]>([]);
  const [reporteProveedores, setReporteProveedores] = useState<any[]>([]);
  const [reporteClientes, setReporteClientes] = useState<any[]>([]);
  const [reporteProyecciones, setReporteProyecciones] = useState<any[]>([]);
  const [confianzaModelo, setConfianzaModelo] = useState(0);

  // Estados de resumen contable
  const [resumenFinanciero, setResumenFinanciero] = useState({
    ingresosPagados: 0,
    cuentasPorCobrar: 0,
    costosOperativos: 0,
    utilidadBruta: 0,
    impuestosRetenidos: 0,
    margenPromedio: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setFechaHoraActual(now.toISOString().replace("T", " ").substring(0, 19));
    }, 1000);

    const hoy = new Date();
    const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
    setFechaDesde(haceUnMes.toISOString().split("T")[0]);
    setFechaHasta(hoy.toISOString().split("T")[0]);

    cargarTodosLosReportes(haceUnMes.toISOString().split("T")[0], hoy.toISOString().split("T")[0]);
    cargarProyeccionesIA();

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarTodosLosReportes = async (desde: string, hasta: string) => {
    if (!supabase) return;
    setCargando(true);

    try {
      const { data: quotesData, error: errQuotes } = await supabase
        .from("quotes")
        .select("*")
        .gte("created_at", `${desde}T00:00:00`)
        .lte("created_at", `${hasta}T23:59:59`)
        .order("created_at", { ascending: false });

      if (errQuotes) console.error("Error consultando quotes:", errQuotes);

      const { data: prodOrdersData } = await supabase.from("production_orders").select("*");

      const quotesList = quotesData || [];
      const prodList = prodOrdersData || [];

      const quotesFormatted = quotesList.map((q) => {
        let itemsProcesados: any[] = [];
        if (typeof q.items === "string") {
          try { itemsProcesados = JSON.parse(q.items); } catch (e) { itemsProcesados = []; }
        } else if (Array.isArray(q.items)) {
          itemsProcesados = q.items;
        }
        const primerProducto = itemsProcesados[0]?.Descripción || itemsProcesados[0]?.descripcion || "Productos Varios Trulink";
        return {
          id: q.id,
          codigo: `COT-${q.id.toString().padStart(5, "0")}`,
          fecha: q.created_at ? q.created_at.split("T")[0] : "N/A",
          cliente: q.empresa || q.email || "Cliente Corporativo",
          pais: q.pais || q.country || "Panamá",
          monto: Number(q.total || 0),
          estadoPago: q.estado_pago || (q.pdf_url ? "pagado" : "pendiente"),
          estadoCotizacion: q.status || "activa",
          metodoPago: q.metodo_pago || "Transferencia / Bancario",
          resumenItem: itemsProcesados.length > 1 ? `${primerProducto} (+${itemsProcesados.length - 1} más)` : primerProducto,
        };
      });
      setReporteVentas(quotesFormatted);

      let ingPagados = 0;
      let cxc = 0;
      let totalCostos = 0;
      const libroContable: any[] = [];

      quotesList.forEach((q) => {
        const montoTotal = Number(q.total || 0);
        const esPagado = q.estado_pago === "pagado" || q.status === "facturado" || !!q.pdf_url;
        const costoEstimado = montoTotal * 0.62;
        // ITBMS condicionado: en Zona Franca (aplicaItbms=false) el impuesto es $0.
        const itbmsImpuesto = aplicaItbms ? montoTotal * TASA_ITBMS : 0;
        const utilidadEfectiva = esPagado ? montoTotal - costoEstimado : 0;

        if (esPagado) {
          ingPagados += montoTotal;
          totalCostos += costoEstimado;
        } else {
          cxc += montoTotal;
        }

        libroContable.push({
          id: q.id,
          asiento: `ASI-${q.id.toString().padStart(6, "0")}`,
          fecha: q.created_at ? q.created_at.split("T")[0] : "N/A",
          cuenta: esPagado ? "1101 - Caja y Bancos" : "1105 - Cuentas por Cobrar (CxC)",
          concepto: `Facturación Cliente: ${q.empresa || q.email || "Corporativo"}`,
          debito: montoTotal,
          credito: 0,
          costoProduccion: costoEstimado,
          impuestoItbms: itbmsImpuesto,
          utilidad: utilidadEfectiva,
          estadoFiscal: esPagado ? "Liquidado" : "Por Cobrar",
          metodo: q.metodo_pago || "Transferencia",
        });
      });

      prodList.forEach((p, idx) => {
        const costoPO = Number(p.costo_total || p.monto || 0);
        if (costoPO > 0) {
          totalCostos += costoPO;
          libroContable.push({
            id: `PO-${p.id || idx}`,
            asiento: `ASI-PO-${(p.id || idx).toString().padStart(4, "0")}`,
            fecha: p.created_at ? p.created_at.split("T")[0] : desde,
            cuenta: "2105 - Cuentas por Pagar Proveedores (CxP)",
            concepto: `Costo Fabril Órden Producción: ${p.proveedor || "Fábrica Asia"}`,
            debito: 0,
            credito: costoPO,
            costoProduccion: costoPO,
            impuestoItbms: 0,
            utilidad: -costoPO,
            estadoFiscal: "Pasivo Operativo",
            metodo: "Carta de Crédito / LC",
          });
        }
      });

      setReporteContable(libroContable);

      const utilidadTotal = ingPagados - totalCostos;
      const margen = ingPagados > 0 ? (utilidadTotal / ingPagados) * 100 : 0;

      setResumenFinanciero({
        ingresosPagados: ingPagados,
        cuentasPorCobrar: cxc,
        costosOperativos: totalCostos,
        utilidadBruta: utilidadTotal,
        impuestosRetenidos: aplicaItbms ? ingPagados * TASA_ITBMS : 0,
        margenPromedio: Number(margen.toFixed(1)),
      });

      const [{ data: cables }, { data: herrajes }, { data: accesorios }] = await Promise.all([
        supabase.from("cablesdb").select("*"),
        supabase.from("herrajesdb").select("*"),
        supabase.from("accesoriosdb").select("*"),
      ]);

      const invCombinado = [
        ...(cables || []).map((c) => ({ ...c, categoria: "Cables de Fibra Optica", db: "cablesdb" })),
        ...(herrajes || []).map((h) => ({ ...h, categoria: "Herrajes de Tendido", db: "herrajesdb" })),
        ...(accesorios || []).map((a) => ({ ...a, categoria: "Accesorios y Empalmes", db: "accesoriosdb" })),
      ].map((item, idx) => ({
        id: item.id || idx,
        // Fix: las tablas reales (cablesdb/herrajesdb/accesoriosdb) usan
        // columnas capitalizadas ("SKU", "Item #"), no "sku" en minúscula.
        // Antes esto siempre caía al fallback inventado TLK-SKU-xxx.
        sku: item.SKU || item["Item #"] || item.Item || `SIN-SKU-${idx + 1}`,
        descripcion: item.Descripción || item.descripcion || "Sin descripción",
        categoria: item.categoria,
        tablaOrigen: item.db,
        especificacion: item.Especificaciones || item.especificacion || item.Familia || "—",
        precioRef: Number(item.precio_a || item.precio || item.price || 0),
      }));
      setReporteInventario(invCombinado);

      const { data: provData } = await supabase.from("proveedores").select("*");
      const provFormatted = (provData || []).map((p, idx) => ({
        id: p.id || idx,
        nombre: p.nombre || p.empresa || "Fábrica Internacional",
        region: p.pais || p.region || "Asia / Internacional",
        categoria: p.categoria || "Ensamblaje Fibra Optica",
        ordenesActivas: prodList.filter((o) => o.proveedor_id === p.id || o.proveedor === p.nombre).length,
        estatus: p.estatus || "Certificado",
      }));
      setReporteProveedores(provFormatted);

      const { data: usersData } = await supabase.from("clientes").select("*");
      const usersFormatted = (usersData || []).map((u, idx) => ({
        id: u.id || idx,
        nombre: u.nombre || u.full_name || u.email?.split("@")[0] || "Usuario Portal",
        email: u.email || "N/A",
        empresa: u.empresa || u.company || "Empresa VIP",
        pais: u.pais || u.country || "Internacional",
        fechaRegistro: u.created_at ? u.created_at.split("T")[0] : "2026-01-01",
        rol: u.role || "Cliente Directo",
      }));
      setReporteClientes(usersFormatted);
    } catch (err) {
      console.error("Error al compilar matriz de reportes:", err);
    } finally {
      setCargando(false);
    }
  };

  // -------- Proyecciones IA: reutiliza 6 meses reales para proyectar 3 meses --------
  const cargarProyeccionesIA = async () => {
    if (!supabase) return;
    try {
      const hoy = new Date();
      const desde6 = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().split("T")[0];
      const { data } = await supabase.from("quotes").select("*").gte("created_at", `${desde6}T00:00:00`);
      const quotes = data || [];
      const buckets = agregarPorMes(quotes, 6);

      const regCobrado = regresionLineal(buckets.map((b) => b.cobrado));
      const regCotizado = regresionLineal(buckets.map((b) => b.cotizado));
      const tasaConversionHistorica = buckets.reduce((a, b) => a + b.cotizado, 0) > 0
        ? buckets.reduce((a, b) => a + b.facturado, 0) / buckets.reduce((a, b) => a + b.cotizado, 0)
        : 0.5;

      const n = buckets.length;
      const filas = [1, 2, 3].map((k) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
        const cotizadoProyectado = Math.max(0, regCotizado.pendiente * (n - 1 + k) + regCotizado.intercepto);
        const cobradoProyectado = Math.max(0, regCobrado.pendiente * (n - 1 + k) + regCobrado.intercepto);
        const facturadoProyectado = cotizadoProyectado * tasaConversionHistorica;
        return {
          mes: `${NOMBRES_MES[d.getMonth()]} ${d.getFullYear()}`,
          cotizadoProyectado,
          facturadoProyectado,
          cobradoProyectado,
        };
      });

      setReporteProyecciones(filas);
      setConfianzaModelo(regCobrado.r2);
    } catch (err) {
      console.error("Error calculando proyecciones IA:", err);
    }
  };

  const aplicarFiltroFecha = () => {
    cargarTodosLosReportes(fechaDesde, fechaHasta);
  };

  // Cambia el toggle de ITBMS y recalcula inmediatamente el reporte
  // vigente con la tasa correspondiente (0% Zona Franca / 7% normal).
  const alternarItbms = (checked: boolean) => {
    setAplicaItbms(checked);
  };

  // Recalcular automáticamente cuando cambia el toggle de ITBMS
  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      cargarTodosLosReportes(fechaDesde, fechaHasta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicaItbms]);

  // Filtrado reactivo en memoria por término de búsqueda
  const datasetActivo = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (categoria === "contable") {
      return reporteContable.filter((i) => i.asiento.toLowerCase().includes(q) || i.concepto.toLowerCase().includes(q) || i.cuenta.toLowerCase().includes(q));
    }
    if (categoria === "ventas") {
      return reporteVentas.filter((i) => i.codigo.toLowerCase().includes(q) || i.cliente.toLowerCase().includes(q) || i.resumenItem.toLowerCase().includes(q));
    }
    if (categoria === "inventario") {
      return reporteInventario.filter((i) => i.sku.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q) || i.categoria.toLowerCase().includes(q));
    }
    if (categoria === "proveedores") {
      return reporteProveedores.filter((i) => i.nombre.toLowerCase().includes(q) || i.region.toLowerCase().includes(q) || i.categoria.toLowerCase().includes(q));
    }
    if (categoria === "proyecciones") {
      return reporteProyecciones;
    }
    return reporteClientes.filter((i) => i.nombre.toLowerCase().includes(q) || i.empresa.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));
  }, [categoria, busqueda, reporteContable, reporteVentas, reporteInventario, reporteProveedores, reporteClientes, reporteProyecciones]);

  // KPIs por módulo
  const resumenMétricas = useMemo(() => {
    if (categoria === "contable") {
      return {
        kpi1: `$${resumenFinanciero.ingresosPagados.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        label1: "Ingresos Cobrados (Caja)",
        kpi2: `$${resumenFinanciero.cuentasPorCobrar.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        label2: "Por Cobrar (CxC)",
        kpi3: `$${resumenFinanciero.utilidadBruta.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        label3: `Utilidad Bruta (${resumenFinanciero.margenPromedio}% Margen)`,
      };
    }
    if (categoria === "ventas") {
      const totalMonto = datasetActivo.reduce((acc, curr) => acc + curr.monto, 0);
      const facturadas = datasetActivo.filter((i) => i.estadoPago === "pagado").length;
      return {
        kpi1: `$${totalMonto.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        label1: "Monto Total Cotizado",
        kpi2: datasetActivo.length.toString(),
        label2: "Cotizaciones Emitidas",
        kpi3: `${facturadas} Cobradas`,
        label3: "Efectividad Comerciales",
      };
    }
    if (categoria === "inventario") {
      return {
        kpi1: datasetActivo.length.toString(),
        label1: "SKUs Registrados",
        kpi2: "100% Non-Metallic",
        label2: "Estándar Nylon 66 / Fibra",
        kpi3: "3 Almacenes",
        label3: "cablesdb, herrajesdb, accesoriosdb",
      };
    }
    if (categoria === "proveedores") {
      return {
        kpi1: datasetActivo.length.toString(),
        label1: "Fábricas Homologadas",
        kpi2: "Asia / Tier 1",
        label2: "Origen de Cadena Suministro",
        kpi3: "Auditoría VIP",
        label3: "Estatus de Calidad Operativa",
      };
    }
    if (categoria === "proyecciones") {
      const sumaCobrado = reporteProyecciones.reduce((a, r) => a + r.cobradoProyectado, 0);
      return {
        kpi1: `$${sumaCobrado.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        label1: "Cobro Proyectado (3 meses)",
        kpi2: `${(confianzaModelo * 100).toFixed(0)}%`,
        label2: "Confianza del Modelo (R²)",
        kpi3: "Regresión Lineal",
        label3: "Método Predictivo (6 meses reales)",
      };
    }
    return {
      kpi1: datasetActivo.length.toString(),
      label1: "Clientes Registrados",
      kpi2: "B2B Corporativo",
      label2: "Segmento de Cuenta",
      kpi3: "Global Hub",
      label3: "Alcance Internacional",
    };
  }, [categoria, datasetActivo, resumenFinanciero, reporteProyecciones, confianzaModelo]);

  // Exportación CSV
  const exportarCSV = () => {
    let csvContent = `TRULINK FIBER LLC - REPORTE CONTABLE Y EJECUTIVO DE ${categoria.toUpperCase()}\n`;
    csvContent += `Fecha Emisión: ${fechaHoraActual}\n`;
    csvContent += `Rango: ${fechaDesde} hasta ${fechaHasta}\n`;
    csvContent += `ITBMS aplicado: ${aplicaItbms ? "SÍ (7%)" : "NO (Zona Franca)"}\n\n`;

    if (categoria === "contable") {
      csvContent += "Asiento,Fecha,Cuenta Contable,Concepto / Cliente,Débito (Ingreso),Crédito (Pasivo),Costo Fabril Est.,ITBMS (7%),Utilidad Neta,Estado Fiscal\n";
      datasetActivo.forEach((r) => {
        csvContent += `"${r.asiento}","${r.fecha}","${r.cuenta}","${r.concepto}",${r.debito},${r.credito},${r.costoProduccion},${r.impuestoItbms},${r.utilidad},"${r.estadoFiscal}"\n`;
      });
    } else if (categoria === "ventas") {
      csvContent += "Código,Fecha,Cliente,País,Monto USD,Estado Pago,Método,Detalle Producto\n";
      datasetActivo.forEach((r) => {
        csvContent += `"${r.codigo}","${r.fecha}","${r.cliente}","${r.pais}",${r.monto},"${r.estadoPago}","${r.metodoPago}","${r.resumenItem}"\n`;
      });
    } else if (categoria === "inventario") {
      csvContent += "SKU,Descripción,Categoría,Tabla Supabase,Especificación\n";
      datasetActivo.forEach((r) => {
        csvContent += `"${r.sku}","${r.descripcion}","${r.categoria}","${r.tablaOrigen}","${r.especificacion}"\n`;
      });
    } else if (categoria === "proveedores") {
      csvContent += "ID,Nombre Fábrica,Región,Categoría,Órdenes Activas,Estatus\n";
      datasetActivo.forEach((r) => {
        csvContent += `"${r.id}","${r.nombre}","${r.region}","${r.categoria}",${r.ordenesActivas},"${r.estatus}"\n`;
      });
    } else if (categoria === "proyecciones") {
      csvContent += `Confianza del Modelo (R²): ${(confianzaModelo * 100).toFixed(0)}%\n`;
      csvContent += "Mes,Cotizado Proyectado,Facturado Proyectado,Cobrado Proyectado\n";
      datasetActivo.forEach((r) => {
        csvContent += `"${r.mes}",${r.cotizadoProyectado.toFixed(2)},${r.facturadoProyectado.toFixed(2)},${r.cobradoProyectado.toFixed(2)}\n`;
      });
    } else {
      csvContent += "ID,Nombre / Contacto,Empresa,Email,País,Fecha Registro,Rol\n";
      datasetActivo.forEach((r) => {
        csvContent += `"${r.id}","${r.nombre}","${r.empresa}","${r.email}","${r.pais}","${r.fechaRegistro}","${r.rol}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Trulink_Reporte_${categoria}_${fechaDesde}_${fechaHasta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportación JSON (estructura completa, útil para integraciones)
  const exportarJSON = () => {
    const blob = new Blob([JSON.stringify({ categoria, generado: fechaHoraActual, rango: { fechaDesde, fechaHasta }, aplicaItbms, datos: datasetActivo, resumen: resumenMétricas }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Trulink_Reporte_${categoria}_${fechaDesde}_${fechaHasta}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportación Excel real (.xlsx) usando SheetJS si está instalado; si no, cae a CSV automáticamente.
  // Requiere: npm install xlsx
  const exportarExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const hoja = XLSX.utils.json_to_sheet(datasetActivo);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, categoria.substring(0, 30));
      XLSX.writeFile(libro, `Trulink_Reporte_${categoria}_${fechaDesde}_${fechaHasta}.xlsx`);
    } catch (err) {
      console.warn("Librería 'xlsx' no disponible (ejecute: npm install xlsx). Exportando CSV como respaldo.", err);
      exportarCSV();
    }
  };

  // Exportación PDF real (jsPDF + autoTable) con logo, fecha y hora impresos en el documento
  const exportarPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const logo = await cargarLogoBase64();

      const doc = new jsPDF({ orientation: "landscape" });
      let xTexto = 14;

      if (logo) {
        const anchoLogo = 26;
        const altoLogo = anchoLogo * (logo.height / logo.width);
        doc.addImage(logo.data, "PNG", 14, 8, anchoLogo, altoLogo);
        xTexto = 14 + anchoLogo + 8;
      }

      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(`Trulink Fiber LLC - Reporte de ${categoria.toUpperCase()}`, xTexto, 15);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generado: ${fechaHoraActual}`, xTexto, 20);
      doc.text(`Rango: ${fechaDesde} a ${fechaHasta}  •  ITBMS: ${aplicaItbms ? "7% aplicado" : "Exento (Zona Franca)"}`, xTexto, 25);

      let head: string[][] = [];
      let body: any[][] = [];

      if (categoria === "contable") {
        head = [["Asiento", "Fecha", "Cuenta", "Concepto", "Débito", "Crédito", "ITBMS", "Utilidad", "Estado"]];
        body = datasetActivo.map((r) => [r.asiento, r.fecha, r.cuenta, r.concepto, `$${r.debito.toFixed(2)}`, `$${r.credito.toFixed(2)}`, `$${r.impuestoItbms.toFixed(2)}`, `$${r.utilidad.toFixed(2)}`, r.estadoFiscal]);
      } else if (categoria === "ventas") {
        head = [["Código", "Fecha", "Cliente", "País", "Producto", "Método", "Monto", "Estado"]];
        body = datasetActivo.map((r) => [r.codigo, r.fecha, r.cliente, r.pais, r.resumenItem, r.metodoPago, `$${r.monto.toFixed(2)}`, r.estadoPago]);
      } else if (categoria === "inventario") {
        head = [["SKU", "Descripción", "Categoría", "Tabla", "Especificación"]];
        body = datasetActivo.map((r) => [r.sku, r.descripcion, r.categoria, r.tablaOrigen, r.especificacion]);
      } else if (categoria === "proveedores") {
        head = [["ID", "Nombre", "Región", "Categoría", "Órdenes", "Estatus"]];
        body = datasetActivo.map((r) => [r.id, r.nombre, r.region, r.categoria, r.ordenesActivas, r.estatus]);
      } else if (categoria === "proyecciones") {
        head = [["Mes", "Cotizado Proyectado", "Facturado Proyectado", "Cobrado Proyectado"]];
        body = datasetActivo.map((r) => [r.mes, `$${r.cotizadoProyectado.toFixed(2)}`, `$${r.facturadoProyectado.toFixed(2)}`, `$${r.cobradoProyectado.toFixed(2)}`]);
      } else {
        head = [["ID", "Nombre", "Empresa", "Email", "País", "Rol"]];
        body = datasetActivo.map((r) => [r.id, r.nombre, r.empresa, r.email, r.pais, r.rol]);
      }

      autoTable(doc, {
        startY: 32,
        head,
        body,
        theme: "grid",
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 215, 0] },
        styles: { fontSize: 8 },
      });

      doc.save(`Trulink_Reporte_${categoria}_${fechaDesde}_${fechaHasta}.pdf`);
    } catch (err) {
      console.error("Error generando PDF, usando impresión del navegador como respaldo:", err);
      window.print();
    }
  };

  return (
    <div style={{ display: "flex" }}>
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
        }
      `}</style>
      <Sidebar currentActive="reportes" />

      <div style={pageWrapStyle()}>

        {/* ENCABEZADO EXECUTIVE */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 4 }}>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ height: "48px", objectFit: "contain", filter: "drop-shadow(0 0 12px rgba(255,215,0,0.5))" }} />
          <Badge tone="gold">Enterprise Edition</Badge>
        </div>

        <PageHeader
          title="Auditoría & Contabilidad"
          subtitle="Consola de Estados Financieros y Reportes Consolidados • Trulink Fiber LLC"
          counterLabel={fechaHoraActual || "Cargando..."}
        />

        <div className="no-imprimir" style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "flex-end", marginBottom: 25 }}>
          <Button variant="outline-gold" onClick={exportarExcel}>📊 Excel (.xlsx)</Button>
          <Button variant="outline-gold" onClick={exportarCSV}>📄 CSV</Button>
          <Button variant="outline-gold" onClick={exportarJSON}>🗂️ JSON</Button>
          <Button variant="gold" onClick={exportarPDF}>📄 PDF</Button>
        </div>

        {/* SELECTOR DE PESTAÑAS (INCLUYENDO PROYECCIONES IA) */}
        <div className="no-imprimir" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px", marginBottom: "25px" }}>
          <CategoryTab title="Reportes Contables" subtitle="Libro Mayor y P&L" active={categoria === "contable"} onClick={() => setCategoria("contable")} icon="⚖️" />
          <CategoryTab title="Ventas & Cobros" subtitle="Tabla quotes" active={categoria === "ventas"} onClick={() => setCategoria("ventas")} icon="📈" />
          <CategoryTab title="Inventario SKUs" subtitle="Cables, Herrajes, Acc." active={categoria === "inventario"} onClick={() => setCategoria("inventario")} icon="📦" />
          <CategoryTab title="Proveedores" subtitle="Tabla proveedores" active={categoria === "proveedores"} onClick={() => setCategoria("proveedores")} icon="🏭" />
          <CategoryTab title="Clientes CRM" subtitle="Tabla clientes" active={categoria === "clientes"} onClick={() => setCategoria("clientes")} icon="👥" />
          <CategoryTab title="Proyecciones IA" subtitle="Regresión predictiva" active={categoria === "proyecciones"} onClick={() => setCategoria("proyecciones")} icon="🤖" />
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        {categoria !== "proyecciones" && (
          <div className="no-imprimir">
            <Card style={{ marginBottom: 25, padding: "18px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1, minWidth: "300px" }}>
                  <span style={{ color: theme.gold, fontSize: "1.1rem" }}>🔍</span>
                  <input
                    type="text"
                    placeholder={`Filtrar en ${categoria}... (Cuenta, Asiento, Cliente, SKU)`}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Ventana Contable:</span>
                  <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
                  <span style={{ color: theme.gold, fontWeight: "bold" }}>→</span>
                  <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
                  <Button variant="gold" onClick={aplicarFiltroFecha}>Actualizar</Button>

                  {/* Dualidad ITBMS: el negocio opera en Zona Franca (exento por
                      defecto) pero puede necesitar aplicar el 7% en otros casos.
                      Este toggle recalcula todo el reporte al instante. */}
                  <label
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      fontSize: "0.78rem", color: aplicaItbms ? theme.gold : theme.textMuted,
                      border: `1px solid ${aplicaItbms ? theme.borderGoldCounter : theme.borderGoldLight}`,
                      padding: "8px 14px", borderRadius: theme.radiusSm,
                      background: aplicaItbms ? theme.goldSoft : "transparent",
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={aplicaItbms}
                      onChange={(e) => alternarItbms(e.target.checked)}
                    />
                    Aplicar ITBMS 7% {aplicaItbms ? "" : "(hoy: Exento — Zona Franca)"}
                  </label>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TOP METRICS KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "25px" }}>
          <MetricKpiCard title={resumenMétricas.label1} value={resumenMétricas.kpi1} border={theme.gold} />
          <MetricKpiCard title={resumenMétricas.label2} value={resumenMétricas.kpi2} border="#29B6F6" />
          <MetricKpiCard title={resumenMétricas.label3} value={resumenMétricas.kpi3} border={theme.green} />
        </div>

        {/* SI ES CONTABLE: MOSTRAR BALANCE FISCAL RAPIDO */}
        {categoria === "contable" && (
          <Card style={{ marginBottom: 25, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ color: theme.textLight, fontSize: "0.95rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
                🏛️ Desglose Fiscal & Impuestos Estimados ({aplicaItbms ? "ITBMS 7%" : "Exento — Zona Franca"})
              </h3>
              <span style={{ color: theme.gold, fontSize: "0.75rem", border: `1px solid ${theme.borderGold}`, padding: "2px 8px", borderRadius: "4px" }}>
                Moneda: USD ($)
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", fontSize: "0.82rem" }}>
              <div style={subCardStyle}>
                <span style={{ color: theme.textMuted, display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Ingresos Brutos Facturados</span>
                <strong style={{ color: theme.textLight, fontSize: "1.1rem" }}>${(resumenFinanciero.ingresosPagados + resumenFinanciero.cuentasPorCobrar).toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={subCardStyle}>
                <span style={{ color: theme.textMuted, display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Costo Fabril Total (COGS)</span>
                <strong style={{ color: theme.red, fontSize: "1.1rem" }}>${resumenFinanciero.costosOperativos.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={subCardStyle}>
                <span style={{ color: theme.textMuted, display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Retención Impuesto ITBMS ({aplicaItbms ? "7%" : "0% Z.F."})</span>
                <strong style={{ color: "#29B6F6", fontSize: "1.1rem" }}>${resumenFinanciero.impuestosRetenidos.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={subCardStyle}>
                <span style={{ color: theme.textMuted, display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Margen Operativo Bruto</span>
                <strong style={{ color: theme.green, fontSize: "1.1rem" }}>{resumenFinanciero.margenPromedio}%</strong>
              </div>
            </div>
          </Card>
        )}

        {/* SI ES PROYECCIONES: NOTA METODOLÓGICA */}
        {categoria === "proyecciones" && (
          <Card style={{ marginBottom: 25, padding: 20, border: "1px solid rgba(179,136,255,0.35)" }}>
            <h3 style={{ color: theme.textLight, fontSize: "0.9rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>🤖 Metodología Predictiva</h3>
            <p style={{ color: theme.textMuted, fontSize: "0.8rem", marginTop: "8px", lineHeight: 1.6 }}>
              El modelo aplica regresión lineal simple sobre los últimos 6 meses reales de cotizaciones y cobros de la tabla <code>quotes</code>, y proyecta los próximos 3 meses. La confianza (R²) indica qué tan bien la tendencia lineal explica el comportamiento histórico: valores cercanos a 100% indican una tendencia estable, mientras que valores bajos sugieren mayor volatilidad y menor certeza en la proyección.
            </p>
          </Card>
        )}

        {/* TABLA PRINCIPAL - LIBRO AUXILIAR CONTABLE Y REPORTES */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ color: theme.textLight, fontSize: "1.05rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
              {categoria === "contable" ? "📖 Libro Auxiliar de Asientos Contables" : categoria === "proyecciones" ? "🔮 Proyección Financiera a 3 Meses" : `📑 Matriz Consolidada de ${categoria.toUpperCase()}`}
            </h3>
            <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              {datasetActivo.length} registros {categoria === "proyecciones" ? "proyectados" : "auditados"}
            </span>
          </div>

          {cargando && categoria !== "proyecciones" ? (
            <div style={{ padding: "60px", textAlign: "center" }}>
              <div style={{ width: "40px", height: "40px", border: `3px solid ${theme.goldSoft}`, borderTop: `3px solid ${theme.gold}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 15px auto" }} />
              <p style={{ color: theme.gold, letterSpacing: "1px", fontSize: "0.8rem", textTransform: "uppercase" }}>Cargando Libros Contables desde Supabase...</p>
            </div>
          ) : datasetActivo.length === 0 ? (
            <div style={{ padding: "50px", textAlign: "center", color: theme.textMuted, fontSize: "0.9rem" }}>
              No se encontraron asientos ni registros para este período.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme.borderGoldCounter}`, color: theme.gold, textTransform: "uppercase", letterSpacing: "1px", fontSize: "0.72rem" }}>
                    {categoria === "contable" && (
                      <>
                        <th style={thStyle}>Nº Asiento</th>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Cuenta Contable</th>
                        <th style={thStyle}>Concepto / Descripción</th>
                        <th style={thStyle}>Débito ($)</th>
                        <th style={thStyle}>Crédito ($)</th>
                        <th style={thStyle}>ITBMS {aplicaItbms ? "(7%)" : "(0%)"}</th>
                        <th style={thStyle}>Utilidad Est.</th>
                        <th style={thStyle}>Estado</th>
                      </>
                    )}
                    {categoria === "ventas" && (
                      <>
                        <th style={thStyle}>Código</th>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Cliente</th>
                        <th style={thStyle}>País</th>
                        <th style={thStyle}>Resumen de Producto</th>
                        <th style={thStyle}>Método</th>
                        <th style={thStyle}>Monto (USD)</th>
                        <th style={thStyle}>Estatus</th>
                      </>
                    )}
                    {categoria === "inventario" && (
                      <>
                        <th style={thStyle}>SKU</th>
                        <th style={thStyle}>Descripción (Descripción)</th>
                        <th style={thStyle}>Categoría</th>
                        <th style={thStyle}>Tabla Origen</th>
                        <th style={thStyle}>Especificación Técnica</th>
                      </>
                    )}
                    {categoria === "proveedores" && (
                      <>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Nombre Fábrica / Proveedor</th>
                        <th style={thStyle}>Región / País</th>
                        <th style={thStyle}>Especialidad</th>
                        <th style={thStyle}>Órdenes Activas</th>
                        <th style={thStyle}>Estatus</th>
                      </>
                    )}
                    {categoria === "clientes" && (
                      <>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Contacto / Nombre</th>
                        <th style={thStyle}>Empresa</th>
                        <th style={thStyle}>Correo Electrónico</th>
                        <th style={thStyle}>País</th>
                        <th style={thStyle}>Rol</th>
                      </>
                    )}
                    {categoria === "proyecciones" && (
                      <>
                        <th style={thStyle}>Mes</th>
                        <th style={thStyle}>Cotizado Proyectado</th>
                        <th style={thStyle}>Facturado Proyectado</th>
                        <th style={thStyle}>Cobrado Proyectado</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {datasetActivo.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.goldSoft)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      {categoria === "contable" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: theme.gold, fontFamily: "monospace" }}>{row.asiento}</strong></td>
                          <td style={tdStyle}>{row.fecha}</td>
                          <td style={tdStyle}><span style={{ color: "#29B6F6", fontSize: "0.75rem" }}>{row.cuenta}</span></td>
                          <td style={tdStyle}><strong style={{ color: theme.textLight }}>{row.concepto}</strong></td>
                          <td style={tdStyle}><strong style={{ color: row.debito > 0 ? theme.green : "#666" }}>{row.debito > 0 ? `$${row.debito.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</strong></td>
                          <td style={tdStyle}><strong style={{ color: row.credito > 0 ? theme.red : "#666" }}>{row.credito > 0 ? `$${row.credito.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</strong></td>
                          <td style={tdStyle}>${row.impuestoItbms.toFixed(2)}</td>
                          <td style={tdStyle}><strong style={{ color: row.utilidad >= 0 ? theme.green : theme.red }}>${row.utilidad.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></td>
                          <td style={tdStyle}>
                            <Badge tone={estadoToTone(row.estadoFiscal)}>{row.estadoFiscal}</Badge>
                          </td>
                        </>
                      )}
                      {categoria === "ventas" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: theme.gold }}>{row.codigo}</strong></td>
                          <td style={tdStyle}>{row.fecha}</td>
                          <td style={tdStyle}><strong style={{ color: theme.textLight }}>{row.cliente}</strong></td>
                          <td style={tdStyle}>{row.pais}</td>
                          <td style={tdStyle}>{row.resumenItem}</td>
                          <td style={tdStyle}>{row.metodoPago}</td>
                          <td style={tdStyle}><strong style={{ color: theme.green }}>${row.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></td>
                          <td style={tdStyle}>
                            <Badge tone={estadoToTone(row.estadoPago)}>{row.estadoPago}</Badge>
                          </td>
                        </>
                      )}
                      {categoria === "inventario" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: theme.gold }}>{row.sku}</strong></td>
                          <td style={tdStyle}><strong style={{ color: theme.textLight }}>{row.descripcion}</strong></td>
                          <td style={tdStyle}>{row.categoria}</td>
                          <td style={tdStyle}><span style={{ fontFamily: "monospace", color: "#29B6F6" }}>{row.tablaOrigen}</span></td>
                          <td style={tdStyle}>{row.especificacion}</td>
                        </>
                      )}
                      {categoria === "proveedores" && (
                        <>
                          <td style={tdStyle}>#{row.id}</td>
                          <td style={tdStyle}><strong style={{ color: theme.textLight }}>{row.nombre}</strong></td>
                          <td style={tdStyle}>{row.region}</td>
                          <td style={tdStyle}>{row.categoria}</td>
                          <td style={tdStyle}><strong style={{ color: theme.gold }}>{row.ordenesActivas} órdenes</strong></td>
                          <td style={tdStyle}><span style={{ color: theme.green, fontWeight: "bold" }}>✓ {row.estatus}</span></td>
                        </>
                      )}
                      {categoria === "clientes" && (
                        <>
                          <td style={tdStyle}>#{row.id}</td>
                          <td style={tdStyle}><strong style={{ color: theme.textLight }}>{row.nombre}</strong></td>
                          <td style={tdStyle}>{row.empresa}</td>
                          <td style={tdStyle}><span style={{ color: "#29B6F6" }}>{row.email}</span></td>
                          <td style={tdStyle}>{row.pais}</td>
                          <td style={tdStyle}><Badge tone="gold">{row.rol}</Badge></td>
                        </>
                      )}
                      {categoria === "proyecciones" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: "#B388FF" }}>{row.mes}</strong></td>
                          <td style={tdStyle}><span style={{ color: theme.gold }}>${row.cotizadoProyectado.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></td>
                          <td style={tdStyle}><span style={{ color: "#29B6F6" }}>${row.facturadoProyectado.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></td>
                          <td style={tdStyle}><strong style={{ color: theme.green }}>${row.cobradoProyectado.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// COMPONENTES SECUNDARIOS DE NAVEGACIÓN Y ESTILO
function CategoryTab({ title, subtitle, active, onClick, icon }: any) {
  return (
    <Button
      variant={active ? "gold" : "outline-gold"}
      onClick={onClick}
      style={{ width: "100%", boxSizing: "border-box", padding: "14px", textAlign: "left" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: "0.82rem", fontWeight: "800" }}>{title}</h4>
      </div>
      <span style={{ fontSize: "0.68rem", opacity: 0.75, display: "block" }}>{subtitle}</span>
    </Button>
  );
}

function MetricKpiCard({ title, value, border }: any) {
  return (
    <Card style={{ padding: "18px 22px", marginBottom: 0, borderLeft: `4px solid ${border}` }}>
      <span style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: "6px" }}>{title}</span>
      <strong style={{ fontSize: "1.5rem", color: theme.textLight, fontWeight: "900" }}>{value}</strong>
    </Card>
  );
}

// ESTILOS DE REUTILIZACIÓN CORPORATIVA (paneles internos sin componente equivalente)
const subCardStyle = {
  background: "rgba(12,12,12,0.8)",
  border: `1px solid ${theme.borderGoldLight}`,
  borderRadius: theme.radiusSm,
  padding: "12px 16px",
};

const thStyle = {
  padding: "12px 14px",
};

const tdStyle = {
  padding: "12px 14px",
  color: theme.textMuted,
};