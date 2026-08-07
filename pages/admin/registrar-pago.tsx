import { useState } from "react";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, Heading, PageHeader, Button, DataRow, inputStyle } from "../../lib/ui";
import { getSupabase } from "../../lib/supabaseClient";

export default function RegistrarPagoVisual() {
  const supabase = getSupabase();
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
      if (!supabase) {
        throw new Error("No se pudo conectar con el servidor. Intenta de nuevo.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sesión no encontrada. Vuelve a iniciar sesión.");
      }

      const response = await fetch("/api/admin/registrar-pagos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
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
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="registrar-pago" />

      <div style={pageWrapStyle()}>
        <PageHeader title="Registro de Transferencias y Pagos B2B" counterLabel="Módulo Operativo" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "30px" }}>
          <Card>
            <Heading>Datos del Pago Bancario</Heading>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Referencia de Cotización / Factura</label>
                <input
                  type="text"
                  placeholder="Ej. TRULINK-2026-001"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Monto Pagado ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={montoPagado}
                  onChange={(e) => setMontoPagado(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Banco Receptor</label>
                <select
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="General">Banco General</option>
                  <option value="Global Bank">Global Bank</option>
                  <option value="Banistmo">Banistmo</option>
                  <option value="Bicsa">BICSA</option>
                  <option value="Wire Internacional">Wire Transfer / Internacional</option>
                </select>
              </div>

              <div style={{ marginBottom: "22px" }}>
                <label style={labelStyle}>Número de Comprobante / Transferencia Bancaria</label>
                <input
                  type="text"
                  placeholder="Ej. REF-98421376"
                  value={referenciaBancaria}
                  onChange={(e) => setReferenciaBancaria(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>

              <Button type="submit" disabled={cargando} style={{ width: "100%" }}>
                {cargando ? "Procesando y Generando PDF..." : "💾 Registrar Pago y Enviar Documento"}
              </Button>
            </form>
          </Card>

          <Card>
            <Heading>Resumen de Transacción Reciente</Heading>

            {!resultado ? (
              <div style={{ color: theme.textMuted, textAlign: "center", padding: "50px 20px" }}>
                <p>Complete el formulario y procese el pago para ver el resumen de la liquidación, estatus y comprobante emitido automáticamente por Brevo.</p>
              </div>
            ) : (
              <Card style={{ marginBottom: 0, fontSize: "0.9rem" }}>
                <div style={{ marginBottom: "12px", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "8px" }}>
                  <DataRow label="Documento Emitido" valor={resultado.documentoEmitido} />
                </div>
                <div style={{ marginBottom: "12px", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "8px" }}>
                  <DataRow label="Referencia" valor={resultado.referencia} />
                </div>
                <div style={{ marginBottom: "12px", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "8px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <DataRow label="Total Cotización" valor={`$${resultado.montoTotalCotizacion}`} />
                  <DataRow
                    label="Abono Registrado"
                    valor={<span style={{ color: theme.green, fontWeight: "bold" }}>${resultado.abonoActualRegistrado}</span>}
                  />
                </div>
                <div style={{ marginBottom: "12px", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "8px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <DataRow label="Acumulado Pagado" valor={`$${resultado.acumuladoPagado}`} />
                  <DataRow
                    label="Saldo Pendiente"
                    valor={
                      <span style={{ color: Number(resultado.saldoPendiente) > 0 ? theme.red : theme.green, fontWeight: "bold" }}>
                        ${resultado.saldoPendiente}
                      </span>
                    }
                  />
                </div>
                <DataRow
                  label="Estatus Actualizado"
                  valor={<span style={{ color: theme.gold, fontWeight: "bold", textTransform: "uppercase" }}>{resultado.estatusActualizado}</span>}
                />
              </Card>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  color: theme.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
  marginBottom: "6px",
  fontWeight: "bold"
};
