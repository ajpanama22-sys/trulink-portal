import { useState } from "react";
import Sidebar from "../../components/Sidebar";

export default function RegistrarPagoVisual() {
  const [cargando, setCargando] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [montoPagado, setMontoPagado] = useState("");
  const [banco, setBanco] = useState("General");
  const [referenciaBancaria, setReferenciaBancaria] = useState("");
  const [resultado, setResultado] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referencia || !montoPagado || !banco) {
      alert("Por favor complete los campos obligatorios: Referencia de cotización, monto y banco.");
      return;
    }

    setCargando(true);
    setResultado(null);

    try {
      const response = await fetch("/api/admin/registrar-pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referencia,
          montoPagado: parseFloat(montoPagado),
          banco,
          referenciaBancaria
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar el pago en el servidor.");
      }

      setResultado(data.resumen);
      alert(`¡Transacción registrada con éxito! Documento emitido: ${data.resumen.documentoEmitido}`);
      
      // Limpiar formulario opcionalmente
      setReferencia("");
      setMontoPagado("");
      setReferenciaBancaria("");

    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      {/* Sidebar / Menú Operativo (currentActive coincide con la key del Sidebar) */}
      <Sidebar currentActive="registrar-pago" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "15px" }}>
          <h1 style={{ fontSize: "1.8rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1.5px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
            REGISTRO DE TRANSFERENCIAS Y PAGOS B2B
          </h1>
          <span style={{ fontSize: "0.75rem", background: "rgba(218, 165, 32, 0.1)", color: "#FFD700", border: "1px solid rgba(218, 165, 32, 0.4)", padding: "6px 14px", borderRadius: "20px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>
            Módulo Operativo
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "30px" }}>
          {/* Formulario */}
          <div style={cardBoxStyle}>
            <h3 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Datos del Pago Bancario
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Referencia de Cotización / Factura</label>
                <input type="text" placeholder="Ej. TRULINK-2026-001" value={referencia} onChange={(e) => setReferencia(e.target.value)} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Monto Pagado ($ USD)</label>
                <input type="number" step="0.01" placeholder="0.00" value={montoPagado} onChange={(e) => setMontoPagado(e.target.value)} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Banco Receptor</label>
                <select value={banco} onChange={(e) => setBanco(e.target.value)} style={inputStyle}>
                  <option value="General" style={{ background: "#111", color: "#FFD700" }}>Banco General</option>
                  <option value="Global Bank" style={{ background: "#111", color: "#FFD700" }}>Global Bank</option>
                  <option value="Banistmo" style={{ background: "#111", color: "#FFD700" }}>Banistmo</option>
                  <option value="Bicsa" style={{ background: "#111", color: "#FFD700" }}>BICSA</option>
                  <option value="Wire Internacional" style={{ background: "#111", color: "#FFD700" }}>Wire Transfer / Internacional</option>
                </select>
              </div>

              <div style={{ marginBottom: "22px" }}>
                <label style={labelStyle}>Número de Comprobante / Transferencia Bancaria</label>
                <input type="text" placeholder="Ej. REF-98421376" value={referenciaBancaria} onChange={(e) => setReferenciaBancaria(e.target.value)} style={inputStyle} />
              </div>

              <button type="submit" disabled={cargando} style={btnPrimary}>
                {cargando ? "Procesando y Generando PDF..." : "💾 Registrar Pago y Enviar Documento"}
              </button>
            </form>
          </div>

          {/* Resultado / Resumen en tiempo real */}
          <div style={cardBoxStyle}>
            <h3 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Resumen de Transacción Reciente
            </h3>

            {!resultado ? (
              <div style={{ color: "#777", textAlign: "center", padding: "50px 20px" }}>
                <p>Complete el formulario y procese el pago para ver el resumen de la liquidación, estatus y comprobante emitido automáticamente por Brevo.</p>
              </div>
            ) : (
              <div style={{ background: "#0a0a0a", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "8px", padding: "20px", fontSize: "0.9rem" }}>
                <div style={{ marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "8px" }}>
                  <span style={{ color: "#aaa" }}>Documento Emitido:</span>
                  <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "1.05rem" }}>{resultado.documentoEmitido}</div>
                </div>
                <div style={{ marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "8px" }}>
                  <span style={{ color: "#aaa" }}>Referencia:</span>
                  <div style={{ color: "#fff", fontWeight: "bold" }}>{resultado.referencia}</div>
                </div>
                <div style={{ marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "8px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <span style={{ color: "#aaa" }}>Total Cotización:</span>
                    <div style={{ color: "#fff" }}>${resultado.montoTotalCotizacion}</div>
                  </div>
                  <div>
                    <span style={{ color: "#aaa" }}>Abono Registrado:</span>
                    <div style={{ color: "#4ade80", fontWeight: "bold" }}>${resultado.abonoActualRegistrado}</div>
                  </div>
                </div>
                <div style={{ marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "8px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <span style={{ color: "#aaa" }}>Acumulado Pagado:</span>
                    <div style={{ color: "#fff" }}>${resultado.acumuladoPagado}</div>
                  </div>
                  <div>
                    <span style={{ color: "#aaa" }}>Saldo Pendiente:</span>
                    <div style={{ color: Number(resultado.saldoPendiente) > 0 ? "#f87171" : "#4ade80", fontWeight: "bold" }}>
                      ${resultado.saldoPendiente}
                    </div>
                  </div>
                </div>
                <div>
                  <span style={{ color: "#aaa" }}>Estatus Actualizado:</span>
                  <div style={{ color: "#FFD700", fontWeight: "bold", textTransform: "uppercase" }}>{resultado.estatusActualizado}</div>
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
  width: "100%",
  backgroundColor: "#DAA520",
  color: "#000",
  border: "none",
  borderRadius: "6px",
  padding: "13px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.9rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  boxShadow: "0 0 15px rgba(218,165,32,0.4)"
};