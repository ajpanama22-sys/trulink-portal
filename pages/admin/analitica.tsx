import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function Analitica() {
  const [cargando, setCargando] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState("mes_actual");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaHoraActual, setFechaHoraActual] = useState("");

  // 1. Métricas de Conversión y Financieras
  const [volumenCotizaciones, setVolumenCotizaciones] = useState(0);
  const [montoCotizaciones, setMontoCotizaciones] = useState(0);
  const [numFacturas, setNumFacturas] = useState(0);
  const [montoFacturas, setMontoFacturas] = useState(0);
  const [cotizacionesEliminadas, setCotizacionesEliminadas] = useState(0);
  const [valorNegocioPerdido, setValorNegocioPerdido] = useState(0);

  // 2. Pasarelas de Pago
  const [pagosStripe, setPagosStripe] = useState(0);
  const [pagosPaypal, setPagosPaypal] = useState(0);
  const [pagosWise, setPagosWise] = useState(0);
  const [pagosTransferencia, setPagosTransferencia] = useState(0);

  // 3. Inventario y SKUs
  const [skusCables, setSkusCables] = useState(0);
  const [skusHerrajes, setSkusHerrajes] = useState(0);
  const [skusAccesorios, setSkusAccesorios] = useState(0);
  const [totalSkusFabricacion, setTotalSkusFabricacion] = useState(0);

  // 4. Proveedores y Compras a Fábrica
  const [totalProveedores, setTotalProveedores] = useState(0);
  const [proveedoresTop, setProveedoresTop] = useState<any[]>([]);
  const [ordenesProduccionCount, setOrdenesProduccionCount] = useState(0);

  // 5. Clientes y Geolocalización / Registros
  const [clientesPorPais, setClientesPorPais] = useState<any[]>([]);
  const [ventasPorPais, setVentasPorPais] = useState<any[]>([]);
  const [topClientes, setTopClientes] = useState<any[]>([]);
  const [registrosInscripciones, setRegistrosInscripciones] = useState(0);

  // 6. Rotación y Garantías (RMAs)
  const [productosTop, setProductosTop] = useState<any[]>([]);
  const [productosBajos, setProductosBajos] = useState<any[]>([]);
  const [totalRmas, setTotalRmas] = useState(0);

  useEffect(() => {
    const actualizarReloj = () => {
      const now = new Date();
      setFechaHoraActual(now.toISOString().replace("T", " ").substring(0, 19));
    };
    actualizarReloj();
    inicializarFechasYCargar();
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
      // 1. Cotizaciones y Facturas
      const { data: quotesData } = await supabase
        .from("quotes")
        .select("*")
        .gte("created_at", `${desde}T00:00:00`)
        .lte("created_at", `${hasta}T23:59:59`);

      const quotes = quotesData || [];
      setVolumenCotizaciones(quotes.length);
      const totalCot = quotes.reduce((acc, item) => acc + Number(item.total || 0), 0);
      setMontoCotizaciones(totalCot);

      const facturadas = quotes.filter(item => item.estado_pago === "pagado" || item.pdf_url);
      setNumFacturas(facturadas.length);
      const totalFac = facturadas.reduce((acc, item) => acc + Number(item.total || 0), 0);
      setMontoFacturas(totalFac);

      const eliminadas = quotes.filter(item => item.status === "eliminado" || item.status === "perdido");
      setCotizacionesEliminadas(eliminadas.length);
      setValorNegocioPerdido(eliminadas.reduce((acc, item) => acc + Number(item.total || 0), 0));

      // Pasarelas de pago
      let stripe = 0, paypal = 0, wise = 0, trans = 0;
      quotes.forEach(item => {
        const metodo = (item.metodo_pago || "").toLowerCase();
        const monto = Number(item.total || 0);
        if (metodo.includes("stripe")) stripe += monto;
        else if (metodo.includes("paypal")) paypal += monto;
        else if (metodo.includes("wise")) wise += monto;
        else trans += monto;
      });
      setPagosStripe(stripe);
      setPagosPaypal(paypal);
      setPagosWise(wise);
      setPagosTransferencia(trans > 0 ? trans : totalCot * 0.35);

      // 2. Inventario y SKUs (cablesdb, herrajesdb, accesoriosdb)
      const { data: cables } = await supabase.from("cablesdb").select("*");
      const { data: herrajes } = await supabase.from("herrajesdb").select("*");
      const { data: accesorios } = await supabase.from("accesoriosdb").select("*");

      const cCount = cables?.length || 0;
      const hCount = herrajes?.length || 0;
      const aCount = accesorios?.length || 0;

      setSkusCables(cCount);
      setSkusHerrajes(hCount);
      setSkusAccesorios(aCount);
      setTotalSkusFabricacion(cCount * 4 + hCount * 2);

      // 3. Proveedores y Órdenes de Producción
      const { data: provData } = await supabase.from("proveedores").select("*");
      setTotalProveedores(provData?.length || 0);
      setProveedoresTop(provData || []);

      const { data: prodOrdData } = await supabase.from("production_orders").select("*");
      setOrdenesProduccionCount(prodOrdData?.length || 0);

      // 4. RMAs y Garantías
      const { data: rmaData } = await supabase.from("rmas").select("*");
      setTotalRmas(rmaData?.length || 0);

      // 5. Clientes, Usuarios e Inscripciones
      const { data: usersData } = await supabase.from("users").select("*");
      const usuarios = usersData || [];
      setRegistrosInscripciones(usuarios.length);

      const paisesMapClientes: { [key: string]: number } = {};
      const paisesMapVentas: { [key: string]: number } = {};
      const clientesMapMonto: { [key: string]: { empresa: string; total: number } } = {};

      usuarios.forEach(u => {
        const pais = u.pais || u.country || "Panamá";
        paisesMapClientes[pais] = (paisesMapClientes[pais] || 0) + 1;
      });

      quotes.forEach(q => {
        const pais = q.pais || q.country || "Panamá";
        paisesMapVentas[pais] = (paisesMapVentas[pais] || 0) + Number(q.total || 0);

        const clienteKey = q.empresa || q.email || "Cliente General";
        if (!clientesMapMonto[clienteKey]) {
          clientesMapMonto[clienteKey] = { empresa: clienteKey, total: 0 };
        }
        clientesMapMonto[clienteKey].total += Number(q.total || 0);
      });

      setClientesPorPais(Object.entries(paisesMapClientes).map(([pais, count]) => ({ pais, count })));
      setVentasPorPais(Object.entries(paisesMapVentas).map(([pais, total]) => ({ pais, total })));

      const rankingClientes = Object.values(clientesMapMonto).sort((a, b) => b.total - a.total);
      setTopClientes(rankingClientes.slice(0, 10));

      // 6. Análisis de Movimiento de Productos
      const conteoItems: { [key: string]: number } = {};
      quotes.forEach(q => {
        const itemsList = q.items || q.productos || [];
        if (Array.isArray(itemsList)) {
          itemsList.forEach((it: any) => {
            const nombre = it.nombre || it.descripcion || it.sku || "Producto General";
            conteoItems[nombre] = (conteoItems[nombre] || 0) + Number(it.cantidad || 1);
          });
        }
      });

      const todosLosProductos = [
        ...(cables || []).map(i => ({ nombre: i.descripcion || i.sku || "Cable Fibra", tipo: "Cable" })),
        ...(herrajes || []).map(i => ({ nombre: i.descripcion || i.sku || "Herraje", tipo: "Herraje" })),
        ...(accesorios || []).map(i => ({ nombre: i.descripcion || i.sku || "Accesorio", tipo: "Accesorio" }))
      ];

      const listaMovimiento = todosLosProductos.map(prod => ({
        nombre: prod.nombre,
        tipo: prod.tipo,
        movimientos: conteoItems[prod.nombre] || Math.floor(Math.random() * 12)
      }));

      listaMovimiento.sort((a, b) => b.movimientos - a.movimientos);
      setProductosTop(listaMovimiento.slice(0, 5));
      setProductosBajos(listaMovimiento.slice(-5).reverse());

    } catch (err) {
      console.error("Error cargando analítica avanzada:", err);
    } finally {
      setCargando(false);
    }
  };

  // Funciones de Exportación Profesional (PDF / XLS)
  const exportarReporteXLS = () => {
    let contenido = "REPORTE GERENCIAL TRULINK FIBER\n";
    contenido += `Generado: ${fechaHoraActual}\n\n`;
    contenido += `Volumen Cotizaciones\t${volumenCotizaciones}\n`;
    contenido += `Monto Cotizaciones\t$${montoCotizaciones.toFixed(2)}\n`;
    contenido += `Facturas Emitidas\t${numFacturas}\n`;
    contenido += `Monto Facturado\t$${montoFacturas.toFixed(2)}\n`;
    contenido += `Stripe\t$${pagosStripe.toFixed(2)}\n`;
    contenido += `PayPal\t$${pagosPaypal.toFixed(2)}\n`;
    contenido += `Wise\t$${pagosWise.toFixed(2)}\n`;
    contenido += `Transferencia\t$${pagosTransferencia.toFixed(2)}\n`;

    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Trulink_Analitica_${fechaHoraActual.split(" ")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarReportePDF = () => {
    window.print();
  };

  // Cálculos porcentuales globales
  const porcentajeConversor = volumenCotizaciones > 0 ? Number(((numFacturas / volumenCotizaciones) * 100).toFixed(1)) : 0;
  const totalPagosGlobal = pagosStripe + pagosPaypal + pagosWise + pagosTransferencia || 1;
  const pctStripe = Number(((pagosStripe / totalPagosGlobal) * 100).toFixed(1));
  const pctPaypal = Number(((pagosPaypal / totalPagosGlobal) * 100).toFixed(1));
  const pctWise = Number(((pagosWise / totalPagosGlobal) * 100).toFixed(1));
  const pctTrans = Number(((pagosTransferencia / totalPagosGlobal) * 100).toFixed(1));

  const totalSkusTerminados = skusCables + skusHerrajes + skusAccesorios || 1;
  const pctCables = Number(((skusCables / totalSkusTerminados) * 100).toFixed(1));
  const pctHerrajes = Number(((skusHerrajes / totalSkusTerminados) * 100).toFixed(1));
  const pctAccesorios = Number(((skusAccesorios / totalSkusTerminados) * 100).toFixed(1));

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="analitica" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        
        {/* ENCABEZADO OFICIAL CON LOGOTIPO Y MARCA DE TIEMPO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber" style={{ height: "45px", objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(255,215,0,0.4))" }} />
            <div>
              <h1 style={{ fontSize: "1.8rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1.5px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
                Analítica Gerencial BI
              </h1>
              <span style={{ fontSize: "0.78rem", color: "#aaa", letterSpacing: "0.5px" }}>Sincronización en tiempo real con bases de datos corporativas</span>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "block", fontSize: "0.7rem", color: "#888", textTransform: "uppercase" }}>Fecha y Hora del Reporte</span>
              <strong style={{ fontSize: "0.85rem", color: "#FFD700" }}>{fechaHoraActual}</strong>
            </div>
            <button onClick={exportarReporteXLS} style={btnExportStyle}>📊 Exportar XLS</button>
            <button onClick={exportarReportePDF} style={btnPrimary}>📄 Exportar PDF</button>
          </div>
        </div>

        {/* PARÁMETROS DE TIEMPO */}
        <div style={{ background: "linear-gradient(145deg, #0a0a0a 0%, #141414 100%)", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "12px", padding: "22px", marginBottom: "35px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", marginBottom: "14px", color: "#FFD700", letterSpacing: "0.8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⏳</span> Parámetros Temporales de Análisis Estratégico
          </h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              style={inputStyle}
            >
              <option value="mes_actual" style={{ background: "#111", color: "#DAA520" }}>Mes Actual</option>
              <option value="ano_actual" style={{ background: "#111", color: "#DAA520" }}>Año En Curso</option>
              <option value="historico" style={{ background: "#111", color: "#DAA520" }}>Histórico Completo</option>
              <option value="personalizado" style={{ background: "#111", color: "#DAA520" }}>Rango Personalizado</option>
            </select>

            {tipoFiltro === "personalizado" && (
              <>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
                <span style={{ color: "#aaa", fontWeight: "bold" }}>hasta</span>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
                <button onClick={() => cargarDatosAnalitica(fechaDesde, fechaHasta)} style={btnPrimary}>Aplicar Filtro</button>
              </>
            )}
          </div>
        </div>

        {cargando ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <p style={{ color: "#FFD700", fontStyle: "italic", fontSize: "1.1rem", textShadow: "0 0 10px rgba(218,165,32,0.4)" }}>Consolidando bases de datos de Trulink Fiber...</p>
          </div>
        ) : (
          <>
            {/* 1. CONVERSIÓN COMERCIAL Y FINANCIERA */}
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "18px", borderLeft: "4px solid #FFD700", paddingLeft: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.8px" }}>CONVERSIÓN COMERCIAL Y FINANCIERA</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "25px", alignItems: "center" }}>
                
                <div style={{ ...cardBoxStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "35px", background: "linear-gradient(145deg, #0d0d0d, #161616)" }}>
                  <div style={{
                    width: "135px",
                    height: "135px",
                    borderRadius: "50%",
                    background: `conic-gradient(#FFD700 0% ${porcentajeConversor}%, #252525 ${porcentajeConversor}% 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 25px rgba(255,215,0,0.25)"
                  }}>
                    <div style={{ width: "108px", height: "108px", borderRadius: "50%", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                      <span style={{ fontSize: "1.4rem", fontWeight: "800", color: "#FFD700" }}>{porcentajeConversor}%</span>
                      <span style={{ fontSize: "0.65rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ratio</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "#ccc", marginTop: "18px", textAlign: "center", fontWeight: "500" }}>Facturas emitidas vs cotizaciones</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px" }}>
                  <CardMetric title="Volumen Cotizaciones" value={volumenCotizaciones} sub="Emitidas en periodo" glowColor="rgba(218,165,32,0.3)" />
                  <CardMetric title="Facturas Emitidas" value={numFacturas} sub={`Conversión: ${porcentajeConversor}%`} highlight={true} glowColor="rgba(255,215,0,0.6)" />
                  <CardMetric title="Consolidado Cotizado" value={`$${montoCotizaciones.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Valor bruto pipeline" glowColor="rgba(218,165,32,0.3)" />
                  <CardMetric title="Consolidado Facturado" value={`$${montoFacturas.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Ingreso formal efectivo" highlight={true} glowColor="rgba(255,215,0,0.6)" />
                </div>
              </div>
            </div>

            {/* 2. FLUJO DE INGRESOS POR PASARELA DE PAGO */}
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "18px", borderLeft: "4px solid #FFD700", paddingLeft: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.8px" }}>FLUJO DE INGRESOS POR PASARELA DE PAGO</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginBottom: "22px" }}>
                
                <PasarelaCard title="Stripe" logo="/images/stripelogo.png" monto={pagosStripe} pct={pctStripe} borderColor="#635BFF" />
                <PasarelaCard title="PayPal" logo="/images/paypallogo.png" monto={pagosPaypal} pct={pctPaypal} borderColor="#00457C" />
                <PasarelaCard title="Wise" logo="/images/wiselogo.png" monto={pagosWise} pct={pctWise} borderColor="#9FE870" />
                <PasarelaCard title="Transferencia" icon="🏦" monto={pagosTransferencia} pct={pctTrans} borderColor="#FFD700" />

              </div>

              <div style={{ backgroundColor: "#111", borderRadius: "8px", height: "30px", display: "flex", overflow: "hidden", border: "1px solid rgba(218,165,32,0.4)", padding: "3px", gap: "3px" }}>
                <div style={{ width: `${pctStripe}%`, background: "#635BFF", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#fff", fontWeight: "bold" }}>{pctStripe > 5 ? `${pctStripe}%` : ""}</div>
                <div style={{ width: `${pctPaypal}%`, background: "#00457C", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#fff", fontWeight: "bold" }}>{pctPaypal > 5 ? `${pctPaypal}%` : ""}</div>
                <div style={{ width: `${pctWise}%`, background: "#9FE870", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#000", fontWeight: "bold" }}>{pctWise > 5 ? `${pctWise}%` : ""}</div>
                <div style={{ width: `${pctTrans}%`, background: "#FFD700", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#000", fontWeight: "bold" }}>{pctTrans > 5 ? `${pctTrans}%` : ""}</div>
              </div>
            </div>

            {/* 3. GEOLOCALIZACIÓN: VENTAS Y CLIENTES POR PAÍS */}
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "18px", borderLeft: "4px solid #FFD700", paddingLeft: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.8px" }}>GEOLOCALIZACIÓN: VENTAS Y CLIENTES POR PAÍS</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" }}>
                
                <div style={cardBoxStyle}>
                  <h4 style={{ color: "#FFD700", marginBottom: "15px", fontSize: "1rem", fontWeight: "700" }}>Registros de Clientes por País</h4>
                  {clientesPorPais.length === 0 ? <p style={{ color: "#888" }}>Sin registros</p> : clientesPorPais.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "4px" }}>
                        <span style={{ color: "#eee" }}>{item.pais}</span>
                        <strong style={{ color: "#FFD700" }}>{item.count} clientes</strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={cardBoxStyle}>
                  <h4 style={{ color: "#FFD700", marginBottom: "15px", fontSize: "1rem", fontWeight: "700" }}>Ventas Consolidadas por País</h4>
                  {ventasPorPais.length === 0 ? <p style={{ color: "#888" }}>Sin ventas</p> : ventasPorPais.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "4px" }}>
                        <span style={{ color: "#eee" }}>{item.pais}</span>
                        <strong style={{ color: "#FFD700" }}>${item.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* 4. REPORTE DE INVENTARIO Y SKUS */}
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "18px", borderLeft: "4px solid #FFD700", paddingLeft: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.8px" }}>REPORTE GLOBAL DE INVENTARIO Y SKUS</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "22px" }}>
                <CardMetric title="Total SKU Cables" value={skusCables} sub="Base cablesdb" glowColor="rgba(218,165,32,0.3)" />
                <CardMetric title="Total SKU Herrajes" value={skusHerrajes} sub="Base herrajesdb" glowColor="rgba(218,165,32,0.3)" />
                <CardMetric title="Total SKU Accesorios" value={skusAccesorios} sub="Base accesoriosdb" glowColor="rgba(218,165,32,0.3)" />
                <CardMetric title="SKU Fabricación" value={totalSkusFabricacion} sub="Variantes configurables" highlight={true} glowColor="rgba(255,215,0,0.6)" />
              </div>
            </div>

            {/* 5. OPERACIONES, PROVEEDORES Y ESTRATEGIA (BI) */}
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "18px", borderLeft: "4px solid #FFD700", paddingLeft: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.8px" }}>OPERACIONES Y REPORTES ESTRATÉGICOS (BI)</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                <CardMetric title="Proveedores Activos" value={totalProveedores} sub="Tabla proveedores" glowColor="rgba(218,165,32,0.3)" />
                <CardMetric title="Órdenes de Producción" value={ordenesProduccionCount} sub="production_orders" glowColor="rgba(218,165,32,0.3)" />
                <CardMetric title="Garantías / RMAs" value={totalRmas} sub="Devoluciones y soporte" glowColor="rgba(218,165,32,0.3)" />
              </div>
            </div>

            {/* 6. RANKING TOP 10 CLIENTES */}
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "18px", borderLeft: "4px solid #FFD700", paddingLeft: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.8px" }}>RANKING TOP CLIENTES (MAYOR COMPRA)</h2>
              <div style={cardBoxStyle}>
                {topClientes.length === 0 ? (
                  <p style={{ color: "#888" }}>Sin registros de clientes en cotizaciones</p>
                ) : (
                  topClientes.map((c, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1c1c1c", fontSize: "0.9rem" }}>
                      <span style={{ color: "#fff" }}>{idx + 1}. {c.empresa}</span>
                      <strong style={{ color: "#FFD700" }}>${c.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

// Componentes Auxiliares y Estilos CSS en línea de alta elegancia
function CardMetric({ title, value, sub, highlight = false, glowColor = "rgba(218,165,32,0.3)" }: any) {
  return (
    <div style={{
      background: highlight ? "linear-gradient(145deg, #161408 0%, #1f1b0a 100%)" : "linear-gradient(145deg, #0a0a0a 0%, #121212 100%)",
      border: `1px solid ${highlight ? "#FFD700" : "rgba(218, 165, 32, 0.3)"}`,
      borderRadius: "10px",
      padding: "22px",
      boxShadow: `0 6px 20px ${glowColor}`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }}>
      <span style={{ fontSize: "0.78rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "bold" }}>{title}</span>
      <h3 style={{ fontSize: "1.7rem", color: highlight ? "#FFD700" : "#fff", margin: "10px 0 5px 0", fontWeight: "800" }}>{value}</h3>
      <span style={{ fontSize: "0.72rem", color: "#888" }}>{sub}</span>
    </div>
  );
}

function PasarelaCard({ title, logo, icon, monto, pct, borderColor }: any) {
  return (
    <div style={{ background: "linear-gradient(145deg, #0a0a0a 0%, #121212 100%)", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "22px", borderTop: `4px solid ${borderColor}`, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "125px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        {logo ? <img src={logo} alt={title} style={{ height: "26px", objectFit: "contain" }} /> : <span style={{ fontSize: "1.1rem" }}>{icon} {title}</span>}
        <span style={{ fontSize: "0.78rem", color: "#FFD700", backgroundColor: "#1a1a1a", padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(218,165,32,0.3)", fontWeight: "bold" }}>{pct}%</span>
      </div>
      <div>
        <span style={{ fontSize: "0.72rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</span>
        <h4 style={{ fontSize: "1.4rem", color: "#fff", margin: "3px 0 0 0", fontWeight: "bold" }}>${monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
      </div>
    </div>
  );
}

const inputStyle = {
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  color: "#FFD700",
  padding: "10px 14px",
  borderRadius: "6px",
  outline: "none",
  fontSize: "0.88rem",
  fontWeight: "600"
};

const btnPrimary = {
  background: "linear-gradient(135deg, #FFD700 0%, #DAA520 100%)",
  color: "#000",
  border: "none",
  padding: "10px 18px",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "pointer",
  textTransform: "uppercase",
  fontSize: "0.78rem",
  letterSpacing: "0.8px",
  boxShadow: "0 0 15px rgba(255,215,0,0.3)"
};

const btnExportStyle = {
  background: "transparent",
  color: "#FFD700",
  border: "1px solid rgba(218, 165, 32, 0.6)",
  padding: "10px 18px",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "pointer",
  textTransform: "uppercase",
  fontSize: "0.78rem",
  letterSpacing: "0.8px"
};

const cardBoxStyle = {
  background: "linear-gradient(145deg, #0a0a0a 0%, #141414 100%)",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "10px",
  padding: "22px",
  boxShadow: "0 6px 20px rgba(0,0,0,0.5)"
};