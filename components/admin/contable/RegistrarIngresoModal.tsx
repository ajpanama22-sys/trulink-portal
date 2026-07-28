import React, { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function RegistrarIngresoModal({ isOpen, onClose }: Props) {
  const [cargando, setCargando] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [montoPagado, setMontoPagado] = useState("");
  const [banco, setBanco] = useState("General");
  const [referenciaBancaria, setReferenciaBancaria] = useState("");
  const [resultado, setResultado] = useState<any>(null);

  if (!isOpen) return null;

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
      
      // Limpiar formulario
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
        maxWidth: "950px",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: "30px",
        boxShadow: "0 0 35px rgba(218, 165, 32, 0.25)"
      }}>
        {/* Encabezado del Modal con botón Cerrar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "15px" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
              REGISTRO DE TRANSFERENCIAS Y PAGOS B2B
            </h2>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>Captura manual de comprobantes bancarios e ingresos de cotizaciones</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #DAA520", color: "#DAA520", borderRadius: "50%", width: "35px", height: "35px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "25px" }}>
          {/* Formulario */}
          <div style={cardBoxStyle}>
            <h3 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
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
            <h3 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Resumen de Transacción Reciente
            </h3>

            {!resultado ? (
              <div style={{ color: "#777", textAlign: "center", padding: "40px 15px", fontSize: "0.85rem" }}>
                <p>Complete el formulario y procese el pago para ver el resumen de la liquidación, estatus y comprobante emitido automáticamente por Brevo.</p>
              </div>
            ) : (
              <div style={{ background: "#0a0a0a", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "8px", padding: "18px", fontSize: "0.85rem" }}>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                  <span style={{ color: "#aaa" }}>Documento Emitido:</span>
                  <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "1rem" }}>{resultado.documentoEmitido}</div>
                </div>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                  <span style={{ color: "#aaa" }}>Referencia:</span>
                  <div style={{ color: "#fff", fontWeight: "bold" }}>{resultado.referencia}</div>
                </div>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <span style={{ color: "#aaa" }}>Total Cotización:</span>
                    <div style={{ color: "#fff" }}>${resultado.montoTotalCotizacion}</div>
                  </div>
                  <div>
                    <span style={{ color: "#aaa" }}>Abono Registrado:</span>
                    <div style={{ color: "#4ade80", fontWeight: "bold" }}>${resultado.abonoActualRegistrado}</div>
                  </div>
                </div>
                <div style={{ marginBottom: "10px", borderBottom: "1px solid #222", paddingBottom: "6px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
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
  fontSize: "0.75rem",
  color: "#aaa",
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
  marginBottom: "5px",
  fontWeight: "bold"
};

const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "6px",
  padding: "10px 12px",
  color: "#FFD700",
  outline: "none",
  fontSize: "0.88rem",
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

const btnPrimary = {
  width: "100%",
  backgroundColor: "#DAA520",
  color: "#000",
  border: "none",
  borderRadius: "6px",
  padding: "12px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.85rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  boxShadow: "0 0 15px rgba(218,165,32,0.4)"
};