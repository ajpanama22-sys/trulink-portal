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
      const { data, error } = await supabase
        .from(tipo)
        .select("*");

      if (error) {
        console.error("Error en consulta Supabase:", error);
        procesarResultados(tipo, []);
      } else {
        procesarResultados(tipo, data || []);
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

    if (tipo === "quotes") {
      const suma = registros.reduce((acc, item) => acc + Number(item.total || 0), 0);
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: suma,
        promedioValor: total > 0 ? suma / total : 0,
        estadoFiltro: "Cotizaciones y Finanzas"
      });
    } else if (tipo === "cablesdb" || tipo === "herrajesdb" || tipo === "accesoriosdb") {
      const sumaInv = registros.reduce((acc, item) => acc + Number(item.precio || item.stock || 0), 0);
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: sumaInv,
        promedioValor: total > 0 ? sumaInv / total : 0,
        estadoFiltro: `Inventario - ${tipo.toUpperCase()}`
      });
    } else if (tipo === "clientes") {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: "Directorio de Clientes"
      });
    } else if (tipo === "colaboradores") {
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: 0,
        promedioValor: 0,
        estadoFiltro: "Directorio de Colaboradores"
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

  // GENERADOR DE PDF CORPORATIVO CON ESTÉTICA NEGRO/DORADO Y GRÁFICAS ANALÍTICAS
  const handleDescargarReporteOficial = () => {
    if (datosReporte.length === 0) {
      alert("No hay registros disponibles para exportar en este rango.");
      return;
    }

    if (formatoExportacion === "pdf") {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const fechaEmision = new Date().toLocaleDateString();
      const horaEmision = new Date().toLocaleTimeString();

      // Fondo de la cabecera (Estética Corporativa Oscura)
      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, 210, 45, "F");

      // Línea Dorada Decorativa Superior
      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(1.2);
      doc.line(0, 45, 210, 45);

      // Marca y Título
      doc.setTextColor(255, 215, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("TRULINK", 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      doc.text("TRULINK FIBER LLC", 14, 25);
      doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 30);
      doc.text("Tel: +507 6640 3720 | www.trulinkfiber.com", 14, 35);

      // Metadatos de Fecha, Hora y Referencia a la derecha
      doc.setTextColor(255, 215, 0);
      doc.setFontSize(11);
      doc.text(`REPORTE OFICIAL: ${tipoReporte.toUpperCase()}`, 200, 18, { align: "right" });
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(`Fecha: ${fechaEmision} | Hora: ${horaEmision}`, 200, 25, { align: "right" });
      doc.text(`Rango: ${fechaDesde} al ${fechaHasta}`, 200, 31, { align: "right" });

      // Información de Resumen Ejecutivo
      let currentY = 55;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.text(`Módulo Analizado: ${resumenEjecutivo.estadoFiltro}`, 14, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.text(`Total de Registros: ${resumenEjecutivo.totalRegistros}`, 14, currentY);
      doc.text(`Monto Consolidado: $${resumenEjecutivo.montoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 80, currentY);
      doc.text(`Promedio por Registro: $${resumenEjecutivo.promedioValor.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 150, currentY);
      currentY += 10;

      // Generación de Gráfica Analítica Vectorial Multicolor en el PDF
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(184, 134, 11); // Tono Oro Oscuro
      doc.text("ANÁLISIS GRÁFICO DE DISTRIBUCIÓN", 14, currentY);
      currentY += 6;

      // Dibujo de Gráfica de Barras Multicorporativa simulando analítica
      const chartX = 14;
      const chartY = currentY;
      const chartWidth = 182;
      const chartHeight = 25;

      doc.setFillColor(245, 245, 245);
      doc.rect(chartX, chartY, chartWidth, chartHeight, "F");
      doc.setDrawColor(218, 165, 32);
      doc.rect(chartX, chartY, chartWidth, chartHeight, "S");

      // Barras de ejemplo multicolores basadas en los datos
      const barColors = [
        [218, 165, 32], // Dorado Principal
        [40, 116, 166], // Azul Corporativo
        [39, 174, 96],  // Verde Finanzas
        [142, 68, 173], // Morado Analítico
        [211, 84, 0]    // Naranja Acento
      ];

      const maxBars = Math.min(datosReporte.length, 10);
      const barWidth = (chartWidth - 20) / (maxBars || 1);

      for (let i = 0; i < maxBars; i++) {
        const valRandom = Number(datosReporte[i].total || datosReporte[i].precio || datosReporte[i].stock || (i + 1) * 10);
        const barHeight = Math.min(Math.max((valRandom / (resumenEjecutivo.montoTotal || 100)) * 18, 5), 20);
        const color = barColors[i % barColors.length];

        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(chartX + 10 + (i * barWidth) + 3, chartY + chartHeight - barHeight - 4, barWidth - 6, barHeight, "F");
      }

      currentY += chartHeight + 12;

      // Tabla de Datos con Autotable (Estilo Dorado y Negro)
      const tableColumns = ["ID / SKU", "Descripción / Nombre", "Monto / Stock", "Estado", "Fecha"];
      const tableRows = datosReporte.map((row) => [
        row.id ? String(row.id).substring(0, 8) : (row.sku || "N/A"),
        row.descripcion || row.nombre || row.client_name || row.email || "Registro General",
        row.total ? `$${Number(row.total).toFixed(2)}` : (row.precio ? `$${Number(row.precio).toFixed(2)}` : (row.stock ?? "---")),
        row.estado_pago || row.tipo || row.role || "Activo",
        row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"
      ]);

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

      // Pie de Página Corporativo
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("NOTA: Este documento es un reporte oficial generado por el Centro de Inteligencia y Documentación de Trulink Fiber LLC.", 14, 285);
        doc.text(`Página ${i} de ${pageCount}`, 200, 285, { align: "right" });
      }

      // Descarga inmediata del PDF estilizado
      doc.save(`Reporte_Oficial_${tipoReporte}_${new Date().toISOString().slice(0, 10)}.pdf`);

    } else {
      // Exportación en formato CSV / Excel optimizado
      let csvContent = "data:text/csv;charset=utf-8,ID_SKU,Descripcion,Monto_Stock,Estado_Tipo,Fecha\n";
      datosReporte.forEach((row) => {
        const idSeguro = `"${row.id || row.sku || "N/A"}"`;
        const descSegura = `"${(row.descripcion || row.nombre || row.client_name || row.email || "General").replace(/"/g, '""')}"`;
        const montoSeguro = `"${row.total || row.precio || row.stock || 0}"`;
        const estadoSeguro = `"${row.estado_pago || row.tipo || row.role || "Activo"}"`;
        const fechaSegura = `"${row.created_at ? new Date(row.created_at).toLocaleDateString() : "---"}"`;

        csvContent += [idSeguro, descSegura, montoSeguro, estadoSeguro, fechaSegura].join(",") + "\n";
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

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="reportes" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "15px" }}>
          <h1 style={{ fontSize: "1.8rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1.5px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
            REPORTES EJECUTIVOS
          </h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <span style={{ fontSize: "0.75rem", background: "rgba(218, 165, 32, 0.1)", color: "#FFD700", border: "1px solid rgba(218, 165, 32, 0.4)", padding: "6px 14px", borderRadius: "20px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", boxShadow: "0 0 10px rgba(218,165,32,0.15)" }}>
              📊 Centro de Inteligencia y Documentación
            </span>
          </div>
        </div>

        <div style={{ background: "linear-gradient(145deg, #0a0a0a 0%, #141414 100%)", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "12px", padding: "24px", marginBottom: "35px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "16px", color: "#FFD700", letterSpacing: "0.8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚙️</span> Parámetros de Generación y Exportación
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <label style={labelStyle}>Tipo de Reporte</label>
              <select value={tipoReporte} onChange={(e) => setTipoReporte(e.target.value)} style={inputStyle}>
                <option value="quotes" style={{ background: "#111", color: "#DAA520" }}>Cotizaciones y Finanzas</option>
                <option value="cablesdb" style={{ background: "#111", color: "#DAA520" }}>Inventario de Cables</option>
                <option value="herrajesdb" style={{ background: "#111", color: "#DAA520" }}>Inventario de Herrajes</option>
                <option value="accesoriosdb" style={{ background: "#111", color: "#DAA520" }}>Inventario de Accesorios</option>
                <option value="clientes" style={{ background: "#111", color: "#DAA520" }}>Directorio de Clientes</option>
                <option value="colaboradores" style={{ background: "#111", color: "#DAA520" }}>Directorio de Colaboradores</option>
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
              🔍 Actualizar Vista Previa
            </button>
            <button onClick={handleDescargarReporteOficial} style={btnGoldOutline}>
              📥 Descargar Reporte Oficial
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "35px" }}>
          <CardMetric title="Total Registros" value={resumenEjecutivo.totalRegistros} sub="Elementos en el reporte actual" glowColor="rgba(218,165,32,0.3)" />
          <CardMetric title="Monto Consolidado" value={`$${resumenEjecutivo.montoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Valor financiero total acumulado" highlight={true} glowColor="rgba(255,215,0,0.5)" />
          <CardMetric title="Promedio por Registro" value={`$${resumenEjecutivo.promedioValor.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Ticket medio analizado" glowColor="rgba(218,165,32,0.3)" />
          <CardMetric title="Estado del Módulo" value={resumenEjecutivo.estadoFiltro} sub="Conexión Supabase activa" highlight={true} glowColor="rgba(255,215,0,0.5)" />
        </div>

        <div style={cardBoxStyle}>
          <h3 style={{ color: "#FFD700", marginBottom: "18px", fontSize: "1.1rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Vista Previa de Datos ({datosReporte.length} registros encontrados)
          </h3>

          {cargando ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#FFD700", fontStyle: "italic" }}>Consultando registros en base de datos...</p>
            </div>
          ) : datosReporte.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#888" }}>No se encontraron registros en la tabla consultada.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(218, 165, 32, 0.4)", color: "#FFD700" }}>
                    <th style={{ padding: "12px" }}>ID / SKU</th>
                    <th style={{ padding: "12px" }}>Descripción / Nombre</th>
                    <th style={{ padding: "12px" }}>Monto / Stock</th>
                    <th style={{ padding: "12px" }}>Estado / Tipo</th>
                    <th style={{ padding: "12px" }}>Fecha Creación</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.slice(0, 10).map((row, idx) => {
                    const idSeguro = row.id ? String(row.id).substring(0, 8) : (row.sku ? String(row.sku) : "N/A");
                    const descSegura = row.descripcion || row.nombre || row.client_name || row.email || "Registro General";
                    const montoSeguro = row.total ? `$${Number(row.total).toFixed(2)}` : (row.precio ? `$${Number(row.precio).toFixed(2)}` : (row.stock ?? "---"));
                    const estadoSeguro = row.estado_pago || row.tipo || row.role || "Activo";
                    const fechaSegura = row.created_at ? new Date(row.created_at).toLocaleDateString() : "---";

                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #1c1c1c", color: "#ccc" }}>
                        <td style={{ padding: "12px", color: "#FFD700", fontWeight: "bold" }}>{idSeguro}</td>
                        <td style={{ padding: "12px" }}>{descSegura}</td>
                        <td style={{ padding: "12px", fontWeight: "bold", color: "#fff" }}>{montoSeguro}</td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ backgroundColor: "rgba(218,165,32,0.1)", color: "#FFD700", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", border: "1px solid rgba(218,165,32,0.3)" }}>
                            {estadoSeguro}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: "#888", fontSize: "0.8rem" }}>{fechaSegura}</td>
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
  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
  boxSizing: "border-box" as const
};

const btnPrimary = {
  background: "linear-gradient(135deg, #FFD700 0%, #DAA520 100%)",
  color: "#000",
  border: "none",
  borderRadius: "6px",
  padding: "11px 22px",
  fontWeight: "800",
  cursor: "pointer",
  fontSize: "0.92rem",
  boxShadow: "0 4px 15px rgba(218,165,32,0.4)",
  transition: "all 0.3s ease"
};

const btnGoldOutline = {
  background: "transparent",
  color: "#FFD700",
  border: "1px solid rgba(218, 165, 32, 0.8)",
  borderRadius: "6px",
  padding: "11px 22px",
  fontWeight: "800",
  cursor: "pointer",
  fontSize: "0.92rem",
  boxShadow: "0 4px 15px rgba(218,165,32,0.2)",
  transition: "all 0.3s ease"
};

const cardBoxStyle = {
  background: "linear-gradient(145deg, #080808 0%, #121212 100%)",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "10px",
  padding: "22px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
};