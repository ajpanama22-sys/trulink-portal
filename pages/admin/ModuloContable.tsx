import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Interfaces para tipado
interface Transaccion {
  id?: string;
  created_at?: string;
  tipo: "INGRESO" | "GASTO" | "NOTA_CREDITO" | "NOTA_DEBITO";
  categoria: string;
  monto: number;
  moneda: string;
  metodo_pago: string;
  referencia_transaccion: string;
  relacion_quote_id?: number | null;
  proveedor_cliente: string;
  descripcion: string;
}

interface Colaborador {
  id?: string;
  nombre_completo: string;
  identificacion: string;
  esquema_pago: "PANAMA_LEY" | "TRULINK_LLC_OFFSHORE";
  cargo: string;
  salario_base: number;
  frecuencia: string;
  cuenta_banco_destino: string;
}

interface QuoteOption {
  id: number;
  cliente: string;
  total: number;
  id_cotizacion?: string;
}

export default function ModuloContable() {
  const [pestanaActiva, setPestanaActiva] = useState<
    "resumen" | "cxc" | "cxp" | "gastos" | "planilla"
  >("resumen");

  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [quotesList, setQuotesList] = useState<QuoteOption[]>([]);
  const [cargando, setCargando] = useState(false);

  // Estados de Modales
  const [modalTransaccionOpen, setModalTransaccionOpen] = useState(false);
  const [tipoTransaccionForm, setTipoTransaccionForm] = useState<
    "INGRESO" | "GASTO" | "NOTA_CREDITO" | "NOTA_DEBITO"
  >("INGRESO");

  const [modalColaboradorOpen, setModalColaboradorOpen] = useState(false);
  const [modalPagoPlanillaOpen, setModalPagoPlanillaOpen] = useState(false);
  const [colaboradorA-Pagar, setColaboradorAPagar] = useState<Colaborador | null>(null);
  // Formulario Transacciones
  const [formMonto, setFormMonto] = useState("");
  const [formCategoria, setFormCategoria] = useState("PAGO_CLIENTE");
  const [formMetodo, setFormMetodo] = useState("TRANSFERENCIA_WISE");
  const [formRef, setFormRef] = useState("");
  const [formTercero, setFormTercero] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formQuoteId, setFormQuoteId] = useState<number | null>(null);

  // Formulario Colaborador
  const [colabNombre, setColabNombre] = useState("");
  const [colabId, setColabId] = useState("");
  const [colabEsquema, setColabEsquema] = useState<"PANAMA_LEY" | "TRULINK_LLC_OFFSHORE">("PANAMA_LEY");
  const [colabCargo, setColabCargo] = useState("");
  const [colabSalario, setColabSalario] = useState("");
  const [colabCuenta, setColabCuenta] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    if (!supabase) return;

    try {
      // Cargar Transacciones
      const { data: transData } = await supabase
        .from("transacciones_contables")
        .select("*")
        .order("created_at", { ascending: false });
      if (transData) setTransacciones(transData);

      // Cargar Colaboradores
      const { data: colabData } = await supabase
        .from("planilla_colaboradores")
        .select("*");
      if (colabData) setColaboradores(colabData);

      // Cargar Cotizaciones para vincular CxC
      const { data: qData } = await supabase.from("quotes").select("id, cliente, total, id_cotizacion");
      if (qData) {
        setQuotesList(
          qData.map((q) => ({
            id: q.id,
            cliente: q.cliente || "Cliente Sin Nombre",
            total: q.total || 0,
            id_cotizacion: q.id_cotizacion || `COT-${q.id}`
          }))
        );
      }
    } catch (err) {
      console.error("Error cargando datos contables:", err);
    } finally {
      setCargando(false);
    }
  };

  // Guardar Transacción (Ingreso, Gasto, Nota Crédito/Débito)
  const handleGuardarTransaccion = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(formMonto);
    if (isNaN(montoNum) || montoNum <= 0) {
      alert("Por favor ingresa un monto válido.");
      return;
    }

    const nuevaTrans: Transaccion = {
      tipo: tipoTransaccionForm,
      categoria: formCategoria,
      monto: montoNum,
      moneda: "USD",
      metodo_pago: formMetodo,
      referencia_transaccion: formRef,
      relacion_quote_id: formQuoteId,
      proveedor_cliente: formTercero,
      descripcion: formDesc
    };

    if (supabase) {
      try {
        const { error } = await supabase.from("transacciones_contables").insert([nuevaTrans]);
        if (error) throw error;
        alert("Transacción registrada exitosamente.");
        setModalTransaccionOpen(false);
        resetFormTransaccion();
        cargarDatos();
      } catch (err: any) {
        alert("Guardado localmente (tabla en sincronización).");
        setTransacciones([nuevaTrans, ...transacciones]);
        setModalTransaccionOpen(false);
      }
    }
  };

  // Guardar Nuevo Colaborador
  const handleGuardarColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    const salNum = parseFloat(colabSalario);
    if (isNaN(salNum) || salNum <= 0) {
      alert("Ingresa un salario base válido.");
      return;
    }

    const nuevoColab: Colaborador = {
      nombre_completo: colabNombre,
      identificacion: colabId,
      esquema_pago: colabEsquema,
      cargo: colabCargo,
      salario_base: salNum,
      frecuencia: "QUINCENAL",
      cuenta_banco_destino: colabCuenta
    };

    if (supabase) {
      try {
        const { error } = await supabase.from("planilla_colaboradores").insert([nuevoColab]);
        if (error) throw error;
        alert("Colaborador registrado en planilla.");
        setModalColaboradorOpen(false);
        cargarDatos();
      } catch (err) {
        setColaboradores([...colaboradores, nuevoColab]);
        setModalColaboradorOpen(false);
      }
    }
  };

  // Procesar Pago de Planilla
  const handleProcesarPagoPlanilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorAPagar) return;

    const calculos = calcularPlanilla(colaboradorAPagar);

    const registroPago = {
      colaborador_id: colaboradorAPagar.id,
      fecha_pago: new Date().toISOString().split("T")[0],
      monto_bruto: calculos.bruto,
      descuento_ss: calculos.ss,
      descuento_se: calculos.se,
      descuento_isr: 0,
      monto_neto: calculos.neto,
      esquema_aplicado: colaboradorAPagar.esquema_pago
    };

    // Registrar también el egreso en transacciones
    const transEgreso: Transaccion = {
      tipo: "GASTO",
      categoria: "PLANILLA",
      monto: calculos.neto,
      moneda: "USD",
      metodo_pago: "TRANSFERENCIA_WISE",
      referencia_transaccion: `PAY-NOMINA-${Date.now().toString().slice(-4)}`,
      proveedor_cliente: colaboradorAPagar.nombre_completo,
      descripcion: `Pago de nómina (${colaboradorAPagar.esquema_pago}) - Salario Neto`
    };

    if (supabase) {
      try {
        await supabase.from("pagos_planilla").insert([registroPago]);
        await supabase.from("transacciones_contables").insert([transEgreso]);
        alert(`Pago de nómina procesado correctamente por $${calculos.neto.toFixed(2)} USD.`);
        setModalPagoPlanillaOpen(false);
        cargarDatos();
      } catch (err) {
        alert("Pago registrado localmente.");
        setTransacciones([transEgreso, ...transacciones]);
        setModalPagoPlanillaOpen(false);
      }
    }
  };

  const resetFormTransaccion = () => {
    setFormMonto("");
    setFormRef("");
    setFormTercero("");
    setFormDesc("");
    setFormQuoteId(null);
  };

  // Cálculo de Deducciones según Leyes de Panamá vs Trulink LLC
  const calcularPlanilla = (colab: Colaborador) => {
    const bruto = colab.salario_base / 2; // Pago Quincenal
    if (colab.esquema_pago === "PANAMA_LEY") {
      const ss = bruto * 0.0975; // 9.75% Seguro Social
      const se = bruto * 0.0125; // 1.25% Seguro Educativo
      const neto = bruto - ss - se;
      const patronalSS = bruto * 0.1225; // 12.25% Patronal
      const patronalSE = bruto * 0.0150; // 1.50% Patronal
      return { bruto, ss, se, neto, patronalSS, patronalSE };
    } else {
      // TRULINK_LLC_OFFSHORE (Independent Contractor - 0% retenciones de ley PA/IRS)
      return { bruto, ss: 0, se: 0, neto: bruto, patronalSS: 0, patronalSE: 0 };
    }
  };

  // Cálculos Dashboard P&L
  const totalIngresos = transacciones
    .filter((t) => t.tipo === "INGRESO" || t.tipo === "NOTA_DEBITO")
    .reduce((acc, curr) => acc + Number(curr.monto), 0);

  const totalGastos = transacciones
    .filter((t) => t.tipo === "GASTO" || t.tipo === "NOTA_CREDITO")
    .reduce((acc, curr) => acc + Number(curr.monto), 0);

  const utilidadNeta = totalIngresos - totalGastos;

  return (
    <div style={cardBox}>
      {/* HEADER Y NAVEGACIÓN B.I.K.U. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ color: "#DAA520", fontSize: "1.2rem", textTransform: "uppercase", letterSpacing: "1px" }}>
            SISTEMA CONTABLE B.I.K.U. v1.0
          </h2>
          <p style={{ color: "#aaa", fontSize: "0.8rem" }}>
            Control Financiero, Tesorería, Cuentas CxC / CxP, Notas de Crédito/Débito y Nómina Internacional.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setTipoTransaccionForm("INGRESO");
              setFormCategoria("PAGO_CLIENTE");
              setModalTransaccionOpen(true);
            }}
            style={btnAccion}
          >
            + REGISTRAR INGRESO / COBRO
          </button>
          <button
            onClick={() => {
              setTipoTransaccionForm("GASTO");
              setFormCategoria("PROVEEDOR");
              setModalTransaccionOpen(true);
            }}
            style={btnSecundario}
          >
            - REGISTRAR GASTO / PAGO
          </button>
        </div>
      </div>

      {/* PESTAÑAS SUB-MÓDULOS */}
      <div style={{ display: "flex", gap: "5px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => setPestanaActiva("resumen")} style={tabStyle(pestanaActiva === "resumen")}>
          📊 Resumen & Tesorería
        </button>
        <button onClick={() => setPestanaActiva("cxc")} style={tabStyle(pestanaActiva === "cxc")}>
          💵 Cuentas por Cobrar (CxC)
        </button>
        <button onClick={() => setPestanaActiva("cxp")} style={tabStyle(pestanaActiva === "cxp")}>
          🏷️ Cuentas por Pagar (CxP)
        </button>
        <button onClick={() => setPestanaActiva("gastos")} style={tabStyle(pestanaActiva === "gastos")}>
          ⚡ Gastos & Servicios
        </button>
        <button onClick={() => setPestanaActiva("planilla")} style={tabStyle(pestanaActiva === "planilla")}>
          👥 Planilla & Nómina
        </button>
      </div>

      {/* VISTA 1: RESUMEN & TESORERÍA (P&L EXPRESS) */}
      {pestanaActiva === "resumen" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
            <div style={kpiBox}>
              <span style={kpiTitle}>TOTAL INGRESOS</span>
              <p style={{ ...kpiValue, color: "#2ecc71" }}>${totalIngresos.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</p>
              <span style={kpiSub}>Facturación y NDs</span>
            </div>
            <div style={kpiBox}>
              <span style={kpiTitle}>TOTAL EGRESOS / GASTOS</span>
              <p style={{ ...kpiValue, color: "#e74c3c" }}>${totalGastos.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</p>
              <span style={kpiSub}>Proveedores, Operación y NCs</span>
            </div>
            <div style={kpiBox}>
              <span style={kpiTitle}>UTILIDAD NETA OPERATIVA</span>
              <p style={{ ...kpiValue, color: utilidadNeta >= 0 ? "#DAA520" : "#e74c3c" }}>
                ${utilidadNeta.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
              </p>
              <span style={kpiSub}>Balance P&L Real</span>
            </div>
            <div style={kpiBox}>
              <span style={kpiTitle}>CUENTAS BANCARIAS</span>
              <p style={{ ...kpiValue, color: "#3498db" }}>Wise / ACH Local</p>
              <span style={kpiSub}>Cuentas Activas EE.UU. / PA</span>
            </div>
          </div>

          <h3 style={sectionTitle}>Últimos Movimientos de Tesorería</h3>
          <table style={tableStyle}>
            <thead>
              <tr style={trHeadStyle}>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Categoría</th>
                <th style={thStyle}>Tercero / Cliente</th>
                <th style={thStyle}>Método / Ref.</th>
                <th style={thStyle}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {transacciones.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#888" }}>
                    No hay registros contables en sistema. Utiliza los botones superiores para registrar ingresos o egresos.
                  </td>
                </tr>
              ) : (
                transacciones.slice(0, 10).map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                    <td style={tdStyle}>{t.created_at ? t.created_at.split("T")[0] : "Hoy"}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(t.tipo)}>{t.tipo}</span>
                    </td>
                    <td style={tdStyle}>{t.categoria}</td>
                    <td style={tdStyle}>{t.proveedor_cliente || "N/A"}</td>
                    <td style={tdStyle}>{t.metodo_pago} {t.referencia_transaccion ? `(${t.referencia_transaccion})` : ""}</td>
                    <td style={{ ...tdStyle, fontWeight: "bold", color: t.tipo === "INGRESO" || t.tipo === "NOTA_DEBITO" ? "#2ecc71" : "#e74c3c" }}>
                      {t.tipo === "INGRESO" || t.tipo === "NOTA_DEBITO" ? "+" : "-"}${Number(t.monto).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 2: CUENTAS POR COBRAR (CxC) & NOTAS CRÉDITO / DÉBITO */}
      {pestanaActiva === "cxc" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={sectionTitle}>Control de Cobros a Clientes</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setTipoTransaccionForm("NOTA_CREDITO");
                  setFormCategoria("NOTA_CREDITO");
                  setModalTransaccionOpen(true);
                }}
                style={btnSecundario}
              >
                + Nota de Crédito (Descuento)
              </button>
              <button
                onClick={() => {
                  setTipoTransaccionForm("NOTA_DEBITO");
                  setFormCategoria("NOTA_DEBITO");
                  setModalTransaccionOpen(true);
                }}
                style={btnSecundario}
              >
                + Nota de Débito (Recargo)
              </button>
            </div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr style={trHeadStyle}>
                <th style={thStyle}>Cotización / Factura</th>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Monto Total</th>
                <th style={thStyle}>Pagado / Transferido</th>
                <th style={thStyle}>Monto Neto Exigible</th>
                <th style={thStyle}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {quotesList.map((q) => {
                const pagosQuote = transacciones
                  .filter((t) => t.relacion_quote_id === q.id && t.tipo === "INGRESO")
                  .reduce((acc, curr) => acc + Number(curr.monto), 0);

                const notasDebito = transacciones
                  .filter((t) => t.relacion_quote_id === q.id && t.tipo === "NOTA_DEBITO")
                  .reduce((acc, curr) => acc + Number(curr.monto), 0);

                const notasCredito = transacciones
                  .filter((t) => t.relacion_quote_id === q.id && t.tipo === "NOTA_CREDITO")
                  .reduce((acc, curr) => acc + Number(curr.monto), 0);

                // Fórmula: Monto Neto Exigible = Total Factura + ND - NC - Pagos
                const montoNetoExigible = q.total + notasDebito - notasCredito - pagosQuote;

                return (
                  <tr key={q.id} style={{ borderBottom: "1px solid #111" }}>
                    <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "bold" }}>{q.id_cotizacion}</td>
                    <td style={tdStyle}>{q.cliente}</td>
                    <td style={tdStyle}>${q.total.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: "#2ecc71" }}>${pagosQuote.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: montoNetoExigible > 0 ? "#e74c3c" : "#2ecc71", fontWeight: "bold" }}>
                      ${montoNetoExigible.toFixed(2)}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => {
                          setFormQuoteId(q.id);
                          setFormTercero(q.cliente);
                          setFormMonto(montoNetoExigible > 0 ? montoNetoExigible.toString() : "0");
                          setTipoTransaccionForm("INGRESO");
                          setFormCategoria("PAGO_CLIENTE");
                          setModalTransaccionOpen(true);
                        }}
                        style={btnAccionSmall}
                      >
                        Aplicar Pago
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 3: CUENTAS POR PAGAR (CxP) & PROVEEDORES */}
      {pestanaActiva === "cxp" && (
        <div>
          <h3 style={sectionTitle}>Cuentas por Pagar a Proveedores y Fábricas</h3>
          <table style={tableStyle}>
            <thead>
              <tr style={trHeadStyle}>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Proveedor / Fábrica</th>
                <th style={thStyle}>Descripción</th>
                <th style={thStyle}>Método</th>
                <th style={thStyle}>Monto Pagado</th>
              </tr>
            </thead>
            <tbody>
              {transacciones
                .filter((t) => t.categoria === "PROVEEDOR" || t.tipo === "GASTO")
                .map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                    <td style={tdStyle}>{t.created_at ? t.created_at.split("T")[0] : "Hoy"}</td>
                    <td style={{ ...tdStyle, color: "#DAA520" }}>{t.proveedor_cliente}</td>
                    <td style={tdStyle}>{t.descripcion}</td>
                    <td style={tdStyle}>{t.metodo_pago}</td>
                    <td style={{ ...tdStyle, color: "#e74c3c", fontWeight: "bold" }}>${Number(t.monto).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 4: GASTOS ADMINISTRATIVOS Y SERVICIOS */}
      {pestanaActiva === "gastos" && (
        <div>
          <h3 style={sectionTitle}>Gastos Operativos (Luz, Internet, Telefonía, Software)</h3>
          <table style={tableStyle}>
            <thead>
              <tr style={trHeadStyle}>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Servicio / Concepto</th>
                <th style={thStyle}>Proveedor</th>
                <th style={thStyle}>Referencia / Factura</th>
                <th style={thStyle}>Monto Total</th>
              </tr>
            </thead>
            <tbody>
              {transacciones
                .filter((t) => t.categoria === "SERVICIOS_PUBLICOS" || t.categoria === "COMISION_PASARELA")
                .map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                    <td style={tdStyle}>{t.created_at ? t.created_at.split("T")[0] : "Hoy"}</td>
                    <td style={tdStyle}>{t.categoria}</td>
                    <td style={tdStyle}>{t.proveedor_cliente}</td>
                    <td style={tdStyle}>{t.referencia_transaccion || "S/N"}</td>
                    <td style={{ ...tdStyle, color: "#e74c3c", fontWeight: "bold" }}>${Number(t.monto).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 5: PLANILLA Y NÓMINA (PANAMÁ LEY VS TRULINK LLC) */}
      {pestanaActiva === "planilla" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={sectionTitle}>Planilla de Colaboradores y Servicios Profesionales</h3>
            <button onClick={() => setModalColaboradorOpen(true)} style={btnAccion}>
              + REGISTRAR COLABORADOR
            </button>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr style={trHeadStyle}>
                <th style={thStyle}>Nombre Colaborador</th>
                <th style={thStyle}>Cédula / Pasaporte</th>
                <th style={thStyle}>Esquema Contratación</th>
                <th style={thStyle}>Salario Base</th>
                <th style={thStyle}>Deducciones Quincenales</th>
                <th style={thStyle}>Pago Neto Quincenal</th>
                <th style={thStyle}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#888" }}>
                    No hay colaboradores registrados. Haz clic en "+ Registrar Colaborador".
                  </td>
                </tr>
              ) : (
                colaboradores.map((c, i) => {
                  const calc = calcularPlanilla(c);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ ...tdStyle, fontWeight: "bold", color: "#DAA520" }}>{c.nombre_completo}</td>
                      <td style={tdStyle}>{c.identificacion}</td>
                      <td style={tdStyle}>
                        <span style={c.esquema_pago === "PANAMA_LEY" ? badgePA : badgeLLC}>
                          {c.esquema_pago === "PANAMA_LEY" ? "🇵🇦 Leyes Panamá" : "🇺🇸 Trulink LLC (Offshore)"}
                        </span>
                      </td>
                      <td style={tdStyle}>${c.salario_base.toFixed(2)} / mes</td>
                      <td style={{ ...tdStyle, color: "#e74c3c", fontSize: "0.75rem" }}>
                        {c.esquema_pago === "PANAMA_LEY"
                          ? `SS (9.75%): $${calc.ss.toFixed(2)} | SE (1.25%): $${calc.se.toFixed(2)}`
                          : "0.00% (Contrato Servicios / W-8BEN)"}
                      </td>
                      <td style={{ ...tdStyle, color: "#2ecc71", fontWeight: "bold" }}>${calc.neto.toFixed(2)}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => {
                            setColaboradorAPagar(c);
                            setModalPagoPlanillaOpen(true);
                          }}
                          style={btnAccionSmall}
                        >
                          Procesar Pago
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL PARA NUEVA TRANSACCIÓN CONTABLE */}
      {modalTransaccionOpen && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px", textTransform: "uppercase" }}>
              Registrar {tipoTransaccionForm.replace("_", " ")}
            </h3>
            <form onSubmit={handleGuardarTransaccion}>
              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Categoría</label>
                <select value={formCategoria} onChange={(e) => setFormCategoria(e.target.value)} style={inputStyleFull}>
                  <option value="PAGO_CLIENTE">Cobro a Cliente / Factura</option>
                  <option value="PROVEEDOR">Pago a Proveedor / Fábrica</option>
                  <option value="SERVICIOS_PUBLICOS">Servicios (Luz, Telefonía, Internet)</option>
                  <option value="COMISION_PASARELA">Comisión Pasarela (Stripe/PayPal/Wise)</option>
                  <option value="NOTA_CREDITO">Nota de Crédito (Descuento/Abono)</option>
                  <option value="NOTA_DEBITO">Nota de Débito (Recargo/Comisión)</option>
                </select>
              </div>

              {quotesList.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <label style={labelStyle}>Vincular a Cotización / Factura (Opcional)</label>
                  <select
                    value={formQuoteId || ""}
                    onChange={(e) => setFormQuoteId(e.target.value ? Number(e.target.value) : null)}
                    style={inputStyleFull}
                  >
                    <option value="">-- Sin Vincular --</option>
                    {quotesList.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.id_cotizacion} - {q.cliente} (${q.total})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Cliente / Proveedor / Tercero</label>
                <input
                  type="text"
                  placeholder="Ej. Cable Onda, Wise, IGTEL"
                  value={formTercero}
                  onChange={(e) => setFormTercero(e.target.value)}
                  style={inputStyleFull}
                  required
                />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Monto (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  style={inputStyleFull}
                  required
                />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Método de Pago</label>
                <select value={formMetodo} onChange={(e) => setFormMetodo(e.target.value)} style={inputStyleFull}>
                  <option value="TRANSFERENCIA_WISE">Transferencia Wise EE.UU.</option>
                  <option value="BANCO_LOCAL_ACH">Transferencia ACH Banco Local</option>
                  <option value="STRIPE">Stripe Credit Card</option>
                  <option value="PAYPAL">PayPal Business</option>
                  <option value="EFECTIVO">Efectivo / Caja Chica</option>
                </select>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Referencia / # Confirmación ACH</label>
                <input
                  type="text"
                  placeholder="Ej. ACH-98123719"
                  value={formRef}
                  onChange={(e) => setFormRef(e.target.value)}
                  style={inputStyleFull}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Descripción / Notas</label>
                <input
                  type="text"
                  placeholder="Detalle de la transacción contable"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  style={inputStyleFull}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setModalTransaccionOpen(false)} style={btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={btnAccion}>
                  Guardar Transacción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COLABORADOR */}
      {modalColaboradorOpen && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px" }}>Registrar Colaborador</h3>
            <form onSubmit={handleGuardarColaborador}>
              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Nombre Completo</label>
                <input type="text" value={colabNombre} onChange={(e) => setColabNombre(e.target.value)} style={inputStyleFull} required />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Cédula o Pasaporte</label>
                <input type="text" value={colabId} onChange={(e) => setColabId(e.target.value)} style={inputStyleFull} required />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Esquema de Contratación</label>
                <select value={colabEsquema} onChange={(e: any) => setColabEsquema(e.target.value)} style={inputStyleFull}>
                  <option value="PANAMA_LEY">🇵🇦 Leyes de la República de Panamá (Con seguro social/SE)</option>
                  <option value="TRULINK_LLC_OFFSHORE">🇺🇸 Trulink Fiber LLC (Servicios Profesionales Offshore)</option>
                </select>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Cargo / Función</label>
                <input type="text" value={colabCargo} onChange={(e) => setColabCargo(e.target.value)} style={inputStyleFull} required />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={labelStyle}>Salario Base Mensual (USD)</label>
                <input type="number" step="0.01" value={colabSalario} onChange={(e) => setColabSalario(e.target.value)} style={inputStyleFull} required />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Cuenta Bancaria Destino / Email Wise</label>
                <input type="text" value={colabCuenta} onChange={(e) => setColabCuenta(e.target.value)} style={inputStyleFull} required />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setModalColaboradorOpen(false)} style={btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={btnAccion}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROCESAR PAGO PLANILLA */}
      {modalPagoPlanillaOpen && colaboradorAPagar && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "10px" }}>Procesar Pago de Nómina Quincenal</h3>
            <p style={{ color: "#aaa", fontSize: "0.8rem", marginBottom: "15px" }}>
              Colaborador: <b>{colaboradorAPagar.nombre_completo}</b> ({colaboradorAPagar.esquema_pago})
            </p>
            {(() => {
              const calc = calcularPlanilla(colaboradorAPagar);
              return (
                <div style={{ backgroundColor: "#111", padding: "12px", borderRadius: "5px", marginBottom: "15px", border: "1px solid #333", fontSize: "0.85rem" }}>
                  <p style={{ color: "#fff" }}><b>Salario Bruto Quincenal:</b> ${calc.bruto.toFixed(2)} USD</p>
                  <p style={{ color: "#e74c3c" }}><b>Descuento Seguro Social (9.75%):</b> -${calc.ss.toFixed(2)} USD</p>
                  <p style={{ color: "#e74c3c" }}><b>Descuento Seguro Educativo (1.25%):</b> -${calc.se.toFixed(2)} USD</p>
                  <p style={{ color: "#2ecc71", fontSize: "1rem", fontWeight: "bold", marginTop: "8px" }}>
                    <b>NETO A TRANSFERIR:</b> ${calc.neto.toFixed(2)} USD
                  </p>
                </div>
              );
            })()}
            <form onSubmit={handleProcesarPagoPlanilla}>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setModalPagoPlanillaOpen(false)} style={btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={btnAccion}>
                  Confirmar Pago & Generar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos Inline Corporativos B.I.K.U. (Negro & Dorado)
const cardBox: React.CSSProperties = { backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "20px" };
const btnAccion: React.CSSProperties = { backgroundColor: "#DAA520", color: "#000", border: "none", borderRadius: "4px", padding: "8px 16px", fontWeight: "bold", cursor: "pointer", fontSize: "0.75rem" };
const btnSecundario: React.CSSProperties = { backgroundColor: "transparent", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "4px", padding: "8px 16px", cursor: "pointer", fontSize: "0.75rem" };
const btnAccionSmall: React.CSSProperties = { backgroundColor: "#DAA520", color: "#000", border: "none", borderRadius: "3px", padding: "4px 8px", fontSize: "0.7rem", fontWeight: "bold", cursor: "pointer" };

const tabStyle = (activa: boolean): React.CSSProperties => ({
  backgroundColor: activa ? "#DAA520" : "transparent",
  color: activa ? "#000" : "#aaa",
  border: "none",
  borderRadius: "4px 4px 0 0",
  padding: "8px 14px",
  fontWeight: activa ? "bold" : "normal",
  cursor: "pointer",
  fontSize: "0.8rem"
});

const kpiBox: React.CSSProperties = { backgroundColor: "#000", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "6px", padding: "12px" };
const kpiTitle: React.CSSProperties = { fontSize: "0.7rem", color: "#aaa", textTransform: "uppercase" };
const kpiValue: React.CSSProperties = { fontSize: "1.2rem", fontWeight: "bold", margin: "5px 0" };
const kpiSub: React.CSSProperties = { fontSize: "0.65rem", color: "#666" };

const sectionTitle: React.CSSProperties = { color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", margin: "15px 0 10px 0" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" };
const trHeadStyle: React.CSSProperties = { borderBottom: "1px solid rgba(218, 165, 32, 0.4)", backgroundColor: "#000", color: "#DAA520" };
const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "10px", textAlign: "left" };

const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "#DAA520", display: "block", marginBottom: "4px", textTransform: "uppercase" };
const inputStyleFull: React.CSSProperties = { width: "100%", backgroundColor: "#000", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "4px", padding: "8px 12px", color: "#fff", boxSizing: "border-box", fontSize: "0.85rem" };

const modalOverlay: React.CSSProperties = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContent: React.CSSProperties = { backgroundColor: "#0a0a0a", border: "1px solid #DAA520", borderRadius: "8px", padding: "25px", width: "100%", maxWidth: "550px", boxShadow: "0 4px 20px rgba(218, 165, 32, 0.2)" };

const badgeStyle = (tipo: string): React.CSSProperties => ({
  backgroundColor: tipo === "INGRESO" ? "rgba(46, 204, 113, 0.2)" : "rgba(231, 76, 60, 0.2)",
  color: tipo === "INGRESO" ? "#2ecc71" : "#e74c3c",
  padding: "2px 6px",
  borderRadius: "3px",
  fontSize: "0.7rem",
  fontWeight: "bold"
});

const badgePA: React.CSSProperties = { backgroundColor: "rgba(52, 152, 219, 0.2)", color: "#3498db", padding: "2px 6px", borderRadius: "3px", fontSize: "0.7rem" };
const badgeLLC: React.CSSProperties = { backgroundColor: "rgba(218, 165, 32, 0.2)", color: "#DAA520", padding: "2px 6px", borderRadius: "3px", fontSize: "0.7rem" };