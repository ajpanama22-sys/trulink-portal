import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

type CategoriaReporte = "ventas" | "contable" | "inventario" | "proveedores" | "clientes" | "proyecciones";

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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
        const itbmsImpuesto = montoTotal * 0.07;
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
        impuestosRetenidos: ingPagados * 0.07,
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
        sku: item.sku || `TLK-SKU-${idx + 100}`,
        descripcion: item.Descripción || item.descripcion || "SKU Fibra Óptica Enterprise",
        categoria: item.categoria,
        tablaOrigen: item.db,
        especificacion: item.especificacion || item.tipo || "Estándar Nylon 66 / Dieléctrico",
        precioRef: Number(item.precio || item.price || 0),
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
    csvContent += `Rango: ${fechaDesde} hasta ${fechaHasta}\n\n`;

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
    const blob = new Blob([JSON.stringify({ categoria, generado: fechaHoraActual, rango: { fechaDesde, fechaHasta }, datos: datasetActivo, resumen: resumenMétricas }, null, 2)], { type: "application/json" });
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
      doc.text(`Rango: ${fechaDesde} a ${fechaHasta}`, xTexto, 25);

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
    <div style={{ backgroundColor: "#030303", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
        }
      `}</style>
      <Sidebar currentActive="reportes" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto", background: "radial-gradient(circle at 50% 0%, #16130b 0%, #030303 70%)" }}>

        {/* ENCABEZADO EXECUTIVE */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid rgba(218, 165, 32, 0.25)", paddingBottom: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber" style={{ height: "48px", objectFit: "contain", filter: "drop-shadow(0 0 12px rgba(255,215,0,0.5))" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontSize: "2rem", background: "linear-gradient(135deg, #FFF099 0%, #FFD700 40%, #DAA520 70%, #997300 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "2px", fontWeight: "900", textTransform: "uppercase", margin: 0 }}>
                  Auditoría & Contabilidad
                </h1>
                <span style={{ backgroundColor: "rgba(255,215,0,0.1)", border: "1px solid #FFD700", color: "#FFD700", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "12px", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1px" }}>
                  Enterprise Edition
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", color: "#888", letterSpacing: "0.5px" }}>Consola de Estados Financieros y Reportes Consolidados • Trulink Fiber LLC</span>
            </div>
          </div>

          <div className="no-imprimir" style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <div style={{ textAlign: "right", background: "rgba(20, 20, 20, 0.8)", border: "1px solid rgba(218,165,32,0.3)", padding: "8px 16px", borderRadius: "8px" }}>
              <span style={{ display: "block", fontSize: "0.65rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>Sincronización Fiscal</span>
              <strong style={{ fontSize: "0.85rem", color: "#FFD700", fontFamily: "monospace" }}>{fechaHoraActual || "Cargando..."}</strong>
            </div>
            <button onClick={exportarExcel} style={btnExportStyle}>📊 Excel (.xlsx)</button>
            <button onClick={exportarCSV} style={btnExportStyle}>📄 CSV</button>
            <button onClick={exportarJSON} style={btnExportStyle}>🗂️ JSON</button>
            <button onClick={exportarPDF} style={btnPrimaryStyle}>📄 PDF</button>
          </div>
        </div>

        {/* SELECTOR DE PESTAÑAS (INCLUYENDO PROYECCIONES IA) */}
        <div className="no-imprimir" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px", marginBottom: "25px" }}>
          <CategoryTab title="Reportes Contables" subtitle="Libro Mayor y P&L" active={categoria === "contable"} onClick={() => setCategoria("contable")} icon="⚖️" highlight={true} />
          <CategoryTab title="Ventas & Cobros" subtitle="Tabla quotes" active={categoria === "ventas"} onClick={() => setCategoria("ventas")} icon="📈" />
          <CategoryTab title="Inventario SKUs" subtitle="Cables, Herrajes, Acc." active={categoria === "inventario"} onClick={() => setCategoria("inventario")} icon="📦" />
          <CategoryTab title="Proveedores" subtitle="Tabla proveedores" active={categoria === "proveedores"} onClick={() => setCategoria("proveedores")} icon="🏭" />
          <CategoryTab title="Clientes CRM" subtitle="Tabla clientes" active={categoria === "clientes"} onClick={() => setCategoria("clientes")} icon="👥" />
          <CategoryTab title="Proyecciones IA" subtitle="Regresión predictiva" active={categoria === "proyecciones"} onClick={() => setCategoria("proyecciones")} icon="🤖" highlight={true} />
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        {categoria !== "proyecciones" && (
          <div className="no-imprimir" style={{ ...glassCardStyle, marginBottom: "25px", padding: "18px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1, minWidth: "300px" }}>
                <span style={{ color: "#FFD700", fontSize: "1.1rem" }}>🔍</span>
                <input
                  type="text"
                  placeholder={`Filtrar en ${categoria}... (Cuenta, Asiento, Cliente, SKU)`}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "0.78rem", color: "#AAA", textTransform: "uppercase", letterSpacing: "0.8px" }}>Ventana Contable:</span>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
                <span style={{ color: "#FFD700", fontWeight: "bold" }}>→</span>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
                <button onClick={aplicarFiltroFecha} style={btnPrimaryStyle}>Actualizar</button>
              </div>
            </div>
          </div>
        )}

        {/* TOP METRICS KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "25px" }}>
          <MetricKpiCard title={resumenMétricas.label1} value={resumenMétricas.kpi1} border="#FFD700" />
          <MetricKpiCard title={resumenMétricas.label2} value={resumenMétricas.kpi2} border="#29B6F6" />
          <MetricKpiCard title={resumenMétricas.label3} value={resumenMétricas.kpi3} border="#00E676" />
        </div>

        {/* SI ES CONTABLE: MOSTRAR BALANCE FISCAL RAPIDO */}
        {categoria === "contable" && (
          <div style={{ ...glassCardStyle, marginBottom: "25px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ color: "#FFF", fontSize: "0.95rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
                🏛️ Desglose Fiscal & Impuestos Estimados (ITBMS 7%)
              </h3>
              <span style={{ color: "#FFD700", fontSize: "0.75rem", border: "1px solid rgba(255,215,0,0.3)", padding: "2px 8px", borderRadius: "4px" }}>
                Moneda: USD ($)
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", fontSize: "0.82rem" }}>
              <div style={subCardStyle}>
                <span style={{ color: "#888", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Ingresos Brutos Facturados</span>
                <strong style={{ color: "#FFF", fontSize: "1.1rem" }}>${(resumenFinanciero.ingresosPagados + resumenFinanciero.cuentasPorCobrar).toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={subCardStyle}>
                <span style={{ color: "#888", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Costo Fabril Total (COGS)</span>
                <strong style={{ color: "#FF5252", fontSize: "1.1rem" }}>${resumenFinanciero.costosOperativos.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={subCardStyle}>
                <span style={{ color: "#888", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Retención Impuesto ITBMS (7%)</span>
                <strong style={{ color: "#29B6F6", fontSize: "1.1rem" }}>${resumenFinanciero.impuestosRetenidos.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={subCardStyle}>
                <span style={{ color: "#888", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>Margen Operativo Bruto</span>
                <strong style={{ color: "#00E676", fontSize: "1.1rem" }}>{resumenFinanciero.margenPromedio}%</strong>
              </div>
            </div>
          </div>
        )}

        {/* SI ES PROYECCIONES: NOTA METODOLÓGICA */}
        {categoria === "proyecciones" && (
          <div style={{ ...glassCardStyle, marginBottom: "25px", padding: "20px", border: "1px solid rgba(179,136,255,0.35)" }}>
            <h3 style={{ color: "#FFF", fontSize: "0.9rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>🤖 Metodología Predictiva</h3>
            <p style={{ color: "#AAA", fontSize: "0.8rem", marginTop: "8px", lineHeight: 1.6 }}>
              El modelo aplica regresión lineal simple sobre los últimos 6 meses reales de cotizaciones y cobros de la tabla <code>quotes</code>, y proyecta los próximos 3 meses. La confianza (R²) indica qué tan bien la tendencia lineal explica el comportamiento histórico: valores cercanos a 100% indican una tendencia estable, mientras que valores bajos sugieren mayor volatilidad y menor certeza en la proyección.
            </p>
          </div>
        )}

        {/* TABLA PRINCIPAL - LIBRO AUXILIAR CONTABLE Y REPORTES */}
        <div style={glassCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ color: "#FFF", fontSize: "1.05rem", margin: 0, fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
              {categoria === "contable" ? "📖 Libro Auxiliar de Asientos Contables" : categoria === "proyecciones" ? "🔮 Proyección Financiera a 3 Meses" : `📑 Matriz Consolidada de ${categoria.toUpperCase()}`}
            </h3>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {datasetActivo.length} registros {categoria === "proyecciones" ? "proyectados" : "auditados"}
            </span>
          </div>

          {cargando && categoria !== "proyecciones" ? (
            <div style={{ padding: "60px", textAlign: "center" }}>
              <div style={{ width: "40px", height: "40px", border: "3px solid rgba(255,215,0,0.1)", borderTop: "3px solid #FFD700", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 15px auto" }} />
              <p style={{ color: "#FFD700", letterSpacing: "1px", fontSize: "0.8rem", textTransform: "uppercase" }}>Cargando Libros Contables desde Supabase...</p>
            </div>
          ) : datasetActivo.length === 0 ? (
            <div style={{ padding: "50px", textAlign: "center", color: "#777", fontSize: "0.9rem" }}>
              No se encontraron asientos ni registros para este período.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(218, 165, 32, 0.4)", color: "#FFD700", textTransform: "uppercase", letterSpacing: "1px", fontSize: "0.72rem" }}>
                    {categoria === "contable" && (
                      <>
                        <th style={thStyle}>Nº Asiento</th>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Cuenta Contable</th>
                        <th style={thStyle}>Concepto / Descripción</th>
                        <th style={thStyle}>Débito ($)</th>
                        <th style={thStyle}>Crédito ($)</th>
                        <th style={thStyle}>ITBMS (7%)</th>
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
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,215,0,0.04)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      {categoria === "contable" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: "#FFD700", fontFamily: "monospace" }}>{row.asiento}</strong></td>
                          <td style={tdStyle}>{row.fecha}</td>
                          <td style={tdStyle}><span style={{ color: "#29B6F6", fontSize: "0.75rem" }}>{row.cuenta}</span></td>
                          <td style={tdStyle}><strong style={{ color: "#FFF" }}>{row.concepto}</strong></td>
                          <td style={tdStyle}><strong style={{ color: row.debito > 0 ? "#00E676" : "#666" }}>{row.debito > 0 ? `$${row.debito.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</strong></td>
                          <td style={tdStyle}><strong style={{ color: row.credito > 0 ? "#FF5252" : "#666" }}>{row.credito > 0 ? `$${row.credito.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</strong></td>
                          <td style={tdStyle}>${row.impuestoItbms.toFixed(2)}</td>
                          <td style={tdStyle}><strong style={{ color: row.utilidad >= 0 ? "#00E676" : "#FF5252" }}>${row.utilidad.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></td>
                          <td style={tdStyle}>
                            <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: row.estadoFiscal === "Liquidado" ? "rgba(0,230,118,0.15)" : "rgba(255,215,0,0.15)", color: row.estadoFiscal === "Liquidado" ? "#00E676" : "#FFD700", border: `1px solid ${row.estadoFiscal === "Liquidado" ? "#00E676" : "#FFD700"}` }}>
                              {row.estadoFiscal}
                            </span>
                          </td>
                        </>
                      )}
                      {categoria === "ventas" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: "#FFD700" }}>{row.codigo}</strong></td>
                          <td style={tdStyle}>{row.fecha}</td>
                          <td style={tdStyle}><strong style={{ color: "#FFF" }}>{row.cliente}</strong></td>
                          <td style={tdStyle}>{row.pais}</td>
                          <td style={tdStyle}>{row.resumenItem}</td>
                          <td style={tdStyle}>{row.metodoPago}</td>
                          <td style={tdStyle}><strong style={{ color: "#00E676" }}>${row.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></td>
                          <td style={tdStyle}>
                            <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: row.estadoPago === "pagado" ? "rgba(0,230,118,0.15)" : "rgba(255,215,0,0.15)", color: row.estadoPago === "pagado" ? "#00E676" : "#FFD700", border: `1px solid ${row.estadoPago === "pagado" ? "#00E676" : "#FFD700"}` }}>
                              {row.estadoPago}
                            </span>
                          </td>
                        </>
                      )}
                      {categoria === "inventario" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: "#FFD700" }}>{row.sku}</strong></td>
                          <td style={tdStyle}><strong style={{ color: "#FFF" }}>{row.descripcion}</strong></td>
                          <td style={tdStyle}>{row.categoria}</td>
                          <td style={tdStyle}><span style={{ fontFamily: "monospace", color: "#29B6F6" }}>{row.tablaOrigen}</span></td>
                          <td style={tdStyle}>{row.especificacion}</td>
                        </>
                      )}
                      {categoria === "proveedores" && (
                        <>
                          <td style={tdStyle}>#{row.id}</td>
                          <td style={tdStyle}><strong style={{ color: "#FFF" }}>{row.nombre}</strong></td>
                          <td style={tdStyle}>{row.region}</td>
                          <td style={tdStyle}>{row.categoria}</td>
                          <td style={tdStyle}><strong style={{ color: "#FFD700" }}>{row.ordenesActivas} órdenes</strong></td>
                          <td style={tdStyle}><span style={{ color: "#00E676", fontWeight: "bold" }}>✓ {row.estatus}</span></td>
                        </>
                      )}
                      {categoria === "clientes" && (
                        <>
                          <td style={tdStyle}>#{row.id}</td>
                          <td style={tdStyle}><strong style={{ color: "#FFF" }}>{row.nombre}</strong></td>
                          <td style={tdStyle}>{row.empresa}</td>
                          <td style={tdStyle}><span style={{ color: "#29B6F6" }}>{row.email}</span></td>
                          <td style={tdStyle}>{row.pais}</td>
                          <td style={tdStyle}><span style={{ border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700", padding: "2px 6px", borderRadius: "4px", fontSize: "0.68rem" }}>{row.rol}</span></td>
                        </>
                      )}
                      {categoria === "proyecciones" && (
                        <>
                          <td style={tdStyle}><strong style={{ color: "#B388FF" }}>{row.mes}</strong></td>
                          <td style={tdStyle}><span style={{ color: "#FFD700" }}>${row.cotizadoProyectado.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></td>
                          <td style={tdStyle}><span style={{ color: "#29B6F6" }}>${row.facturadoProyectado.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></td>
                          <td style={tdStyle}><strong style={{ color: "#00E676" }}>${row.cobradoProyectado.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// COMPONENTES SECUNDARIOS DE NAVEGACIÓN Y ESTILO
function CategoryTab({ title, subtitle, active, onClick, icon, highlight }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active
          ? "linear-gradient(135deg, rgba(255,215,0,0.22) 0%, rgba(20,20,20,0.95) 100%)"
          : highlight
          ? "rgba(255,215,0,0.06)"
          : "rgba(15,15,15,0.7)",
        border: active ? "1px solid #FFD700" : highlight ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        padding: "14px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: active ? "0 0 15px rgba(255,215,0,0.25)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: "0.82rem", color: active ? "#FFD700" : highlight ? "#FFF099" : "#FFF", fontWeight: "800" }}>{title}</h4>
      </div>
      <span style={{ fontSize: "0.68rem", color: "#888", display: "block" }}>{subtitle}</span>
    </div>
  );
}

function MetricKpiCard({ title, value, border }: any) {
  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(20,20,20,0.9) 0%, rgba(10,10,10,0.95) 100%)",
      border: `1px solid ${border}44`,
      borderRadius: "10px",
      padding: "18px 22px",
      borderLeft: `4px solid ${border}`,
    }}>
      <span style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: "6px" }}>{title}</span>
      <strong style={{ fontSize: "1.5rem", color: "#FFF", fontWeight: "900" }}>{value}</strong>
    </div>
  );
}

// ESTILOS DE REUTILIZACIÓN CORPORATIVA
const glassCardStyle = {
  background: "linear-gradient(135deg, rgba(18,18,18,0.85) 0%, rgba(8,8,8,0.95) 100%)",
  border: "1px solid rgba(218, 165, 32, 0.35)",
  borderRadius: "14px",
  padding: "24px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.6)",
  backdropFilter: "blur(12px)",
};

const subCardStyle = {
  background: "rgba(12,12,12,0.8)",
  border: "1px solid rgba(218, 165, 32, 0.2)",
  borderRadius: "8px",
  padding: "12px 16px",
};

const inputStyle = {
  backgroundColor: "#080808",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  color: "#FFD700",
  padding: "9px 14px",
  borderRadius: "8px",
  outline: "none",
  fontSize: "0.82rem",
  fontWeight: "600",
};

const btnPrimaryStyle = {
  background: "linear-gradient(135deg, #FFF099 0%, #FFD700 50%, #DAA520 100%)",
  color: "#000",
  border: "none",
  padding: "10px 18px",
  borderRadius: "8px",
  fontWeight: "800",
  cursor: "pointer",
  textTransform: "uppercase" as const,
  fontSize: "0.75rem",
  letterSpacing: "1px",
  boxShadow: "0 0 15px rgba(255,215,0,0.3)",
};

const btnExportStyle = {
  background: "rgba(20,20,20,0.8)",
  color: "#FFD700",
  border: "1px solid rgba(218, 165, 32, 0.6)",
  padding: "10px 18px",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
  textTransform: "uppercase" as const,
  fontSize: "0.75rem",
  letterSpacing: "0.8px",
};

const thStyle = {
  padding: "12px 14px",
};

const tdStyle = {
  padding: "12px 14px",
  color: "#CCC",
};
