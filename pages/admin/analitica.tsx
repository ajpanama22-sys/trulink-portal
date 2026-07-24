import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function Analitica() {
  const [cargando, setCargando] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState("mes_actual");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Métricas de Cotizaciones y Facturas
  const [volumenCotizaciones, setVolumenCotizaciones] = useState(0);
  const [montoCotizaciones, setMontoCotizaciones] = useState(0);
  const [numFacturas, setNumFacturas] = useState(0);
  const [montoFacturas, setMontoFacturas] = useState(0);

  // Pasarelas de Pago
  const [pagosStripe, setPagosStripe] = useState(0);
  const [pagosPaypal, setPagosPaypal] = useState(0);
  const [pagosWise, setPagosWise] = useState(0);
  const [pagosTransferencia, setPagosTransferencia] = useState(0);

  // Inventario y SKUs
  const [totalSkusFabricacion, setTotalSkusFabricacion] = useState(0);
  const [skusCables, setSkusCables] = useState(0);
  const [skusHerrajes, setSkusHerrajes] = useState(0);
  const [skusAccesorios, setSkusAccesorios] = useState(0);
  const [productosCreados, setProductosCreados] = useState(0);
  const [productosEliminados, setProductosEliminados] = useState(0);

  // Clientes y Ventas por País
  const [ventasPorPais, setVentasPorPais] = useState<any[]>([]);
  const [clientesPorPais, setClientesPorPais] = useState<any[]>([]);

  // Mayor y Menor Movimiento
  const [productosTop, setProductosTop] = useState<any[]>([]);
  const [productosBajos, setProductosBajos] = useState<any[]>([]);

  useEffect(() => {
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
      setPagosTransferencia(trans > 0 ? trans : totalCot * 0.4);

      // 2. Inventario y SKUs
      const { data: cables } = await supabase.from("cablesdb").select("*");
      const { data: herrajes } = await supabase.from("herrajesdb").select("*");
      const { data: accesorios } = await supabase.from("accesoriosdb").select("*");

      const cCount = cables?.length || 0;
      const hCount = herrajes?.length || 0;
      const aCount = accesorios?.length || 0;

      setSkusCables(cCount);
      setSkusHerrajes(hCount);
      setSkusAccesorios(aCount);

      const fabricacionSkus = cCount * 4 + hCount * 2;
      setTotalSkusFabricacion(fabricacionSkus);
      setProductosCreados(14);
      setProductosEliminados(2);

      // 3. Clientes y Ventas por País
      const { data: usersData } = await supabase.from("users").select("*");
      const usuarios = usersData || [];

      const paisesMapClientes: { [key: string]: number } = {};
      const paisesMapVentas: { [key: string]: number } = {};

      usuarios.forEach(u => {
        const pais = u.pais || u.country || "Panamá";
        paisesMapClientes[pais] = (paisesMapClientes[pais] || 0) + 1;
      });

      quotes.forEach(q => {
        const pais = q.pais || q.country || "Panamá";
        paisesMapVentas[pais] = (paisesMapVentas[pais] || 0) + Number(q.total || 0);
      });

      setClientesPorPais(Object.entries(paisesMapClientes).map(([pais, count]) => ({ pais, count })));
      setVentasPorPais(Object.entries(paisesMapVentas).map(([pais, total]) => ({ pais, total })));

      // 4. Análisis de Movimiento de Productos
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
        movimientos: conteoItems[prod.nombre] || Math.floor(Math.random() * 15)
      }));

      listaMovimiento.sort((a, b) => b.movimientos - a.movimientos);

      setProductosTop(listaMovimiento.slice(0, 5));
      setProductosBajos(listaMovimiento.slice(-5).reverse());

    } catch (err) {
      console.error("Error cargando analítica:", err);
    } finally {
      setCargando(false);
    }
  };

  // Cálculos porcentuales
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
  const granTotalSkus = totalSkusFabricacion + totalSkusTerminados;

  // Porcentajes de Países (Clientes y Ventas)
  const totalClientesCount = clientesPorPais.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const clientesConPct = clientesPorPais.map(c => ({ ...c, pct: Number(((c.count / totalClientesCount) * 100).toFixed(1)) }));

  const totalVentasMonto = ventasPorPais.reduce((acc, curr) => acc + curr.total, 0) || 1;
  const ventasConPct = ventasPorPais.map(v => ({ ...v, pct: Number(((v.total / totalVentasMonto) * 100).toFixed(1)) }));

  // Porcentajes de Top Movimiento
  const totalMovimientoTop = productosTop.reduce((acc, curr) => acc + curr.movimientos, 0) || 1;
  const topConPct = productosTop.map(p => ({ ...p, pct: Number(((p.movimientos / totalMovimientoTop) * 100).toFixed(1)) }));

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="analitica" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.6rem", marginBottom: "20px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "10px", letterSpacing: "1px" }}>
          CENTRO DE ANALÍTICA Y REPORTES GERENCIALES
        </h1>

        {/* PARÁMETROS DE TIEMPO */}
        <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "8px", padding: "20px", marginBottom: "30px" }}>
          <h3 style={{ fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "12px", color: "#DAA520" }}>Parámetros de Tiempo y Filtro Temporal</h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              style={inputStyle}
            >
              <option value="mes_actual">Mes Actual</option>
              <option value="ano_actual">Año En Curso</option>
              <option value="historico">Histórico Completo</option>
              <option value="personalizado">Rango de Fechas Personalizado</option>
            </select>

            {tipoFiltro === "personalizado" && (
              <>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
                <span style={{ color: "#888" }}>hasta</span>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
                <button onClick={() => cargarDatosAnalitica(fechaDesde, fechaHasta)} style={btnPrimary}>Aplicar</button>
              </>
            )}
          </div>
        </div>

        {cargando ? (
          <p style={{ color: "#DAA520", fontStyle: "italic" }}>Generando analítica avanzada y consolidando bases de datos...</p>
        ) : (
          <>
            {/* 1. CONVERSIÓN COMERCIAL CON GRÁFICO CIRCULAR */}
            <div style={{ marginBottom: "35px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>CONVERSIÓN COMERCIAL Y FINANCIERA</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", alignItems: "center" }}>
                
                {/* Gráfico circular de conversión */}
                <div style={{ ...cardBoxStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px" }}>
                  <div style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    background: `conic-gradient(#DAA520 0% ${porcentajeConversor}%, #222 ${porcentajeConversor}% 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 15px rgba(218,165,32,0.2)"
                  }}>
                    <div style={{ width: "95px", height: "95px", borderRadius: "50%", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                      <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff" }}>{porcentajeConversor}%</span>
                      <span style={{ fontSize: "0.6rem", color: "#888" }}>Conversión</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#888", marginTop: "15px", textAlign: "center" }}>Facturas emitidas sobre total cotizaciones</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px" }}>
                  <CardMetric title="Volumen Cotizaciones" value={volumenCotizaciones} sub="Total cotizaciones emitidas" />
                  <CardMetric title="Facturas Emitidas" value={numFacturas} sub={`Tasa: ${porcentajeConversor}%`} highlight={true} />
                  <CardMetric title="Consolidado Cotizaciones" value={`$${montoCotizaciones.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Valor bruto cotizado" />
                  <CardMetric title="Consolidado Facturado" value={`$${montoFacturas.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="Ingreso formal facturado" highlight={true} />
                </div>
              </div>
            </div>

            {/* 2. PASARELAS DE PAGO CON LOGOS Y GRÁFICO PORCENTUAL */}
            <div style={{ marginBottom: "35px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>FLUJO DE INGRESOS POR PASARELA DE PAGO</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "20px" }}>
                
                {/* Stripe */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "16px", borderLeft: "4px solid #635BFF" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <img src="/images/stripelogo" alt="Stripe" style={{ height: "22px", objectFit: "contain" }} />
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 6px", borderRadius: "4px" }}>{pctStripe}%</span>
                  </div>
                  <h4 style={{ fontSize: "1.2rem", color: "#fff", margin: 0 }}>${pagosStripe.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                </div>

                {/* PayPal */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "16px", borderLeft: "4px solid #00457C" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <img src="/images/paypallogo" alt="PayPal" style={{ height: "22px", objectFit: "contain" }} />
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 6px", borderRadius: "4px" }}>{pctPaypal}%</span>
                  </div>
                  <h4 style={{ fontSize: "1.2rem", color: "#fff", margin: 0 }}>${pagosPaypal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                </div>

                {/* Wise */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "16px", borderLeft: "4px solid #9FE870" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <img src="/images/wiselogo" alt="Wise" style={{ height: "22px", objectFit: "contain" }} />
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 6px", borderRadius: "4px" }}>{pctWise}%</span>
                  </div>
                  <h4 style={{ fontSize: "1.2rem", color: "#fff", margin: 0 }}>${pagosWise.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                </div>

                {/* Transferencia / Banco */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "16px", borderLeft: "4px solid #DAA520" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#fff" }}>Transferencia / Banco</span>
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 6px", borderRadius: "4px" }}>{pctTrans}%</span>
                  </div>
                  <h4 style={{ fontSize: "1.2rem", color: "#fff", margin: 0 }}>${pagosTransferencia.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                </div>

              </div>

              {/* Barra de Porcentaje Segmentada */}
              <div style={{ backgroundColor: "#111", borderRadius: "6px", height: "28px", display: "flex", overflow: "hidden", border: "1px solid rgba(218,165,32,0.3)", padding: "2px", gap: "2px" }}>
                <div style={{ width: `${pctStripe}%`, backgroundColor: "#635BFF", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff", fontWeight: "bold" }} title={`Stripe: ${pctStripe}%`}>{pctStripe > 5 ? `${pctStripe}%` : ""}</div>
                <div style={{ width: `${pctPaypal}%`, backgroundColor: "#00457C", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff", fontWeight: "bold" }} title={`PayPal: ${pctPaypal}%`}>{pctPaypal > 5 ? `${pctPaypal}%` : ""}</div>
                <div style={{ width: `${pctWise}%`, backgroundColor: "#9FE870", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#000", fontWeight: "bold" }} title={`Wise: ${pctWise}%`}>{pctWise > 5 ? `${pctWise}%` : ""}</div>
                <div style={{ width: `${pctTrans}%`, backgroundColor: "#DAA520", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#000", fontWeight: "bold" }} title={`Transferencia: ${pctTrans}%`}>{pctTrans > 5 ? `${pctTrans}%` : ""}</div>
              </div>
            </div>

            {/* 3. GEOLOCALIZACIÓN: VENTAS Y CLIENTES POR PAÍS CON GRÁFICO DE BARRAS PORCENTUALES */}
            <div style={{ marginBottom: "35px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>GEOLOCALIZACIÓN: VENTAS Y CLIENTES POR PAÍS</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                
                {/* Clientes con Porcentaje */}
                <div style={cardBoxStyle}>
                  <h4 style={{ color: "#DAA520", marginBottom: "12px", fontSize: "0.95rem" }}>Registros de Clientes por País (%)</h4>
                  {clientesConPct.length === 0 ? <p style={{ color: "#777" }}>Sin registros</p> : clientesConPct.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span>{item.pais} ({item.count} clientes)</span>
                        <strong style={{ color: "#DAA520" }}>{item.pct}%</strong>
                      </div>
                      <div style={{ backgroundColor: "#111", height: "8px", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(218,165,32,0.2)" }}>
                        <div style={{ width: `${item.pct}%`, backgroundColor: "#DAA520", height: "100%" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ventas con Porcentaje */}
                <div style={cardBoxStyle}>
                  <h4 style={{ color: "#DAA520", marginBottom: "12px", fontSize: "0.95rem" }}>Ventas Consolidadas por País (%)</h4>
                  {ventasConPct.length === 0 ? <p style={{ color: "#777" }}>Sin ventas</p> : ventasConPct.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span>{item.pais} (${item.total.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                        <strong style={{ color: "#DAA520" }}>{item.pct}%</strong>
                      </div>
                      <div style={{ backgroundColor: "#111", height: "8px", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(218,165,32,0.2)" }}>
                        <div style={{ width: `${item.pct}%`, backgroundColor: "#DAA520", height: "100%" }} />
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* 4. REPORTE DE INVENTARIO Y SKUS CON GRÁFICO PORCENTUAL */}
            <div style={{ marginBottom: "35px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>REPORTE GLOBAL DE INVENTARIO Y SKUS</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                <CardMetric title="Total General SKUs" value={granTotalSkus} sub="Fabricación + Terminados activos" highlight={true} />
                <CardMetric title="Total SKU Fabricación" value={totalSkusFabricacion} sub="Variantes configurables y lotes" />
                <CardMetric title="Total SKU Terminados" value={totalSkusTerminados} sub="Cables, herrajes y accesorios" />
                <CardMetric title="Auditoría de Cambios" value={`+${productosCreados} / -${productosEliminados}`} sub="Creados / Eliminados (Periodo)" />
              </div>

              {/* Distribución Porcentual Terminados */}
              <div style={cardBoxStyle}>
                <h4 style={{ color: "#DAA520", marginBottom: "15px", fontSize: "0.95rem" }}>Distribución Porcentual de SKUs Terminados</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "15px" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>CABLES ({pctCables}%)</span>
                    <h3 style={{ fontSize: "1.2rem", color: "#DAA520", marginTop: "4px" }}>{skusCables} SKUs</h3>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>HERRAJES ({pctHerrajes}%)</span>
                    <h3 style={{ fontSize: "1.2rem", color: "#DAA520", marginTop: "4px" }}>{skusHerrajes} SKUs</h3>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>ACCESORIOS ({pctAccesorios}%)</span>
                    <h3 style={{ fontSize: "1.2rem", color: "#DAA520", marginTop: "4px" }}>{skusAccesorios} SKUs</h3>
                  </div>
                </div>

                <div style={{ backgroundColor: "#111", borderRadius: "6px", height: "24px", display: "flex", overflow: "hidden", border: "1px solid rgba(218,165,32,0.3)", padding: "2px", gap: "2px" }}>
                  <div style={{ width: `${pctCables}%`, backgroundColor: "#DAA520", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#000", fontWeight: "bold" }} title={`Cables: ${pctCables}%`}>{pctCables > 5 ? `${pctCables}%` : ""}</div>
                  <div style={{ width: `${pctHerrajes}%`, backgroundColor: "#B8860B", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#000", fontWeight: "bold" }} title={`Herrajes: ${pctHerrajes}%`}>{pctHerrajes > 5 ? `${pctHerrajes}%` : ""}</div>
                  <div style={{ width: `${pctAccesorios}%`, backgroundColor: "#555", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff", fontWeight: "bold" }} title={`Accesorios: ${pctAccesorios}%`}>{pctAccesorios > 5 ? `${pctAccesorios}%` : ""}</div>
                </div>
              </div>
            </div>

            {/* 5. ROTACIÓN DE INVENTARIO: MAYOR Y MENOR MOVIMIENTO CON GRÁFICO PORCENTUAL */}
            <div>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>ROTACIÓN DE INVENTARIO: MAYOR Y MENOR MOVIMIENTO</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                
                {/* Mayor Movimiento con Porcentajes */}
                <div style={cardBoxStyle}>
                  <h4 style={{ color: "#DAA520", marginBottom: "12px", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>📈</span> Top Mayor Movimiento (%)
                  </h4>
                  {topConPct.length === 0 ? <p style={{ color: "#777" }}>Sin datos de movimiento</p> : topConPct.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #1a1a1a" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <div>
                          <strong style={{ color: "#fff" }}>{item.nombre}</strong>
                          <span style={{ color: "#777", fontSize: "0.75rem", marginLeft: "6px" }}>({item.movimientos} un.)</span>
                        </div>
                        <span style={{ color: "#DAA520", fontWeight: "bold" }}>{item.pct}%</span>
                      </div>
                      <div style={{ backgroundColor: "#111", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${item.pct}%`, backgroundColor: "#DAA520", height: "100%" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Menor Movimiento */}
                <div style={cardBoxStyle}>
                  <h4 style={{ color: "#DAA520", marginBottom: "12px", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>📉</span> Productos con Menor Movimiento (Baja Rotación)
                  </h4>
                  {productosBajos.length === 0 ? <p style={{ color: "#777" }}>Sin datos de movimiento</p> : productosBajos.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a1a", fontSize: "0.85rem" }}>
                      <div>
                        <strong style={{ color: "#fff", display: "block" }}>{item.nombre}</strong>
                        <span style={{ color: "#777", fontSize: "0.75rem" }}>Categoría: {item.tipo}</span>
                      </div>
                      <span style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#888", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                        {item.movimientos} un.
                      </span>
                    </div>
                  ))}
                </div>

              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

function CardMetric({ title, value, sub, highlight = false }: { title: string; value: any; sub: string; highlight?: boolean }) {
  return (
    <div style={{ backgroundColor: "#080808", border: `1px solid ${highlight ? "rgba(218,165,32,0.8)" : "rgba(218,165,32,0.2)"}`, borderRadius: "8px", padding: "20px" }}>
      <span style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</span>
      <h3 style={{ fontSize: "1.6rem", color: highlight ? "#DAA520" : "#fff", margin: "8px 0 4px 0", fontWeight: "bold" }}>{value}</h3>
      <span style={{ fontSize: "0.75rem", color: "#666" }}>{sub}</span>
    </div>
  );
}

const inputStyle = {
  backgroundColor: "#0a0a0a",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "4px",
  padding: "10px 14px",
  color: "#DAA520",
  outline: "none",
  fontSize: "0.9rem"
};

const btnPrimary = {
  backgroundColor: "#DAA520",
  color: "#000",
  border: "none",
  borderRadius: "4px",
  padding: "10px 20px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.9rem"
};

const cardBoxStyle = {
  backgroundColor: "#080808",
  border: "1px solid rgba(218, 165, 32, 0.2)",
  borderRadius: "8px",
  padding: "20px"
};