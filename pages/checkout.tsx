import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle, DataRow } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type QuoteItem = {
  SKU?: string;
  tipo?: string;
  nombre?: string;
  descripcion?: string;
  hilos?: number;
  longitudKm?: number;
  cantidad?: number;
  precioMetro?: number;
  precioCarrete?: number;
  precioUnitario?: number;
  total?: number;
};

type OrderData = {
  id: string;
  created_at: string;
  total?: number;
  total_amount?: number;
  items: QuoteItem[];
  status: string;
  type?: string;
  client_id?: string;
  user_id?: string;
  referencia?: string;
};

export default function Checkout() {
  const router = useRouter();
  const { t } = useI18n();
  const { id } = router.query;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const [montoPago, setMontoPago] = useState<number | string>("");
  const [errorMonto, setErrorMonto] = useState<string>("");

  const [transferStatus, setTransferStatus] = useState<string>('idle');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');

  const [formaPagoCliente, setFormaPagoCliente] = useState<string | null>(null);
  const [porcentajePagoCliente, setPorcentajePagoCliente] = useState<number>(50);
  const [clienteEncontrado, setClienteEncontrado] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      const fetchOrder = async () => {
        let query = supabase.from('quotes').select('*');

        if (typeof id === 'string' && isNaN(Number(id))) {
          query = query.eq('referencia', id);
        } else {
          query = query.or(`id.eq.${id},referencia.eq.${id}`);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error al recuperar orden:", error);
        } else if (data && data.length > 0) {
          const foundOrder = data[0];
          setOrder(foundOrder);
          const rawT = foundOrder?.total ?? foundOrder?.total_amount ?? 0;
          const totalVal = typeof rawT === 'number' ? rawT : Number(rawT) || 0;
          setMontoPago(totalVal);
        } else {
          console.warn("No se encontró ningún pedido con el identificador:", id);
        }
        setLoading(false);
      };
      fetchOrder();
    }
  }, [id]);

  useEffect(() => {
    const fetchClientePago = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('clientes')
        .select('forma_pago, porcentaje_pago')
        .eq('email', user.email)
        .maybeSingle();

      if (!error && data) {
        setFormaPagoCliente(data.forma_pago || null);
        setPorcentajePagoCliente(
          typeof data.porcentaje_pago === 'number' ? data.porcentaje_pago : 50
        );
        setClienteEncontrado(true);
      } else {
        console.warn('No se encontró condición de pago para el cliente logueado, usando 50% por defecto.');
      }
    };
    fetchClientePago();
  }, []);

  const rawTotal = order?.total ?? order?.total_amount ?? 0;
  const granTotal = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0;
  const esProducto = order?.type === 'producto';

  const montoMinimo = granTotal * (porcentajePagoCliente / 100);
  const refLabel = order?.referencia || order?.id || "QT-XXXX";

  const handleStripeCheckout = async () => {
    const valorIngresado = Number(montoPago);
    if (isNaN(valorIngresado) || valorIngresado < montoMinimo) {
      setErrorMonto(`${t("checkout.errMontoMinimo")}${montoMinimo.toFixed(2)} (${porcentajePagoCliente}%).`);
      return;
    }
    setErrorMonto("");

    try {
      const response = await fetch('/api/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, amount: valorIngresado }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(t("checkout.errStripeSession") + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      alert(t("checkout.errStripeNetwork"));
    }
  };

  const handlePayPalCheckout = async () => {
    const valorIngresado = Number(montoPago);
    if (isNaN(valorIngresado) || valorIngresado < montoMinimo) {
      setErrorMonto(`${t("checkout.errMontoMinimo")}${montoMinimo.toFixed(2)} (${porcentajePagoCliente}%).`);
      return;
    }
    setErrorMonto("");

    try {
      const response = await fetch('/api/create-paypal-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, amount: valorIngresado }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(t("checkout.errPaypalOrder") + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      alert(t("checkout.errPaypalNetwork"));
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorIngresado = Number(montoPago);
    if (isNaN(valorIngresado) || valorIngresado < montoMinimo) {
      setErrorMonto(`${t("checkout.errComprobanteMinimo")}${montoMinimo.toFixed(2)} (${porcentajePagoCliente}%).`);
      return;
    }
    setErrorMonto("");

    if (!fileToUpload) {
      alert(t("checkout.errAdjuntarComprobante"));
      return;
    }

    setTransferStatus('uploading');
    setUploadMessage(t("checkout.uploadingMsg"));

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const clientId = order?.client_id || order?.user_id || id || 'cliente-general';
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${timestamp}_${clientId}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transferencias')
        .upload(filePath, fileToUpload);

      if (uploadError) {
        throw new Error('Error al subir el archivo al bucket: ' + uploadError.message);
      }

      const { data: publicURLData } = supabase.storage
        .from('transferencias')
        .getPublicUrl(filePath);

      const comprobanteUrl = publicURLData.publicUrl || filePath;

      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'Pendiente de Verificación Bancaria',
          estado_pago: 'en_verificacion',
          comprobante_url: comprobanteUrl,
          monto_abonado: valorIngresado,
          saldo_pendiente: Math.max(0, granTotal - valorIngresado),
          metodo_pago: 'transferencia',
          updated_at: new Date().toISOString()
        })
        .eq('id', order?.id || id);

      if (updateError) {
        console.error('Advertencia al actualizar la tabla quotes:', updateError);
      }

      try {
        const esFull = valorIngresado >= granTotal;
        const tipoDocumento: 'FACTURA' | 'RECIBO' = esFull ? 'FACTURA' : 'RECIBO';

        const { data: numData, error: numError } = await supabase.rpc(
          'generar_numero_documento',
          { p_tipo: tipoDocumento }
        );
        if (numError) console.error('Error generando número de documento:', numError);
        const numDoc = numError ? null : (numData as string);

        await supabase.from('pagos').insert([{
          numero_documento: numDoc || `${tipoDocumento === 'FACTURA' ? 'FT' : 'RT'}-SIN-NUM-${Date.now()}`,
          tipo_documento: tipoDocumento,
          quote_id: order?.id || null,
          quote_referencia: refLabel,
          cliente_email: (await supabase.auth.getUser()).data.user?.email || null,
          monto: valorIngresado,
          monto_total_cotizacion: granTotal,
          saldo_pendiente: Math.max(0, granTotal - valorIngresado),
          metodo_pago: 'transferencia',
          status: 'pendiente_verificacion',
        }]);
      } catch (pagoErr) {
        console.error('Error registrando la transferencia en el libro de pagos:', pagoErr);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const emailResponse = await fetch('/api/send-transfer-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recipient: 'fred.jurado@trulinkfiber.com',
          quoteId: refLabel,
          clientName: clientId,
          total: granTotal,
          montoPagado: valorIngresado,
          comprobanteUrl: comprobanteUrl,
        }),
      });

      if (!emailResponse.ok) {
        console.error('Aviso de correo con retraso, pero el comprobante se guardó con éxito en Supabase.');
      }

      setTransferStatus('success');
      setUploadMessage(t("checkout.successMsg"));
    } catch (err: any) {
      console.error('Error procesando transferencia:', err);
      setTransferStatus('error');
      setUploadMessage(t("checkout.errTransferProcess") + (err.message || 'Desconocido'));
    }
  };

  return (
    <div style={{ backgroundColor: theme.background, color: theme.textLight, minHeight: "100vh", padding: "40px 20px", fontFamily: theme.fontFamily, boxSizing: "border-box" }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.35), inset 0 0 25px rgba(218, 165, 32, 0.1); }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
        }
        .container-pulse {
          animation: pulse-border 4s infinite ease-in-out;
        }
        input:focus, select:focus {
          border-color: ${theme.gold} !important;
          box-shadow: 0 0 12px rgba(218, 165, 32, 0.3), inset 0 1px 3px rgba(0,0,0,0.8) !important;
          outline: none;
        }
      `}</style>

      <div className="container-pulse" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <Card style={{ padding: "45px", borderRadius: theme.radiusLg, textAlign: "center" }}>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
            <LanguageSwitcher />
          </div>

          <div style={{ borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "25px", marginBottom: "30px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
            <Heading style={{ fontSize: "1.8rem", letterSpacing: "1.5px", margin: "0 0 5px 0", textAlign: "center" }}>
              {t("checkout.title")}
            </Heading>
            <p style={{ color: theme.textMuted, fontSize: "0.95rem", margin: 0, letterSpacing: "0.5px" }}>
              {t("checkout.subtitle")}
            </p>
          </div>

          {loading ? (
            <div style={{ padding: "60px 0" }}>
              <p style={{ color: theme.textMuted, fontSize: "1.1rem", fontStyle: "italic" }}>{t("checkout.loadingOrder")}</p>
            </div>
          ) : order ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px", backgroundColor: theme.inputBg, padding: "14px 20px", borderRadius: theme.radiusMd, border: `1px solid ${theme.borderGold}` }}>
                <DataRow label={t("checkout.reference")} valor={<span style={{ color: theme.gold }}>{refLabel}</span>} />
                <DataRow label={t("checkout.date")} valor={order.created_at ? new Date(order.created_at).toLocaleDateString() : ""} />
              </div>

              <div style={{ overflowX: "auto", marginBottom: "25px", borderRadius: theme.radiusMd, border: `1px solid ${theme.borderGold}` }}>
                <table style={{ margin: "0 auto", borderCollapse: "collapse", color: theme.gold, width: "100%", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: theme.inputBg, borderBottom: `1px solid ${theme.borderGold}` }}>
                      {esProducto && <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{t("checkout.colSku")}</th>}
                      <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{t("checkout.colDescTipo")}</th>
                      {!esProducto && <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{t("checkout.colHilos")}</th>}
                      <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{t("checkout.colCant")}</th>
                      <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{esProducto ? t("checkout.colPUnit") : t("checkout.colPUnitCarrete")}</th>
                      <th style={{ padding: "14px 12px", fontWeight: "600", letterSpacing: "0.5px" }}>{t("checkout.colTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items && Array.isArray(order.items) && order.items.map((item, index) => {
                      const skuVal = item.SKU || "-";
                      const desc = item.descripcion || item.nombre || item.tipo || "Artículo";
                      const hilosVal = item.hilos !== undefined ? item.hilos : "-";
                      const cantVal = item.cantidad ?? 1;
                      const unitPrice = Number(item.precioUnitario ?? item.precioCarrete ?? item.precioMetro ?? 0);
                      const itemTotal = item.total ?? (unitPrice * cantVal);

                      return (
                        <tr key={index} style={{ backgroundColor: index % 2 === 0 ? theme.sidebarBg : theme.inputBg, borderBottom: `1px solid ${theme.borderGoldLight}` }}>
                          {esProducto && <td style={{ padding: "12px", textAlign: "center", color: theme.textMuted }}>{skuVal}</td>}
                          <td style={{ padding: "12px", textAlign: "center", color: theme.textMuted }}>{desc}</td>
                          {!esProducto && <td style={{ padding: "12px", textAlign: "center", color: theme.textMuted }}>{hilosVal}</td>}
                          <td style={{ padding: "12px", textAlign: "center", color: theme.textMuted }}>{cantVal}</td>
                          <td style={{ padding: "12px", textAlign: "center", color: theme.textMuted }}>${unitPrice.toFixed(2)}</td>
                          <td style={{ padding: "12px", textAlign: "center", fontWeight: "600", color: theme.gold }}>${itemTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Card style={{ marginBottom: "25px" }}>
                <Heading style={{ fontSize: "1.6rem", margin: "0 0 10px 0" }}>{t("checkout.totalAPagar")} ${granTotal.toFixed(2)}</Heading>
                <p style={{ color: theme.textMuted, fontSize: "0.9rem", margin: 0, lineHeight: "1.5" }}>
                  {t("checkout.minimoRequerido")} ({porcentajePagoCliente}%): <strong style={{ color: theme.gold }}>${montoMinimo.toFixed(2)} USD</strong>
                </p>
                {clienteEncontrado && (
                  <p style={{ color: theme.textMuted, fontSize: "0.8rem", marginTop: "8px" }}>
                    {t("checkout.condicionAsignada")} <strong style={{ color: theme.gold }}>{formaPagoCliente}</strong>
                  </p>
                )}
              </Card>

              <Card style={{ textAlign: "left" }}>
                <label style={{ display: "block", marginBottom: "10px", color: theme.gold, fontWeight: "600", fontSize: "0.95rem" }}>
                  {t("checkout.labelMonto")} {porcentajePagoCliente}% {t("checkout.labelMontoSuffix")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  style={{ ...inputStyle, width: "100%", padding: "14px 16px", fontSize: "1rem", boxSizing: "border-box" }}
                />
                {errorMonto && <p style={{ color: theme.red, fontSize: "0.85rem", marginTop: "10px", marginBottom: 0 }}>{errorMonto}</p>}
              </Card>

              {!showPaymentOptions ? (
                <Card style={{ marginTop: "30px", border: `1px dashed ${theme.borderGoldInput}`, textAlign: "center" }}>
                  <p style={{ fontSize: "1.05rem", color: theme.textLight, marginBottom: "20px", fontWeight: "600" }}>
                    {t("checkout.preguntaContinuar")}
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
                    <Button variant="gold" onClick={() => setShowPaymentOptions(true)} style={{ maxWidth: "220px" }}>
                      {t("checkout.btnSiContinuar")}
                    </Button>
                    <Button variant="outline-gold" onClick={() => router.back()}>
                      {t("checkout.btnNoRegresar")}
                    </Button>
                  </div>
                </Card>
              ) : selectedMethod === 'transfer' ? (
                <Card style={{ marginTop: "30px", textAlign: "left" }}>
                  <Heading style={{ textAlign: "center", fontSize: "1.2rem" }}>{t("checkout.transferTitle")}</Heading>

                  <div style={{ fontSize: "0.9rem", lineHeight: "1.8", marginBottom: "25px", background: theme.sidebarBg, padding: "20px", borderRadius: theme.radiusMd, border: `1px solid ${theme.borderGold}` }}>
                    <DataRow label={t("checkout.titular")} valor="Trulink Fiber, LLC" />
                    <DataRow label={t("checkout.tipoCuenta")} valor={t("checkout.tipoCuentaVal")} />
                    <DataRow label={t("checkout.numeroRuta")} valor="026073150" />
                    <DataRow label={t("checkout.numeroCuenta")} valor="822000835611" />
                    <DataRow label={t("checkout.swift")} valor="CMFGUS33" />
                    <DataRow label={t("checkout.banco")} valor="Community Federal Savings Bank, 89-16 Jamaica Ave, Woodhaven, NY, 11421, United States" />
                  </div>

                  <div style={{ backgroundColor: theme.goldSoft, border: `1px solid ${theme.borderGold}`, padding: "16px", borderRadius: theme.radiusMd, marginBottom: "25px", textAlign: "center" }}>
                    <p style={{ color: theme.gold, fontWeight: "600", margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                      {t("checkout.subirComprobante")}
                    </p>
                    <p style={{ color: theme.textMuted, fontSize: "0.85rem", margin: 0 }}>
                      {t("checkout.subirComprobanteHint")}
                    </p>
                  </div>

                  {transferStatus === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Heading style={{ color: theme.green, textAlign: 'center', fontSize: '1.2rem' }}>{t("checkout.transferSuccessTitle")}</Heading>
                      <p style={{ color: theme.textLight, fontSize: '0.95rem', margin: '0 0 8px 0' }}>{uploadMessage}</p>
                      <p style={{ color: theme.textMuted, fontSize: '0.85rem', margin: '0 0 20px 0' }}>{t("checkout.transferSuccessNotified")}</p>
                      <Button variant="gold" onClick={() => router.push('/')} style={{ width: 'auto', display: 'inline-block', padding: '12px 25px' }}>
                        {t("checkout.btnVolverInicio")}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleTransferSubmit}>
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '10px', color: theme.gold, fontWeight: '600', fontSize: '0.9rem' }}>
                          {t("checkout.labelArchivo")}
                        </label>
                        <div style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.borderGoldInput}`, borderRadius: theme.radiusMd, padding: '12px' }}>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                            style={{ width: '100%', color: theme.textLight, background: 'transparent', border: 'none', cursor: 'pointer' }}
                            required
                          />
                        </div>
                      </div>

                      {transferStatus === 'uploading' && (
                        <p style={{ color: theme.gold, textAlign: 'center', fontStyle: 'italic', marginBottom: '20px', fontSize: '0.9rem' }}>{uploadMessage}</p>
                      )}

                      <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button type="button" variant="ghost" onClick={() => setSelectedMethod(null)}>
                          {t("checkout.btnVolver")}
                        </Button>
                        <Button type="submit" variant="gold" disabled={transferStatus === 'uploading'} style={{ width: 'auto', flex: 1 }}>
                          {transferStatus === 'uploading' ? t("checkout.btnSubiendo") : t("checkout.btnEnviarComprobante")}
                        </Button>
                      </div>
                    </form>
                  )}
                </Card>
              ) : (
                <Card style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
                  <p style={{ color: theme.textLight, fontSize: "1.05rem", marginBottom: "10px", fontWeight: "600" }}>{t("checkout.seleccioneMetodo")}</p>
                  <Button variant="gold" onClick={handleStripeCheckout} style={{ width: "100%", maxWidth: "350px" }}>{t("checkout.btnStripe")}</Button>
                  <Button variant="gold" onClick={handlePayPalCheckout} style={{ width: "100%", maxWidth: "350px" }}>{t("checkout.btnPaypal")}</Button>
                  <Button variant="gold" onClick={() => setSelectedMethod('transfer')} style={{ width: "100%", maxWidth: "350px" }}>{t("checkout.btnTransferencias")}</Button>

                  <Button variant="ghost" onClick={() => setShowPaymentOptions(false)} style={{ marginTop: "15px", textDecoration: "underline" }}>
                    {t("checkout.btnVolverPregunta")}
                  </Button>
                </Card>
              )}
            </div>
          ) : (
            <p style={{ color: theme.gold, fontSize: "1.1rem", padding: "40px 0" }}>{t("checkout.orderNotFound")}</p>
          )}
        </Card>
      </div>

      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.textMuted, textAlign: "center", letterSpacing: "0.5px" }}>
        {t("common.companyFooter")}
      </p>
    </div>
  );
}
