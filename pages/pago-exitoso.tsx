import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useRequiereCliente } from "../lib/useRequiereCliente";
import { theme } from "../lib/theme";
import { Card, Badge, Button, DataRow, estadoToTone } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

const INTENTOS_FASE_RAPIDA = 10;
const INTERVALO_RAPIDO_MS = 2000;
const INTENTOS_FASE_LENTA = 68;
const INTERVALO_LENTO_MS = 8000;

const NOMBRE_PASARELA: Record<string, string> = {
  stripe: "Stripe",
  card: "Stripe",
  paypal: "PayPal",
  transferencia: "Transferencia bancaria",
  ach: "ACH",
};

export default function PagoExitoso() {
  const router = useRouter();
  const { t } = useI18n();
  const { cargando: cargandoSesion, autorizado } = useRequiereCliente();
  const { order_id, method, gateway } = router.query;
  const singleOrderId = Array.isArray(order_id) ? order_id[0] : order_id;

  const pasarelaParam = (Array.isArray(gateway) ? gateway[0] : gateway) || (Array.isArray(method) ? method[0] : method) || "";
  const nombrePasarela = NOMBRE_PASARELA[pasarelaParam.toLowerCase()] || "la pasarela de pago";

  const [buscando, setBuscando] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [cuenta, setCuenta] = useState<any>(null);
  const [ultimoCobro, setUltimoCobro] = useState<any>(null);
  const [agotado, setAgotado] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const intentosRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCerrarSesion() {
    setCerrandoSesion(true);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (err) {
      console.error("Error cerrando sesión:", err);
    } finally {
      router.push("/login");
    }
  }

  useEffect(() => {
    if (!autorizado || !supabase || !singleOrderId) return;

    let activo = true;

    const consultarEstado = async () => {
      let q = supabase!.from("quotes").select("*");
      q = isNaN(Number(singleOrderId)) ? q.eq("referencia", singleOrderId) : q.or(`id.eq.${singleOrderId},referencia.eq.${singleOrderId}`);
      const { data: quoteData, error: quoteError } = await q.maybeSingle();

      if (!activo) return;
      if (quoteError) console.error("Error consultando quotes:", quoteError.message);

      const estadosConfirmados = ["paid", "partial", "en_verificacion"];
      const yaConfirmado = quoteData && estadosConfirmados.includes(String(quoteData.status || "").toLowerCase());

      if (yaConfirmado) {
        setQuote(quoteData);

        const referenciaReal = quoteData.referencia || singleOrderId;
        const { data: cuentaData } = await supabase!
          .from("cuentas_por_cobrar")
          .select("*")
          .eq("quote_referencia", referenciaReal)
          .maybeSingle();
        if (!activo) return;
        setCuenta(cuentaData || null);

        if (cuentaData) {
          const { data: cobroData } = await supabase!
            .from("cobros_cliente")
            .select("*")
            .eq("cuenta_por_cobrar_id", cuentaData.id)
            .order("fecha", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!activo) return;
          setUltimoCobro(cobroData || null);
        }

        setBuscando(false);
        return;
      }

      intentosRef.current += 1;
      const totalIntentos = INTENTOS_FASE_RAPIDA + INTENTOS_FASE_LENTA;
      if (intentosRef.current >= totalIntentos) {
        setQuote(quoteData || null);
        setAgotado(true);
        setBuscando(false);
        return;
      }
      const intervalo = intentosRef.current <= INTENTOS_FASE_RAPIDA ? INTERVALO_RAPIDO_MS : INTERVALO_LENTO_MS;
      timeoutRef.current = setTimeout(consultarEstado, intervalo);
    };

    consultarEstado();

    return () => {
      activo = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [autorizado, singleOrderId]);

  if (cargandoSesion) {
    return (
      <div style={pantallaCentro}>
        <p>{t("common.loadingVerifying")}</p>
      </div>
    );
  }
  if (!autorizado) return null;

  const totalCotizacion = Number(quote?.total || 0);
  const montoPagadoAcumulado = Number(quote?.monto_pagado || 0);
  const saldoPendiente = Number(quote?.saldo_pendiente ?? Math.max(0, totalCotizacion - montoPagadoAcumulado));
  const isFullPayment = saldoPendiente <= 0;
  const isTransferencia = quote?.metodo_pago === "Transferencia" || quote?.metodo_pago === "ACH" || quote?.status === "en_verificacion";
  const documentType = isFullPayment ? t("pagoExitoso.documentoFactura") : t("pagoExitoso.documentoRecibo");
  const montoEsteAbono = ultimoCobro ? Number(ultimoCobro.monto || 0) : montoPagadoAcumulado;
  const currentDate = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ backgroundColor: theme.background, color: theme.gold, minHeight: "100vh", padding: "50px 20px", fontFamily: theme.fontFamily, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", boxSizing: "border-box" }}>
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
        @keyframes girar-spinner {
          to { transform: rotate(360deg); }
        }
        @media print {
          body, html {
            background-color: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-card {
            background-color: #ffffff !important;
            border: 1px solid ${theme.gold} !important;
            box-shadow: none !important;
            color: #111111 !important;
          }
        }
      `}</style>

      <div className="container-pulse printable-card" style={{ maxWidth: "720px", width: "100%", boxSizing: "border-box" }}>
        <Card style={{ padding: "45px 35px", textAlign: "center" }}>

        <div className="no-print">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <LanguageSwitcher />
          </div>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "130px", marginBottom: "20px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />

          {buscando ? (
            <div style={{ padding: "30px 0" }}>
              <div style={{ marginBottom: "18px" }}>
                <span style={spinnerStyle} />
              </div>
              <p style={{ color: theme.gold, fontSize: "1.1rem", fontWeight: 600, letterSpacing: "0.5px", margin: "0 0 8px 0" }}>
                {t("pagoExitoso.waitingConfirmation")} {nombrePasarela}...
              </p>
              <p style={{ color: theme.textMuted, fontSize: "0.85rem", margin: 0 }}>
                {t("pagoExitoso.dontClose")}
              </p>
            </div>
          ) : agotado ? (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: theme.gold, fontSize: "1.6rem", marginBottom: "10px", fontWeight: 700, letterSpacing: "1px" }}>{t("pagoExitoso.stillWaitingTitle")}</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: theme.gold, margin: "0 auto 15px auto", opacity: 0.8 }}></div>
              <p style={{ color: theme.textMuted, fontSize: "0.95rem", lineHeight: "1.6", margin: "0 0 18px 0" }}>
                {nombrePasarela} {t("pagoExitoso.stillWaitingBody")}
              </p>
              <Button
                variant="outline-gold"
                onClick={() => {
                  intentosRef.current = 0;
                  setAgotado(false);
                  setBuscando(true);
                }}
              >
                {t("pagoExitoso.btnVerificarDeNuevo")}
              </Button>
            </div>
          ) : isTransferencia ? (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: theme.gold, fontSize: "1.8rem", marginBottom: "10px", fontWeight: 700, letterSpacing: "1px" }}>{t("pagoExitoso.transferTitle")}</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: theme.gold, margin: "0 auto 15px auto", opacity: 0.8 }}></div>
              <p style={{ color: theme.textMuted, fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
                {t("pagoExitoso.transferBody")} <strong style={{ color: theme.gold }}>{quote?.email || "tu correo registrado"}</strong>.
              </p>
              <div style={{ marginTop: "16px" }}>
                <Badge tone={estadoToTone("en_verificacion")}>{t("pagoExitoso.badgeEnVerificacion")}</Badge>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ color: theme.green, fontSize: "1.8rem", marginBottom: "10px", fontWeight: 700, letterSpacing: "1px" }}>{t("pagoExitoso.paymentSuccessTitle")}</h1>
              <div style={{ width: "50px", height: "2px", backgroundColor: theme.green, margin: "0 auto 15px auto", opacity: 0.8 }}></div>
              <p style={{ color: theme.textMuted, fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>
                {t("pagoExitoso.paymentSuccessBody")} {documentType.toLowerCase()} {t("pagoExitoso.paymentSuccessBodyTo")} <strong style={{ color: theme.gold }}>{quote?.email || "tu correo registrado"}</strong>.
              </p>
              <div style={{ marginTop: "16px" }}>
                <Badge tone="success">{t("pagoExitoso.badgePagado")}</Badge>
              </div>
            </div>
          )}
        </div>

        {!buscando && quote && (
          <div style={{ width: "100%", backgroundColor: theme.background, border: `1px solid ${theme.borderGold}`, padding: "30px", borderRadius: theme.radiusLg, textAlign: "left", color: theme.gold, margin: "10px 0 30px 0", boxSizing: "border-box", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.8)" }}>

            <div style={{ textAlign: "center", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "18px", marginBottom: "20px" }}>
              <img src="/images/logo.png" alt="Trulink Fiber LLC" style={{ width: "100px", height: "auto", marginBottom: "8px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.2))" }} />
              <div style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "2px 0" }}>5203 Juan Tabo Blvd. NE Suite 2a</div>
              <div style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "2px 0" }}>Albuquerque, NM, 87111, USA</div>
              <div style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "2px 0" }}>info@trulinkfiber.com</div>
            </div>

            <div style={{ background: theme.goldGradient, color: "#1A1400", fontSize: "0.95rem", fontWeight: 700, textAlign: "center", padding: "10px", margin: "0 0 20px 0", borderRadius: theme.radiusSm, border: `1px solid ${theme.gold}`, letterSpacing: "1px" }}>
              {documentType} {isFullPayment ? "(100%)" : ""}
            </div>

            <div style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "20px", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "15px", lineHeight: "1.6" }}>
              <DataRow label={t("pagoExitoso.fechaConsulta")} valor={currentDate} />
              <DataRow label={t("pagoExitoso.referenciaCotizacion")} valor={<strong style={{ color: theme.gold }}>{`#${quote?.referencia || singleOrderId || "N/D"}`}</strong>} />
              <DataRow label={t("pagoExitoso.cliente")} valor={quote?.empresa || quote?.representante || "N/D"} />
              <DataRow label={t("pagoExitoso.correoElectronico")} valor={quote?.email || "N/D"} />
              <DataRow label={t("pagoExitoso.metodoPago")} valor={(quote?.metodo_pago || "Pasarela / En Línea").toString().toUpperCase()} />
              {cuenta?.estado && <DataRow label={t("pagoExitoso.estadoCuenta")} valor={cuenta.estado} />}
            </div>

            <div style={{ backgroundColor: theme.sidebarBg, border: `1px solid ${theme.borderGoldLight}`, borderRadius: theme.radiusMd, padding: "15px", marginBottom: "20px" }}>
              <DataRow label={t("pagoExitoso.montoTotal")} valor={`$${totalCotizacion.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`} />
              <DataRow label={t("pagoExitoso.ultimoAbono")} valor={<strong style={{ color: theme.green }}>{`$${montoEsteAbono.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`}</strong>} />
              <DataRow label={t("pagoExitoso.totalAbonado")} valor={`$${montoPagadoAcumulado.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", fontWeight: 700, paddingTop: "10px", borderTop: `1px solid ${theme.borderGoldLight}`, color: theme.gold }}>
                <span>{t("pagoExitoso.saldoPendiente")}</span>
                <span>${saldoPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
              </div>
            </div>

            <div style={{ fontSize: "0.75rem", color: theme.textMuted, backgroundColor: theme.sidebarBg, border: `1px solid ${theme.borderGoldLight}`, borderLeft: `3px solid ${theme.gold}`, padding: "12px", borderRadius: theme.radiusSm, marginBottom: "20px", lineHeight: "1.5", textAlign: "justify" }}>
              <strong style={{ color: theme.gold }}>{t("pagoExitoso.condicionesLabel")}</strong>{" "}
              {isFullPayment
                ? t("pagoExitoso.condicionesFull")
                : `${t("pagoExitoso.condicionesPartial")}${saldoPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${t("pagoExitoso.condicionesPartialSuffix")}`}
            </div>

            <div style={{ textAlign: "center", fontSize: "0.75rem", color: theme.textMuted, borderTop: `1px dashed ${theme.borderGoldLight}`, paddingTop: "12px", lineHeight: "1.4" }}>
              <strong style={{ color: theme.gold, fontSize: "0.8rem", letterSpacing: "0.5px" }}>{t("pagoExitoso.gracias")}</strong><br />
              www.trulinkfiber.com
            </div>
          </div>
        )}

        <div className="no-print" style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap", marginTop: "10px" }}>
          {!buscando && quote && (
            <Button variant="gold" onClick={() => window.print()}>
              {t("pagoExitoso.btnImprimir")}
            </Button>
          )}
          <Button variant="outline-gold" onClick={() => router.push('/portal-cliente')}>
            {t("common.backToPortal").replace("← ", "")}
          </Button>
          <Button variant="outline-gold" onClick={() => router.push('/seguimiento')}>
            {t("pagoExitoso.btnVerPedidos")}
          </Button>
          <Button variant="ghost" disabled={cerrandoSesion} onClick={handleCerrarSesion}>
            {cerrandoSesion ? t("common.loggingOut") : t("common.logout")}
          </Button>
        </div>

        </Card>
      </div>

      <p className="no-print" style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.borderGoldCounter, textAlign: "center", letterSpacing: "0.5px" }}>
        {t("common.companyFooter")}
      </p>
    </div>
  );
}

const spinnerStyle: React.CSSProperties = {
  display: "inline-block",
  width: "34px",
  height: "34px",
  border: `3px solid ${theme.borderGoldLight}`,
  borderTopColor: theme.gold,
  borderRadius: "50%",
  animation: "girar-spinner 0.8s linear infinite",
};

const pantallaCentro: React.CSSProperties = {
  backgroundColor: theme.background,
  color: theme.gold,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: theme.fontFamily,
};
