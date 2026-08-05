import React, { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Sugerencia {
  codigo: string;
  nombre: string;
  confianza: number;
  origen: "regla" | "ia" | "fallback";
}

interface CuentaCatalogo {
  codigo: string;
  nombre: string;
  tipo: string;
}

export default function RegistrarGastoModal({ isOpen, onClose }: Props) {
  const [cargando, setCargando] = useState(false);
  const [categoria, setCategoria] = useState("Proveedor / Fábrica");
  const [tercero, setTercero] = useState("");
  const [monto, setMonto] = useState("");
  const [bancoOrigen, setBancoOrigen] = useState("General");
  const [referenciaBancaria, setReferenciaBancaria] = useState("");
  const [concepto, setConcepto] = useState("");
  const [resultado, setResultado] = useState<any>(null);

  // ── Sugerencia de cuenta contable ──
  const [catalogo, setCatalogo] = useState<CuentaCatalogo[]>([]);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [cuentaConfirmada, setCuentaConfirmada] = useState<string>(""); // código elegido/confirmado
  const [buscandoCuenta, setBuscandoCuenta] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin/listar-cuentas")
      .then((r) => r.json())
      .then((d) => setCatalogo((d.cuentas || []).filter((c: CuentaCatalogo) => c.tipo === "GASTO")))
      .catch((e) => console.error("Error cargando plan de cuentas:", e));
  }, [isOpen]);

  if (!isOpen) return null;

  const solicitarSugerencia = async () => {
    if (!tercero && !concepto) {
      alert("Escribí al menos el Beneficiario o el Concepto para poder sugerir una cuenta.");
      return;
    }
    setBuscandoCuenta(true);
    setSugerencia(null);
    try {
      const r = await fetch("/api/admin/sugerir-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria, tercero, concepto }),
      });
      const d = await r.json();
      if (r.ok && d.sugerencia) {
        setSugerencia(d.sugerencia);
        setCuentaConfirmada(d.sugerencia.codigo);
      }
    } catch (e) {
      console.error("Error obteniendo sugerencia de cuenta:", e);
    } finally {
      setBuscandoCuenta(false);
    }
  };

  const crearCuentaNueva = async () => {
    const nombre = prompt("Nombre de la nueva cuenta contable (ej: Certificaciones y Licencias)");
    if (!nombre || !nombre.trim()) return;
    try {
      const r = await fetch("/api/admin/crear-cuenta-contable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, tipo: "GASTO" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCatalogo((prev) => [...prev, d.cuenta]);
      setCuentaConfirmada(d.cuenta.codigo);
      setSugerencia({ codigo: d.cuenta.codigo, nombre: d.cuenta.nombre, confianza: 1, origen: "regla" });
    } catch (e: any) {
      alert(`No se pudo crear la cuenta: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tercero || !monto || !bancoOrigen) {
      alert("Por favor complete los campos obligatorios: Beneficiario, monto y banco de origen.");
      return;
    }
    if (!cuentaConfirmada) {
      alert("Antes de registrar, pedí la sugerencia de cuenta contable y confirmala (o elegí una del catálogo).");
      return;
    }

    const cuentaElegida = catalogo.find((c) => c.codigo === cuentaConfirmada);

    setCargando(true);
    setResultado(null);

    try {
      const response = await fetch("/api/admin/registrar-gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "EGRESO",
          categoria,
          tercero,
          monto: parseFloat(monto),
          bancoOrigen,
          referenciaBancaria,
          concepto,
          fecha: new Date().toISOString(),
          cuentaCodigo: cuentaConfirmada,
          cuentaNombre: cuentaElegida?.nombre || sugerencia?.nombre || "Otros Gastos Operativos",
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar el egreso en el servidor.");
      }

      setResultado(data.resumen || {
        estatus: "EXITOSO",
        monto: parseFloat(monto),
        beneficiario: tercero,
        referencia: referenciaBancaria || "N/A",
        cuentaCodigo: cuentaConfirmada,
        cuentaNombre: cuentaElegida?.nombre,
      });

      alert("¡Gasto/Egreso registrado correctamente en tesorería!");

      // Limpiar formulario
      setTercero("");
      setMonto("");
      setReferenciaBancaria("");
      setConcepto("");
      setSugerencia(null);
      setCuentaConfirmada("");

    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(5px)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "#0a0a0a",
        border: "1px solid rgba(218, 165, 32, 0.6)",
        borderRadius: "14px",
        width: "100%",
        maxWidth: "900px",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: "30px",
        boxShadow: "0 0 35px rgba(218, 165, 32, 0.25)"
      }}>
        {/* Encabezado del Modal con botón Cerrar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "15px" }}>
          <div>
            <h2 style={{ fontSize: "1.3rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
              REGISTRO DE GASTOS Y SALIDAS DE TESORERÍA
            </h2>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>Captura de pagos a proveedores, operaciones, nómina y servicios</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "50%", width: "35px", height: "35px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" }}>
          {/* Formulario de Salida */}
          <div style={cardBoxStyle}>
            <h3 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Detalles del Egreso / Pago
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Categoría del Gasto</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
                  <option value="Proveedor / Fábrica" style={{ background: "#111", color: "#FFD700" }}>Proveedor / Fábrica (ej. NH Link)</option>
                  <option value="Despacho / Flete EXW" style={{ background: "#111", color: "#FFD700" }}>Despacho, Adunas & Logística</option>
                  <option value="Servicios Operativos / SaaS" style={{ background: "#111", color: "#FFD700" }}>Servicios IT (Vercel, Supabase, Brevo)</option>
                  <option value="Nómina / Honorarios" style={{ background: "#111", color: "#FFD700" }}>Nómina & Honorarios Profesionales</option>
                  <option value="Comisiones & Bonos" style={{ background: "#111", color: "#FFD700" }}>Comisiones de Ventas / Bonos</option>
                  <option value="Marketing / Publicidad" style={{ background: "#111", color: "#FFD700" }}>Marketing & Campañas</option>
                  <option value="Otros Gastos" style={{ background: "#111", color: "#FFD700" }}>Otros Gastos Operativos</option>
                </select>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Beneficiario / Proveedor (Tercero)</label>
                <input type="text" placeholder="Ej. NH Link / Vercel Inc. / Félix Wing" value={tercero} onChange={(e) => setTercero(e.target.value)} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Monto a Pagar ($ USD)</label>
                <input type="number" step="0.01" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Banco de Salida (Cuenta Pagadora)</label>
                <select value={bancoOrigen} onChange={(e) => setBancoOrigen(e.target.value)} style={inputStyle}>
                  <option value="Wise" style={{ background: "#111", color: "#FFD700" }}>Wise Business (EE.UU.)</option>
                  <option value="General" style={{ background: "#111", color: "#FFD700" }}>Banco General (Panamá)</option>
                  <option value="Global Bank" style={{ background: "#111", color: "#FFD700" }}>Global Bank</option>
                  <option value="Banistmo" style={{ background: "#111", color: "#FFD700" }}>Banistmo</option>
                  <option value="BICSA" style={{ background: "#111", color: "#FFD700" }}>BICSA</option>
                  <option value="Tarjeta Corporativa" style={{ background: "#111", color: "#FFD700" }}>Tarjeta Corporativa</option>
                </select>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Nº de Comprobante / Referencia Bancaria</label>
                <input type="text" placeholder="Ej. ACH-40912 / TX-881293" value={referenciaBancaria} onChange={(e) => setReferenciaBancaria(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Concepto / Descripción</label>
                <input type="text" placeholder="Ej. Pago parcial factura NH Link cables de fibra" value={concepto} onChange={(e) => setConcepto(e.target.value)} style={inputStyle} />
              </div>

              {/* ── Bloque de Cuenta Contable: sugerencia + confirmación ── */}
              <div style={{ marginBottom: "20px", background: "#0d0d0d", border: "1px dashed rgba(218, 165, 32, 0.5)", borderRadius: "8px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Cuenta Contable</label>
                  <button
                    type="button"
                    onClick={solicitarSugerencia}
                    disabled={buscandoCuenta}
                    style={{ background: "none", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "5px", padding: "5px 10px", fontSize: "0.72rem", fontWeight: "bold", cursor: "pointer" }}
                  >
                    {buscandoCuenta ? "Analizando..." : "🔍 Sugerir Cuenta"}
                  </button>
                </div>

                {sugerencia && (
                  <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: "8px" }}>
                    Sugerencia ({sugerencia.origen === "regla" ? "por regla" : sugerencia.origen === "ia" ? "por IA" : "sin coincidencia clara"}
                    {sugerencia.origen !== "fallback" ? `, ${(sugerencia.confianza * 100).toFixed(0)}% confianza` : ""}):
                    {" "}
                    <strong style={{ color: "#FFD700" }}>{sugerencia.codigo} - {sugerencia.nombre}</strong>
                  </div>
                )}

                <select
                  value={cuentaConfirmada}
                  onChange={(e) => setCuentaConfirmada(e.target.value)}
                  style={inputStyle}
                >
                  <option value="" style={{ background: "#111", color: "#FFD700" }}>— Elegir cuenta contable —</option>
                  {catalogo.map((c) => (
                    <option key={c.codigo} value={c.codigo} style={{ background: "#111", color: "#FFD700" }}>
                      {c.codigo} - {c.nombre}
                    </option>
                  ))}
                </select>

                {sugerencia?.origen === "fallback" && (
                  <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#e67e22" }}>
                    No encontramos una cuenta específica para este gasto.{" "}
                    <button
                      type="button"
                      onClick={crearCuentaNueva}
                      style={{ background: "none", border: "none", color: "#DAA520", textDecoration: "underline", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                    >
                      Crear cuenta nueva
                    </button>
                    {" "}en vez de usar "Otros Gastos Operativos".
                  </div>
                )}
              </div>

              <button type="submit" disabled={cargando} style={btnDanger}>
                {cargando ? "Procesando Registro..." : "💸 Registrar Egreso y Descontar Liquidez"}
              </button>
            </form>
          </div>

          {/* Resumen / Confirmación */}
          <div style={cardBoxStyle}>
            <h3 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Estado del Saldo Operativo
            </h3>

            {!resultado ? (
              <div style={{ color: "#777", textAlign: "center", padding: "40px 15px", fontSize: "0.85rem" }}>
                <p>Al procesar un egreso, el sistema restará el saldo de la cuenta pagadora, afectará el P&L mensual y dejará traza contable en Tesorería.</p>
              </div>
            ) : (
              <div style={{ background: "#0a0a0a", border: "1px solid rgba(231, 76, 60, 0.4)", borderRadius: "8px", padding: "18px", fontSize: "0.85rem" }}>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                  <span style={{ color: "#aaa" }}>Estado:</span>
                  <div style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "1rem" }}>{resultado.estatus}</div>
                </div>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                  <span style={{ color: "#aaa" }}>Beneficiario:</span>
                  <div style={{ color: "#fff", fontWeight: "bold" }}>{resultado.beneficiario}</div>
                </div>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                  <span style={{ color: "#aaa" }}>Monto Descontado:</span>
                  <div style={{ color: "#f87171", fontWeight: "bold", fontSize: "1.1rem" }}>-${resultado.monto} USD</div>
                </div>
                {resultado.cuentaCodigo && (
                  <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                    <span style={{ color: "#aaa" }}>Cuenta Contable:</span>
                    <div style={{ color: "#29B6F6", fontWeight: "bold" }}>{resultado.cuentaCodigo} - {resultado.cuentaNombre}</div>
                  </div>
                )}
                <div>
                  <span style={{ color: "#aaa" }}>Referencia:</span>
                  <div style={{ color: "#FFD700", fontWeight: "bold" }}>{resultado.referencia}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: "0.72rem",
  color: "#aaa",
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
  marginBottom: "4px",
  fontWeight: "bold"
};

const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "6px",
  padding: "9px 12px",
  color: "#FFD700",
  outline: "none",
  fontSize: "0.85rem",
  fontWeight: "600",
  boxSizing: "border-box" as const
};

const cardBoxStyle = {
  background: "linear-gradient(145deg, #0a0a0a 0%, #141414 100%)",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
};

const btnDanger = {
  width: "100%",
  backgroundColor: "#1a0000",
  color: "#e74c3c",
  border: "1px solid #e74c3c",
  borderRadius: "6px",
  padding: "12px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.85rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  boxShadow: "0 0 12px rgba(231, 76, 60, 0.2)"
};