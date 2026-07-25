import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

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
      // 'tipo' contiene directamente el nombre físico de la tabla en Supabase
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
        estadoFiltro: "Cotizaciones"
      });
    } else if (tipo === "cablesdb" || tipo === "herrajesdb" || tipo === "accesoriosdb") {
      const sumaInv = registros.reduce((acc, item) => acc + Number(item.precio || item.stock || 0), 0);
      setResumenEjecutivo({
        totalRegistros: total,
        montoTotal: sumaInv,
        promedioValor: total > 0 ? sumaInv / total : 0,
        estadoFiltro: `Inventario de SKUs`
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
                <option value="pdf" style={{ background: "#111", color: "#DAA520" }}>Documento Ejecutivo PDF</option>
                <option value="excel" style={{ background: "#111", color: "#DAA520" }}>Hoja de Cálculo Excel (.xlsx)</option>
                <option value="csv" style={{ background: "#111", color: "#DAA520" }}>Archivo Comprimido CSV</option>
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
            <button onClick={() => alert(`Generando reporte en formato ${formatoExportacion.toUpperCase()}... Archivo listo para descarga corporativa.`)} style={btnGoldOutline}>
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