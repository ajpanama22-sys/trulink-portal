import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminAnalitica() {
  // Estados para filtros de tiempo en Cotizaciones/Ventas
  const [tipoPeriodo, setTipoPeriodo] = useState<"rango" | "anio">("rango");
  const [fechaInicio, setFechaInicio] = useState("2026-07-01");
  const [fechaFin, setFechaFin] = useState("2026-07-23");
  const [anioFiltro, setAnioFiltro] = useState("2026");

  // Métricas calculadas
  const [metricas, setMetricas] = useState({
    totalCotizaciones: 0,
    montoTotalVentas: 0,
    ventasStripe: 0,
    ventasPaypal: 0,
    ventasTransferencia: 0,
    totalClientes: 0,
    invTotal: 0,
    invFabricados: 0,
    invTerminados: 0,
    invCables: 0,
    invHerrajes: 0,
    invAccesorios: 0
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    calcularReportes();
  }, [tipoPeriodo, fechaInicio, fechaFin, anioFiltro]);

  const calcularReportes = async () => {
    if (!supabase) return;
    setCargando(true);

    try {
      // 1. Consultar Cotizaciones en la tabla 'quotes'
      let query = supabase.from("quotes").select("*");

      if (tipoPeriodo === "rango" && fechaInicio && fechaFin) {
        query = query.gte("created_at", `${fechaInicio}T00:00:00`).lte("created_at", `${fechaFin}T23:59:59`);
      } else if (tipoPeriodo === "anio" && anioFiltro) {
        query = query.gte("created_at", `${anioFiltro}-01-01T00:00:00`).lte("created_at", `${anioFiltro}-12-31T23:59:59`);
      }

      const { data: quotesData } = await query;
      const cotizacionesFiltradas = quotesData || [];

      let montoGlobal = 0;
      let sStripe = 0;
      let sPaypal = 0;
      let sTransfer = 0;

      cotizacionesFiltradas.forEach((item: any) => {
        const monto = Number(item.total_amount) || Number(item.total) || 0;
        montoGlobal += monto;

        const metodo = (item.payment_gateway || item.metodo_pago || "transferencia").toLowerCase();
        if (metodo.includes("stripe")) sStripe += monto;
        else if (metodo.includes("paypal")) sPaypal += monto;
        else sTransfer += monto;
      });

      // 2. Conteo de Clientes
      const { count: clientesCount } = await supabase.from("clientes").select("*", { count: 'exact', head: true });

      // 3. Analítica de Inventario segmentado
      const { data: cables } = await supabase.from("cablesdb").select("*");
      const { data: herrajes } = await supabase.from("herrajesdb").select("*");
      const { data: accesorios } = await supabase.from("accesoriosdb").select("*");

      const totalCables = cables?.length || 0;
      const totalHerrajes = herrajes?.length || 0;
      const totalAccesorios = accesorios?.length || 0;

      const fabricados = totalCables + totalHerrajes;
      const terminados = totalAccesorios;
      const invTotalVal = fabricados + terminados;

      setMetricas({
        totalCotizaciones: cotizacionesFiltradas.length,
        montoTotalVentas: montoGlobal,
        ventasStripe: sStripe,
        ventasPaypal: sPaypal,
        ventasTransferencia: sTransfer,
        totalClientes: clientesCount || 0,
        invTotal: invTotalVal,
        invFabricados: fabricados,
        invTerminados: terminados,
        invCables: totalCables,
        invHerrajes: totalHerrajes,
        invAccesorios: totalAccesorios
      });

    } catch (error) {
      console.error("Error al calcular analítica avanzada:", error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="analitica" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          CENTRO DE ANALÍTICA Y REPORTES GERENCIALES
        </h1>

        {/* Panel de Control de Filtros Temporales */}
        <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "20px", marginBottom: "30px" }}>
          <h3 style={{ fontSize: "1rem", color: "#DAA520", marginBottom: "15px" }}>FILTRO DE PERIODO TEMPORAL (COTIZACIONES Y VENTAS)</h3>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
            <div>
              <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "5px" }}>Tipo de Periodo:</label>
              <select
                value={tipoPeriodo}
                onChange={(e: any) => setTipoPeriodo(e.target.value)}
                style={{ padding: "10px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px" }}
              >
                <option value="rango">Rango de Fechas Personalizado</option>
                <option value="anio">Por Año Específico</option>
              </select>
            </div>

            {tipoPeriodo === "rango" && (
              <>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "5px" }}>Desde:</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{ padding: "9px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "5px" }}>Hasta:</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={{ padding: "9px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px" }}
                  />
                </div>
              </>
            )}

            {tipoPeriodo === "anio" && (
              <div>
                <label style={{ fontSize: "0.85rem", color: "#888", display: "block", marginBottom: "5px" }}>Año Seleccionado:</label>
                <select
                  value={anioFiltro}
                  onChange={(e) => setAnioFiltro(e.target.value)}
                  style={{ padding: "10px", backgroundColor: "#111", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px" }}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>Procesando analítica multidimensional...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            {/* SECCIÓN 1: VENTAS Y CONSOLIDADO COMERCIAL */}
            <div>
              <h2 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "15px", borderLeft: "4px solid #DAA520", paddingLeft: "10px" }}>
                REPORTE FINANCIERO Y VENTAS
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "20px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "8px" }}>VOLUMEN DE COTIZACIONES</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#fff" }}>{metricas.totalCotizaciones}</div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "5px" }}>En el periodo seleccionado</div>
                </div>

                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "20px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "8px" }}>CONSOLIDADO COMERCIAL TOTAL</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#2ecc71" }}>
                    ${metricas.montoTotalVentas.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "5px" }}>Valor bruto cotizado / facturado</div>
                </div>
              </div>

              {/* Desglose por Pasarelas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "15px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #222", borderRadius: "6px", padding: "15px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>STRIPE</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff", marginTop: "5px" }}>${metricas.ventasStripe.toFixed(2)}</div>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #222", borderRadius: "6px", padding: "15px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>PAYPAL</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff", marginTop: "5px" }}>${metricas.ventasPaypal.toFixed(2)}</div>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #222", borderRadius: "6px", padding: "15px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>TRANSFERENCIAS BANCARIAS</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff", marginTop: "5px" }}>${metricas.ventasTransferencia.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: REPORTE DE INVENTARIO */}
            <div>
              <h2 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "15px", borderLeft: "4px solid #DAA520", paddingLeft: "10px" }}>
                REPORTE DE INVENTARIO Y ALMACÉN
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "20px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "8px" }}>INVENTARIO TOTAL ACTIVO</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#fff" }}>{metricas.invTotal} SKUs</div>
                </div>

                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "20px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "8px" }}>PRODUCTOS FABRICADOS</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#f39c12" }}>{metricas.invFabricados} SKUs</div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "5px" }}>Cables y Herrajes de línea propia</div>
                </div>

                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "20px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "8px" }}>PRODUCTOS TERMINADOS / OTROS</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#3498db" }}>{metricas.invTerminados} SKUs</div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "5px" }}>Accesorios y suministros</div>
                </div>
              </div>

              {/* Desglose por Bases de Datos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "15px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #222", borderRadius: "6px", padding: "15px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>Base: Cables (`cablesdb`)</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#DAA520", marginTop: "5px" }}>{metricas.invCables} registros</div>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #222", borderRadius: "6px", padding: "15px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>Base: Herrajes (`herrajesdb`)</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#DAA520", marginTop: "5px" }}>{metricas.invHerrajes} registros</div>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #222", borderRadius: "6px", padding: "15px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>Base: Accesorios (`accesoriosdb`)</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#DAA520", marginTop: "5px" }}>{metricas.invAccesorios} registros</div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}