import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function Reportes() {
  const [cargando, setCargando] = useState(true);
  const [tipoReporte, setTipoReporte] = useState("quotes");
  const [formatoExportacion, setFormatoExportacion] = useState("pdf");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [datosReporte, setDatosReporte] = useState<any[]>([]);
  const [resumenEjecutivo, setResumenEjecutivo] = useState({
    totalRegistros: 0,
    montoTotal: 0,
    promedioValor: 0,
    estadoFiltro: "Activo"
  });

  useEffect(() => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const desdeInit = `${anioActual}-01-01`;
    const hastaInit = hoy.toISOString().split("T")[0];

    setFechaDesde(desdeInit);
    setFechaHasta(hastaInit);
    cargarDatosReporte(tipoReporte, desdeInit, hastaInit);
  }, [tipoReporte]);

  const cargarDatosReporte = async (tipo: string, desde: string, hasta: string) => {
    if (!supabase) return;
    setCargando(true);

    try {
      let queryTable = tipo;
      if (tipo === "analitica_ventas") queryTable = "quotes";
      if (tipo === "analitica_clientes") queryTable = "clientes";
      if (tipo === "defectuosos_devueltos") queryTable = "cablesdb"; // Base principal o consulta unificada

      let query = supabase.from(queryTable).select("*");

      if (desde && hasta && !["analitica_clientes", "defectuosos_devueltos"].includes(tipo)) {
        query = query.gte("created_at", `${desde}T00:00:00`).lte("created_at", `${hasta}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error en consulta Supabase:", error);
        procesarResultados(tipo, []);
      } else {
        let resultados = data || [];
        if (tipo === "defectuosos_devueltos") {
          // Filtrar elementos marcados como defectuosos o devueltos en la descripción o estado
          resultados = resultados.filter((item: any) => {
            const desc = String(item.descripcion || item.Descripción || item.status || item.estado || "").toLowerCase();
            return desc.includes("defectuoso") || desc.includes("devuelto") || desc.includes("rma") || desc.includes("dañado");
          });
        }
        procesarResultados(tipo, resultados);
      }
    } catch (err) {
      console.error("Error generando reporte:", err);
      procesarResultados(tipo, []);
    } finally {
      setCargando(false);
    }
  };

  const procesarResultados = (tipo: string, registros: any[]) => {
    setDatosReporte(registros);
    const total = registros.length;

    if (tipo === "quotes" || tipo === "analitica_ventas" || tipo === "facturas" || tipo === "recibos" || tipo === "pagos_proveedores") {
      const suma = registros.reduce((acc, item) => acc + Number(item.total || item.monto || 0), 0);
      let etiqueta = "Cotizaciones y Finanzas";
      if (tipo === "quotes" || tipo === "analitica_ventas") etiqueta = "Análisis de Volumen y Conversión (quotes)";
      if (tipo === "facturas") etiqueta = "Pagos Recibidos - Facturas (100%)";
      if (tipo === "recibos") etiqueta = "Pagos Recibidos - Recibos (50%)";
      if (tipo === "pagos_proveedores") etiqueta = "Pagos Realizados a Proveedores/Fábricas";

      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: suma,
        promedioValor: total > 0 ? suma / total : 0,
        estadoFiltro: etiqueta
      });
    } else if (tipo === "analitica_clientes") {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: "Distribución Geográfica y Accesos de Clientes"
      });
    } else if (tipo === "defectuosos_devueltos") {
      const sumaInv = registros.reduce((acc, item) => acc + (Number((item.precio_a ?? item.Precio_A) || 0) * Number(item.cantidad ?? item.Cantidad ?? item.Stock ?? item.stock ?? 0)), 0);
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: sumaInv,
        promedioValor: total > 0 ? sumaInv / total : 0,
        estadoFiltro: "Control de Productos Defectuosos / Devueltos"
      });
    } else if (tipo === "cablesdb" || tipo === "herrajesdb" || tipo === "accesoriosdb") {
      const sumaInv = registros.reduce((acc, item) => acc + (Number((item.precio_a ?? item.Precio_A) || 0) * Number(item.cantidad ?? item.Cantidad ?? item.Stock ?? item.stock ?? 0)), 0);
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: sumaInv,
        promedioValor: total > 0 ? sumaInv / total : 0,
        estadoFiltro: `Inventario - ${tipo.toUpperCase()}`
      });
    } else if (tipo === "produccion") {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: "Reportes de Fabricación y Producción"
      });
    } else if (tipo === "despachos") {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: "Reportes de Despachos (Preparación, Completos, Entregados)"
      });
    } else if (tipo === "proveedores" || tipo === "clientes" || tipo === "colaboradores") {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: `Directorio de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`
      });
    } else {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: "Base de Datos General"
      });
    }
  };

  const ejecutarGeneracionReporte = () => {
    cargarDatosReporte(tipoReporte, fechaDesde, fechaHasta);
  };

  const handleDescargarReporteOficial = () => {
    if (datosReporte.length === 0) {
      alert("No hay registros disponibles para exportar en este rango.");
      return;
    }

    const esDirectorio = tipoReporte === "clientes" || tipoReporte === "colaboradores" || tipoReporte === "proveedores" || tipoReporte === "analitica_clientes";
    const esInventario = tipoReporte === "cablesdb" || tipoReporte === "herrajesdb" || tipoReporte === "accesoriosdb" || tipoReporte === "defectuosos_devueltos";
    const esProduccion = tipoReporte === "produccion";
    const esDespachos = tipoReporte === "despachos";
    const esQuotes = tipoReporte === "quotes" || tipoReporte === "analitica_ventas";

    if (formatoExportacion === "pdf") {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const fechaEmision = new Date().toLocaleDateString();
      const horaEmision = new Date().toLocaleTimeString();

      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, 210, 45, "F");

      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(1.2);
      doc.line(0, 45, 210, 45);

      doc.setTextColor(255, 215, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("TRULINK", 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      doc.text("TRULINK FIBER LLC", 14, 25);
      doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 30);
      doc.text("Tel: +507 6640 3720 | www.trulinkfiber.com", 14, 35);

      doc.setTextColor(255, 215, 0);
      doc.setFontSize(11);
      doc.text(`REPORTE OFICIAL: ${tipoReporte.toUpperCase()}`, 200, 18, { align: "right" });
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(`Fecha: ${fechaEmision} | Hora: ${horaEmision}`, 200, 25, { align: "right" });
      doc.text(`Rango: ${fechaDesde} al ${fechaHasta}`, 200, 31, { align: "right" });

      let currentY = 55;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.text(`Módulo Analizado: ${resumenEjecutivo.estadoFiltro}`, 14, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.text(`Total de Registros: ${resumenEjecutivo.totalRegistros}`, 14, currentY);
      if (!esDirectorio && !esProduccion && !esDespachos) {
        doc.text(`Monto Consolidado: $${resumenEjecutivo.montoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 80, currentY);
        doc.text(`Promedio por Registro: $${resumenEjecutivo.promedioValor.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 150, currentY);
      }
      currentY += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(184, 134, 11);
      doc.text("ANÁLISIS GRÁFICO DE DISTRIBUCIÓN (INTELIGENCIA B2B)", 14, currentY);
      currentY += 6;

      const chartX = 14;
      const chartY = currentY;
      const chartWidth = 182;
      const chartHeight = 25;

      doc.setFillColor(245, 245, 245);
      doc.rect(chartX, chartY, chartWidth, chartHeight, "F");
      doc.setDrawColor(218, 165, 32);
      doc.rect(chartX, chartY, chartWidth, chartHeight, "S");

      const barColors = [
        [218, 165, 32],
        [40, 116, 166],
        [39, 174, 96],
        [142, 68, 173],
        [211, 84, 0]
      ];

      const maxBars = Math.min(datosReporte.length, 10);
      const barWidth = (chartWidth - 20) / (maxBars || 1);

      for (let i = 0; i < maxBars; i++) {
        const item = datosReporte[i];
        const valRandom = Number(
          esInventario 
            ? (Number((item.precio_a ?? item.Precio_A) || 0) * Number(item.cantidad ?? item.Cantidad ?? item.Stock ?? item.stock ?? 0))
            : esQuotes
            ? (item.total || 0)
            : (item.total || item.monto || item.precio || (i + 1) * 10)
        );
        const barHeight = Math.min(Math.max((valRandom / (resumenEjecutivo.montoTotal || 100)) * 18, 5), 20);
        const color = barColors[i % barColors.length];

        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(chartX + 10 + (i * barWidth) + 3, chartY + chartHeight - barHeight - 4, barWidth - 6, barHeight, "F");
      }

      currentY += chartHeight + 12;

      let tableColumns = ["ID / SKU", "Nombre / Entidad", "Correo Electrónico", "Teléfono / Contacto", "Fecha Registro"];
      let tableRows = datosReporte.map((row) => [
        row.id ? String(row.id).substring(0, 8) : (row.sku || "N/A"),
        row.nombre || row.client_name || row.empresa || row.proveedor || "---",
        row.email || row.correo || "---",
        row.telefono || row.phone || row.movil || "---",
        row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"
      ]);

      if (esQuotes) {
        tableColumns = ["Referencia / Fecha", "Cliente / Razón Social", "Contacto (Email / Tel)", "Tipo", "Total"];
        tableRows = datosReporte.map((row) => [
          `${row.quote_number || row.reference || (row.id ? String(row.id).substring(0, 8) : "N/A")}\n${row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"}`,
          row.client_name || row.cliente || row.empresa || "Sin especificar",
          `${row.client_email || row.email || "N/D"}\n${row.client_phone || row.telefono || row.phone || "N/D"}`,
          row.quote_type || row.tipo || "fiber_quote",
          `$${Number(row.total || 0).toFixed(2)}`
        ]);
      } else if (tipoReporte === "analitica_clientes") {
        tableColumns = ["ID Cliente", "Nombre / Empresa", "País / Ubicación", "Correo Electrónico", "Teléfono"];
        tableRows = datosReporte.map((row) => [
          row.id ? String(row.id).substring(0, 8) : "N/A",
          row.nombre || row.empresa || "---",
          row.pais || row.country || "Panamá / Internacional",
          row.email || row.correo || "---",
          row.telefono || row.phone || "---"
        ]);
      } else if (esInventario) {
        tableColumns = ["SKU", "Descripción", "Stock / Cant.", "Precio A (ISP)", "Estado / Condición"];
        tableRows = datosReporte.map((row) => [
          row.SKU || row.sku || "N/A",
          row.Descripción || row.descripcion || "N/A",
          row.cantidad ?? row.Cantidad ?? row.Stock ?? row.stock ?? 0,
          `$${Number((row.precio_a ?? row.Precio_A) || 0).toFixed(2)}`,
          tipoReporte === "defectuosos_devueltos" ? "Defectuoso / Devuelto" : "Activo"
        ]);
      } else if (esProduccion) {
        tableColumns = ["ID Lote", "Línea / Fábrica", "Producto / Materia Prima", "Cantidad", "Status Producción"];
        tableRows = datosReporte.map((row) => [
          row.id ? String(row.id).substring(0, 8) : "N/A",
          row.fabrica || row.linea || "---",
          row.producto || row.descripcion || "---",
          row.cantidad || 0,
          row.status || row.estado || "En Proceso"
        ]);
      } else if (esDespachos) {
        tableColumns = ["ID Despacho", "Destino / Cliente", "Guía / Transporte", "Items", "Status Despacho"];
        tableRows = datosReporte.map((row) => [
          row.id ? String(row.id).substring(0, 8) : "N/A",
          row.destino || row.cliente || "---",
          row.guia || row.transportista || "---",
          row.items_count || row.cantidad || 1,
          row.status || row.estado || "Preparación"
        ]);
      } else if (!esDirectorio) {
        tableColumns = ["ID / Ref", "Concepto / Detalle", "Monto", "Tipo / Detalle Pago", "Fecha"];
        tableRows = datosReporte.map((row) => [
          row.id ? String(row.id).substring(0, 8) : (row.sku || "N/A"),
          row.descripcion || row.concepto || row.nombre || "Transacción",
          `$${Number(row.total || row.monto || 0).toFixed(2)}`,
          row.tipo || row.estado_pago || "Completado",
          row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"
        ]);
      }

      (doc as any).autoTable({
        startY: currentY,
        head: [tableColumns],
        body: tableRows,
        headStyles: {
          fillColor: [15, 15, 15],
          textColor: [255, 215, 0],
          fontStyle: "bold",
          halign: "center"
        },
        bodyStyles: {
          textColor: [40, 40, 40],
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: [245, 243, 235]
        },
        styles: {
          lineColor: [218, 165, 32],
          lineWidth: 0.1
        }
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("NOTA: Este documento es un reporte oficial generado por el Centro de Inteligencia y Documentación de Trulink Fiber LLC.", 14, 285);
        doc.text(`Página ${i} de ${pageCount}`, 200, 285, { align: "right" });
      }

      doc.save(`Reporte_Oficial_${tipoReporte}_${new Date().toISOString().slice(0, 10)}.pdf`);

    } else {
      let csvHeader = esQuotes
        ? "data:text/csv;charset=utf-8,Referencia,Cliente,Email,Telefono,Tipo,Total,Fecha\n"
        : tipoReporte === "analitica_clientes"
        ? "data:text/csv;charset=utf-8,ID_Cliente,Nombre,Pais,Email,Telefono\n"
        : esDirectorio 
        ? "data:text/csv;charset=utf-8,ID_SKU,Nombre,Email,Telefono,Fecha\n" 
        : esInventario
        ? "data:text/csv;charset=utf-8,SKU,Descripcion,Stock,Precio_A,Estado\n"
        : esProduccion
        ? "data:text/csv;charset=utf-8,ID_Lote,Fabrica,Producto,Cantidad,Status\n"
        : esDespachos
        ? "data:text/csv;charset=utf-8,ID_Despacho,Destino,Guia,Cantidad,Status\n"
        : "data:text/csv;charset=utf-8,ID_Ref,Concepto,Monto,Tipo_Pago,Fecha\n";
      
      let csvContent = csvHeader;
      datosReporte.forEach((row) => {
        if (esQuotes) {
          const refSegura = `"${row.quote_number || row.reference || row.id || "N/A"}"`;
          const clienteSeguro = `"${(row.client_name || row.cliente || row.empresa || "Sin especificar").replace(/"/g, '""')}"`;
          const emailSeguro = `"${(row.client_email || row.email || "N/D").replace(/"/g, '""')}"`;
          const telSeguro = `"${(row.client_phone || row.telefono || row.phone || "N/D").replace(/"/g, '""')}"`;
          const tipoSeguro = `"${row.quote_type || row.tipo || "fiber_quote"}"`;
          const totalSeguro = `"${row.total || 0}"`;
          const fechaSegura = `"${row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"}"`;
          csvContent += [refSegura, clienteSeguro, emailSeguro, telSeguro, tipoSeguro, totalSeguro, fechaSegura].join(",") + "\n";
        } else if (tipoReporte === "analitica_clientes") {
          const idSegura = `"${row.id || "N/A"}"`;
          const nombreSeguro = `"${(row.nombre || row.empresa || "---").replace(/"/g, '""')}"`;
          const paisSeguro = `"${(row.pais || row.country || "Panamá").replace(/"/g, '""')}"`;
          const emailSeguro = `"${(row.email || row.correo || "---").replace(/"/g, '""')}"`;
          const telSeguro = `"${(row.telefono || row.phone || "---").replace(/"/g, '""')}"`;
          csvContent += [idSegura, nombreSeguro, paisSeguro, emailSeguro, telSeguro].join(",") + "\n";
        } else if (esDirectorio) {
          const idSegura = `"${row.id || "N/A"}"`;
          const nombreSeguro = `"${(row.nombre || row.client_name || row.empresa || row.proveedor || "---").replace(/"/g, '""')}"`;
          const emailSeguro = `"${(row.email || row.correo || "---").replace(/"/g, '""')}"`;
          const telSeguro = `"${(row.telefono || row.phone || row.movil || "---").replace(/"/g, '""')}"`;
          const fechaSegura = `"${row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"}"`;
          csvContent += [idSegura, nombreSeguro, emailSeguro, telSeguro, fechaSegura].join(",") + "\n";
        } else if (esInventario) {
          const skuSeguro = `"${row.SKU || row.sku || "N/A"}"`;
          const descSegura = `"${(row.Descripción || row.descripcion || "N/A").replace(/"/g, '""')}"`;
          const stockSeguro = `"${row.cantidad ?? row.Cantidad ?? row.Stock ?? row.stock ?? 0}"`;
          const precioASeguro = `"${Number((row.precio_a ?? row.Precio_A) || 0).toFixed(2)}"`;
          const estadoSeguro = `"${tipoReporte === "defectuosos_devueltos" ? "Defectuoso / Devuelto" : "Activo"}"`;
          csvContent += [skuSeguro, descSegura, stockSeguro, precioASeguro, estadoSeguro].join(",") + "\n";
        } else if (esProduccion) {
          const idSeguro = `"${row.id || "N/A"}"`;
          const fabSegura = `"${(row.fabrica || row.linea || "---").replace(/"/g, '""')}"`;
          const prodSeguro = `"${(row.producto || row.descripcion || "---").replace(/"/g, '""')}"`;
          const cantSegura = `"${row.cantidad || 0}"`;
          const statusSeguro = `"${row.status || row.estado || "En Proceso"}"`;
          csvContent += [idSeguro, fabSegura, prodSeguro, cantSegura, statusSeguro].join(",") + "\n";
        } else if (esDespachos) {
          const idSeguro = `"${row.id || "N/A"}"`;
          const destSeguro = `"${(row.destino || row.cliente || "---").replace(/"/g, '""')}"`;
          const guiaSegura = `"${(row.guia || row.transportista || "---").replace(/"/g, '""')}"`;
          const cantSegura = `"${row.items_count || row.cantidad || 1}"`;
          const statusSeguro = `"${row.status || row.estado || "Preparación"}"`;
          csvContent += [idSeguro, destSeguro, guiaSegura, cantSegura, statusSeguro].join(",") + "\n";
        } else {
          const idSeguro = `"${row.id || row.sku || "N/A"}"`;
          const descSegura = `"${(row.descripcion || row.concepto || row.nombre || "General").replace(/"/g, '""')}"`;
          const montoSeguro = `"${row.total || row.monto || 0}"`;
          const tipoSeguro = `"${row.tipo || row.estado_pago || "Completado"}"`;
          const fechaSegura = `"${row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"}"`;
          csvContent += [idSeguro, descSegura, montoSeguro, tipoSeguro, fechaSegura].join(",") + "\n";
        }
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Reporte_${tipoReporte}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const esDirectorio = tipoReporte === "clientes" || tipoReporte === "colaboradores" || tipoReporte === "proveedores" || tipoReporte === "analitica_clientes";
  const esInventario = tipoReporte === "cablesdb" || tipoReporte === "herrajesdb" || tipoReporte === "accesoriosdb" || tipoReporte === "defectuosos_devueltos";
  const esProduccion = tipoReporte === "produccion";
  const esDespachos = tipoReporte === "despachos";
  const esQuotes = tipoReporte === "quotes" || tipoReporte === "analitica_ventas";

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="reportes" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "15px" }}>
          <h1 style={{ fontSize: "1.8rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1.5px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
            REPORTES EJECUTIVOS Y ANALÍTICA B2B
          </h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <span style={{ fontSize: "0.75rem", background: "rgba(218, 165, 32, 0.1)", color: "#FFD700", border: "1px solid rgba(218, 165, 32, 0.4)", padding: "6px 14px", borderRadius: "20px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", boxShadow: "0 0 10px rgba(218,165,32,0.15)" }}>
              📊 Centro de Inteligencia y Documentación
            </span>
          </div>
        </div>

        <div style={{ background: "linear-gradient(145deg, #0a0a0a 0%, #141414 100%)", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "12px", padding: "24px", marginBottom: "35px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "16px", color: "#FFD700", letterSpacing: "0.8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚙️</span> Parámetros de Generación, Analítica y Exportación
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <label style={labelStyle}>Tipo de Reporte / Analítica</label>
              <select value={tipoReporte} onChange={(e) => setTipoReporte(e.target.value)} style={inputStyle}>
                <optgroup label="Analítica Avanzada y Métricas">
                  <option value="analitica_ventas" style={{ background: "#111", color: "#FFD700" }}>📈 Análisis de Volumen y Conversión (quotes)</option>
                  <option value="analitica_clientes" style={{ background: "#111", color: "#FFD700" }}>🌍 Distribución Geográfica y Accesos de Clientes</option>
                  <option value="defectuosos_devueltos" style={{ background: "#111", color: "#FFD700" }}>⚠️ Control de Productos Defectuosos / Devueltos</option>
                </optgroup>
                <optgroup label="Finanzas y Pagos">
                  <option value="quotes" style={{ background: "#111", color: "#DAA520" }}>Cotizaciones Oficiales (quotes)</option>
                  <option value="facturas" style={{ background: "#111", color: "#DAA520" }}>Pagos Recibidos: Facturas (100%)</option>
                  <option value="recibos" style={{ background: "#111", color: "#DAA520" }}>Pagos Recibidos: Recibos (50%)</option>
                  <option value="pagos_proveedores" style={{ background: "#111", color: "#DAA520" }}>Pagos Realizados (Proveedores/Fábricas)</option>
                </optgroup>
                <optgroup label="Operaciones y Logística">
                  <option value="produccion" style={{ background: "#111", color: "#DAA520" }}>Reportes de Fabricación / Producción</option>
                  <option value="despachos" style={{ background: "#111", color: "#DAA520" }}>Reportes de Despachos (Status)</option>
                </optgroup>
                <optgroup label="Inventarios y Directorios">
                  <option value="cablesdb" style={{ background: "#111", color: "#DAA520" }}>Inventario de Cables (cablesdb)</option>
                  <option value="herrajesdb" style={{ background: "#111", color: "#DAA520" }}>Inventario de Herrajes (herrajesdb)</option>
                  <option value="accesoriosdb" style={{ background: "#111", color: "#DAA520" }}>Inventario de Accesorios (accesoriosdb)</option>
                  <option value="proveedores" style={{ background: "#111", color: "#DAA520" }}>Directorio de Proveedores y Fábricas</option>
                  <option value="clientes" style={{ background: "#111", color: "#DAA520" }}>Directorio de Clientes</option>
                  <option value="colaboradores" style={{ background: "#111", color: "#DAA520" }}>Directorio de Colaboradores</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Formato de Salida</label>
              <select value={formatoExportacion} onChange={(e) => setFormatoExportacion(e.target.value)} style={inputStyle}>
                <option value="pdf" style={{ background: "#111", color: "#DAA520" }}>Documento Ejecutivo PDF con Gráficas</option>
                <option value="csv" style={{ background: "#111", color: "#DAA520" }}>Hoja de Cálculo Excel (.csv)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Desde</label>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Hasta</label>
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px" }}>
            <button onClick={ejecutarGeneracionReporte} style={btnPrimary}>
              🔍 Actualizar Vista Previa Analítica
            </button>
            <button onClick={handleDescargarReporteOficial} style={btnGoldOutline}>
              📥 Descargar Reporte Oficial
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "35px" }}>
          <CardMetric title="Total Registros" value={resumenEjecutivo.totalRegistros} sub="Elementos en el reporte actual" glowColor="rgba(218,165,32,0.3)" />
          {!esDirectorio && !esProduccion && !esDespachos && (
            <CardMetric title="Monto Consolidado / Valuación" value={`$${resumenEjecutivo.montoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Valor financiero total acumulado" highlight={true} glowColor="rgba(255,215,0,0.5)" />
          )}
          <CardMetric title="Estado del Módulo Analítico" value={resumenEjecutivo.estadoFiltro} sub="Conexión Supabase activa" highlight={true} glowColor="rgba(255,215,0,0.5)" />
        </div>

        <div style={cardBoxStyle}>
          <h3 style={{ color: "#FFD700", marginBottom: "18px", fontSize: "1.1rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Vista Previa de Datos Analíticos ({datosReporte.length} registros encontrados)
          </h3>

          {cargando ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#FFD700", fontStyle: "italic" }}>Consultando registros y métricas analíticas en base de datos...</p>
            </div>
          ) : datosReporte.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#888" }}>No se encontraron registros en el módulo consultado ({tipoReporte}).</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(218, 165, 32, 0.4)", color: "#FFD700" }}>
                    <th style={{ padding: "12px" }}>{esQuotes ? "REFERENCIA / FECHA" : tipoReporte === "analitica_clientes" ? "ID CLIENTE" : esInventario ? "SKU" : esProduccion ? "ID Lote" : esDespachos ? "ID Despacho" : "ID / SKU"}</th>
                    <th style={{ padding: "12px" }}>{esQuotes ? "CLIENTE / RAZÓN SOCIAL" : tipoReporte === "analitica_clientes" ? "NOMBRE / EMPRESA" : esDirectorio ? "Nombre / Entidad" : esInventario ? "Descripción" : esProduccion ? "Línea / Fábrica" : esDespachos ? "Destino / Cliente" : "Concepto / Detalle"}</th>
                    <th style={{ padding: "12px" }}>{esQuotes ? "CONTACTO (EMAIL / TEL)" : tipoReporte === "analitica_clientes" ? "PAÍS / UBICACIÓN" : esDirectorio ? "Correo Electrónico" : esInventario ? "Stock / Cantidad" : esProduccion ? "Producto" : esDespachos ? "Guía / Transporte" : "Monto / Valor"}</th>
                    <th style={{ padding: "12px" }}>{esQuotes ? "TIPO" : tipoReporte === "analitica_clientes" ? "CORREO ELECTRÓNICO" : esDirectorio ? "Teléfono Móvil" : esInventario ? "Precio A (ISP)" : esProduccion ? "Cantidad" : esDespachos ? "Items" : "Tipo / Estado Pago"}</th>
                    <th style={{ padding: "12px" }}>{esQuotes ? "TOTAL" : tipoReporte === "analitica_clientes" ? "TELÉFONO" : esInventario ? "ESTADO" : esProduccion || esDespachos ? "Status" : "Fecha Creación"}</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.slice(0, 10).map((row, idx) => {
                    const col1 = esQuotes ? (row.quote_number || row.reference || (row.id ? String(row.id).substring(0, 8) : "N/A")) : tipoReporte === "analitica_clientes" ? (row.id ? String(row.id).substring(0, 8) : "N/A") : esInventario ? (row.SKU || row.sku || "N/A") : (row.id ? String(row.id).substring(0, 8) : "N/A");
                    const col2 = esQuotes ? (row.client_name || row.cliente || row.empresa || "Sin especificar") : tipoReporte === "analitica_clientes" ? (row.nombre || row.empresa || "---") : esDirectorio ? (row.nombre || row.client_name || row.empresa || row.proveedor || "---") : esInventario ? (row.Descripción || row.descripcion || "---") : esProduccion ? (row.fabrica || row.linea || "---") : esDespachos ? (row.destino || row.cliente || "---") : (row.descripcion || row.concepto || row.nombre || "Transacción");
                    const col3 = esQuotes ? `${row.client_email || row.email || "N/D"} / ${row.client_phone || row.telefono || row.phone || "N/D"}` : tipoReporte === "analitica_clientes" ? (row.pais || row.country || "Panamá") : esDirectorio ? (row.email || row.correo || "---") : esInventario ? (row.cantidad ?? row.Cantidad ?? row.Stock ?? row.stock ?? 0) : esProduccion ? (row.producto || row.descripcion || "---") : esDespachos ? (row.guia || row.transportista || "---") : `$${Number(row.total || row.monto || 0).toFixed(2)}`;
                    const col4 = esQuotes ? (row.quote_type || row.tipo || "fiber_quote") : tipoReporte === "analitica_clientes" ? (row.email || row.correo || "---") : esDirectorio ? (row.telefono || row.phone || row.movil || "---") : esInventario ? `$${Number((row.precio_a ?? row.Precio_A) || 0).toFixed(2)}` : esProduccion ? (row.cantidad || 0) : esDespachos ? (row.items_count || row.cantidad || 1) : (row.tipo || row.estado_pago || "Completado");
                    const col5 = esQuotes ? `$${Number(row.total || 0).toFixed(2)}` : tipoReporte === "analitica_clientes" ? (row.telefono || row.phone || "---") : esInventario ? (tipoReporte === "defectuosos_devueltos" ? "Defectuoso / Devuelto" : "Activo") : esProduccion || esDespachos ? (row.status || row.estado || "En Proceso") : (row.created_at ? new Date(row.created_at).toLocaleDateString() : "---");

                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #1c1c1c", color: "#ccc" }}>
                        <td style={{ padding: "12px", color: "#FFD700", fontWeight: "bold" }}>
                          {col1}
                          {esQuotes && row.created_at && (
                            <div style={{ fontSize: "0.75rem", color: "#888", fontWeight: "normal" }}>{new Date(row.created_at).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>{col2}</td>
                        <td style={{ padding: "12px", fontWeight: "bold", color: "#fff" }}>{col3}</td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ backgroundColor: "rgba(218,165,32,0.1)", color: "#FFD700", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", border: "1px solid rgba(218,165,32,0.3)" }}>
                            {col4}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: esQuotes ? "#FFD700" : (esProduccion || esDespachos ? "#FFD700" : "#888"), fontSize: esQuotes ? "0.95rem" : "0.8rem", fontWeight: esQuotes || esProduccion || esDespachos ? "bold" : "normal" }}>{col5}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardMetric({ title, value, sub, highlight = false, glowColor = "rgba(218,165,32,0.2)" }: { title: string; value: any; sub: string; highlight?: boolean; glowColor?: string }) {
  return (
    <div style={{ 
      background: highlight ? "linear-gradient(145deg, #121005 0%, #1a1608 100%)" : "linear-gradient(145deg, #080808 0%, #121212 100%)", 
      border: `1px solid ${highlight ? "rgba(255,215,0,0.8)" : "rgba(218,165,32,0.3)"}`, 
      borderRadius: "10px", 
      padding: "22px",
      boxShadow: `0 8px 24px ${glowColor}`
    }}>
      <span style={{ fontSize: "0.78rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: "bold" }}>{title}</span>
      <h3 style={{ fontSize: "1.6rem", color: highlight ? "#FFD700" : "#fff", margin: "10px 0 6px 0", fontWeight: "800", textShadow: highlight ? "0 0 12px rgba(255,215,0,0.3)" : "none" }}>{value}</h3>
      <span style={{ fontSize: "0.78rem", color: "#888", fontWeight: "500" }}>{sub}</span>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  color: "#aaa",
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
  marginBottom: "6px",
  fontWeight: "bold"
};

const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "6px",
  padding: "11px 15px",
  color: "#FFD700",
  outline: "none",
  fontSize: "0.92rem",
  fontWeight: "600",
  boxSizing: "border-box" as const
};

const cardBoxStyle = {
  background: "linear-gradient(145deg, #0a0a0a 0%, #141414 100%)",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
};

const btnPrimary = {
  backgroundColor: "#DAA520",
  color: "#000",
  border: "none",
  borderRadius: "6px",
  padding: "12px 22px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.9rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  boxShadow: "0 0 15px rgba(218,165,32,0.4)"
};

const btnGoldOutline = {
  backgroundColor: "transparent",
  color: "#FFD700",
  border: "1px solid #FFD700",
  borderRadius: "6px",
  padding: "12px 22px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.9rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  boxShadow: "0 0 10px rgba(255,215,0,0.2)"
};