import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";
import { useRequiereCliente } from "../lib/useRequiereCliente";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

const supabase = getSupabase();

type Item = {
  tipo: string;
  hilos: number;
  longitudKm: number;
  cantidad: number;
  precioMetro: number;
  precioCarrete: number;
  vano: number | null;
  conMensajero: boolean;
  configuracionCodigo: string;
};

const codigoConfiguracion = (tipo: string, vano: number | null, conMensajero: boolean): string => {
  if (tipo === "FTTX") return conMensajero ? "FTTH-CM" : "FTTH-SM";
  return `${tipo}-${vano || 100}`;
};

export default function Fabricacion() {
  const router = useRouter();
  const { t } = useI18n();
  const { cargando: cargandoGuard, autorizado } = useRequiereCliente();

  const [cotizacion, setCotizacion] = useState<Item[]>([]);
  const [referenciaActual, setReferenciaActual] = useState<string>("");
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [representante, setRepresentante] = useState("");
  const [mailCliente, setMailCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [clienteData, setClienteData] = useState<any>(null);

  useEffect(() => {
    setReferenciaActual(`QT-${Date.now().toString().slice(-6)}`);

    const fetchClientInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user && user.email) {
        const emailUsuario = user.email.trim();

        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .ilike("email", emailUsuario)
          .maybeSingle();

        if (error) {
          console.error("Error consultando tabla clientes:", error);
        }

        if (data) {
          setClienteData(data);
          setNombreEmpresa(data.razon_social || "");
          setRepresentante(data.nombre_representante || "");
          setMailCliente(data.email || emailUsuario);
          setTelefonoCliente(data.telefono_celular || data.telefono_oficina || "");
        } else {
          setMailCliente(emailUsuario);
        }
      }

      setCargandoSesion(false);
    };

    fetchClientInfo();
  }, [router]);

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/portal-cliente");
  };

  const handleVolverPortal = () => {
    router.push("/portal-cliente");
  };

  const precios: Record<string, number> = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

  const recargoVano: Record<number, number> = { 100: 0, 120: 0, 150: 0 };
  const recargoMensajero = 0;

  const agregarItem = (
    tipo: string,
    hilos: number,
    longitudKm: number,
    cantidad: number,
    vano: number | null = null,
    conMensajero: boolean = false
  ): void => {
    const base = precios[tipo] || 0;
    const precioMetro =
      base +
      (vano ? (recargoVano[vano] || 0) : 0) +
      (conMensajero ? recargoMensajero : 0);
    const precioCarrete = precioMetro * (longitudKm * 1000);

    const nuevoItem: Item = {
      tipo,
      hilos,
      longitudKm,
      cantidad,
      precioMetro,
      precioCarrete,
      vano,
      conMensajero,
      configuracionCodigo: codigoConfiguracion(tipo, vano, conMensajero),
    };
    setCotizacion([...cotizacion, nuevoItem]);
  };

  const eliminarItem = (index: number): void => {
    const nuevaCotizacion = cotizacion.filter((_, i) => i !== index);
    setCotizacion(nuevaCotizacion);
  };

  const granTotal = cotizacion.reduce((acc: number, item: Item) => acc + (item.precioCarrete * item.cantidad), 0);

  const calcularFechaEntrega = () => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 3);
    return hoy.toISOString().split('T')[0];
  };

  const detalleConfig = (item: Item): string => {
    const partes: string[] = [`${item.longitudKm} km/carrete`];
    if (item.vano) partes.push(`vano ${item.vano} m`);
    if (item.conMensajero) partes.push("con mensajero");
    return partes.join(" · ");
  };

  const guardarCotizacionEnSupabase = async (pdfPublicUrl: string) => {
    const itemsFormateados = cotizacion.map(item => ({
      SKU: item.tipo,
      descripcion:
        `Cable ${item.tipo} - ${item.hilos} hilos (${item.longitudKm}km)` +
        (item.vano ? ` - vano ${item.vano}m` : "") +
        (item.conMensajero ? " - con mensajero" : ""),
      cantidad: item.cantidad,
      precioUnitario: item.precioCarrete,
      total: item.precioCarrete * item.cantidad,
      hilos: item.hilos,
      longitudKm: item.longitudKm,
      vano: item.vano,
      con_mensajero: item.conMensajero,
      configuracion_codigo: item.configuracionCodigo,
    }));

    const { data: existente } = await supabase
      .from('quotes')
      .select('id')
      .eq('referencia', referenciaActual)
      .maybeSingle();

    let resultado;
    const payloadQuote = {
      referencia: referenciaActual,
      total: granTotal,
      items: itemsFormateados,
      status: 'pending',
      type: 'fabricacion',
      pdf_url: pdfPublicUrl,
      empresa: clienteData?.razon_social || nombreEmpresa,
      representante: clienteData?.nombre_representante || representante,
      email: clienteData?.email || mailCliente,
      telefono_celular: clienteData?.telefono_celular || telefonoCliente,
      fecha_estimada_entrega: calcularFechaEntrega()
    };

    if (existente) {
      resultado = await supabase
        .from('quotes')
        .update(payloadQuote)
        .eq('referencia', referenciaActual)
        .select()
        .single();
    } else {
      resultado = await supabase
        .from('quotes')
        .insert([payloadQuote])
        .select()
        .single();
    }

    if (resultado.error) {
      console.error("ERROR DETALLADO DE SUPABASE:", resultado.error);
      throw new Error(resultado.error.message);
    }
    return resultado.data;
  };

  // NOTA: el contenido del PDF generado (jsPDF) queda en español por ahora.
  // Traducirlo requiere un paso aparte (el motor de PDF no usa el sistema
  // de i18n de la web). Ver INTEGRACION_IDIOMAS.md para el detalle.
  const generarDocumentoPDF = () => {
    const fechaActual = new Date().toLocaleDateString();
    const horaActual = new Date().toLocaleTimeString();

    const doc = new jsPDF();
    doc.addImage("/images/logo.png", "PNG", 14, 10, 40, 20);

    doc.setFontSize(10);
    doc.text(`Referencia: ${referenciaActual}`, 150, 20);
    doc.text(`Fecha: ${fechaActual}`, 150, 26);
    doc.text(`Hora: ${horaActual}`, 150, 32);

    doc.setFontSize(9);
    doc.text(`Cliente: ${nombreEmpresa || "N/D"}`, 14, 42);
    doc.text(`Representante: ${representante || "N/D"}`, 14, 48);
    doc.text(`Mail: ${mailCliente || "N/D"}`, 14, 54);
    doc.text(`Teléfono Móvil: ${telefonoCliente || "N/D"}`, 14, 60);

    doc.setFontSize(16);
    doc.text("TRULINK FIBER LLC", 14, 70);
    doc.setFontSize(10);
    doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 76);
    doc.text("Tel: +507 6640 3720", 14, 82);
    doc.text("www.trulinkfiber.com", 14, 88);

    const rows = cotizacion.map(item => [
      item.tipo +
        (item.vano ? `\nVano ${item.vano} m` : "") +
        (item.conMensajero ? "\nCon mensajero" : ""),
      item.hilos.toString(),
      item.cantidad.toString(),
      `$${item.precioMetro.toFixed(2)}`,
      `$${item.precioCarrete.toFixed(2)}`,
      `$${(item.precioCarrete * item.cantidad).toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [["Descripción", "Hilos", "Cant", "P. Unitario", "P. Carrete", "Total"]],
      body: rows,
      startY: 96,
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [218, 165, 32] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`TOTAL : $${granTotal.toFixed(2)}`, 150, finalY);

    doc.setFontSize(10);
    doc.text("Precios: EXW PANAMÁ", 14, finalY + 10);
    doc.text("NOTA: Esta cotización es válida por 15 días a partir de la fecha de emisión.", 14, finalY + 16);
    doc.text("Forma de pago: 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.", 14, finalY + 22);
    doc.text("MÉTODOS DE PAGO: YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES", 105, finalY + 34, { align: "center" });

    try {
      const firma = "/images/firmaco.png";
      const props = doc.getImageProperties(firma);
      const firmaWidth = 40;
      const firmaHeight = (props.height * firmaWidth) / props.width;
      doc.addImage(firma, "PNG", 150, finalY + 42, firmaWidth, firmaHeight);
    } catch (e) {
      console.error("No se pudo cargar la firma:", e);
    }

    return doc;
  };

  const procesarPago = async () => {
    if (cotizacion.length === 0) {
      alert(t("fabricacion.errEmptyQuote"));
      return;
    }

    try {
      const doc = generarDocumentoPDF();
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      await guardarCotizacionEnSupabase(pdfPublicUrl);
      router.push(`/checkout?id=${referenciaActual}`);
    } catch (err: any) {
      console.error("ERROR INESPERADO:", err);
      alert(t("fabricacion.errUnexpected") + (err.message || err));
    }
  };

  const generarPDF = async (): Promise<void> => {
    if (cotizacion.length === 0) {
      alert(t("fabricacion.errEmptyQuoteSave"));
      return;
    }

    try {
      const doc = generarDocumentoPDF();
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      await guardarCotizacionEnSupabase(pdfPublicUrl);
      doc.save(`${referenciaActual}_TrulinkFiber.pdf`);
    } catch (err) {
      const doc = generarDocumentoPDF();
      doc.save(`${referenciaActual}_TrulinkFiber.pdf`);
    }
  };

  const controlStyle: React.CSSProperties = {
    ...inputStyle,
    width: "130px",
    textAlign: "center",
  };

  const filaControl: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px"
  };

  const etiquetaControl: React.CSSProperties = {
    color: theme.textMuted,
    fontSize: "0.9rem",
    fontWeight: 500
  };

  if (cargandoGuard) {
    return <p style={{ color: "#DAA520", textAlign: "center", marginTop: "60px" }}>{t("common.loadingVerifying")}</p>;
  }
  if (!autorizado) return null;

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
      minHeight: "100vh",
      padding: "30px 20px",
      fontFamily: theme.fontFamily,
      margin: 0,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      boxSizing: "border-box"
    }}>
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
        .container-fiber {
          animation: pulse-border 4s infinite ease-in-out;
        }
        .card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-hover:hover {
          border-color: #DAA520 !important;
          box-shadow: 0 8px 30px rgba(218, 165, 32, 0.12);
          transform: translateY(-2px);
        }
        select:focus, input:focus {
          border-color: #DAA520 !important;
          box-shadow: 0 0 10px rgba(218, 165, 32, 0.3) !important;
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: "1050px", display: "flex", justifyContent: "space-between", marginBottom: "25px", alignItems: "center" }}>
        <LanguageSwitcher />
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            backgroundColor: "rgba(15, 15, 15, 0.8)",
            padding: "8px 16px",
            borderRadius: theme.radiusMd,
            border: `1px solid ${theme.borderGold}`,
            backdropFilter: "blur(5px)"
          }}>
            <span style={{ color: theme.textLight, fontSize: "0.85rem", letterSpacing: "0.5px" }}>{t("fabricacion.ref")} <strong style={{ color: theme.gold, fontWeight: 600 }}>{referenciaActual}</strong></span>
          </div>

          <Button variant="outline-gold" onClick={handleVolverPortal} style={{ padding: "8px 16px", borderRadius: theme.radiusMd, fontSize: "0.85rem" }}>
            {t("common.back")} {t("portalCliente.badge")}
          </Button>

          <Button variant="outline-gold" onClick={handleLogOut} style={{ padding: "8px 16px", borderRadius: theme.radiusMd, fontSize: "0.85rem" }}>
            {t("common.logout")}
          </Button>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "35px", maxWidth: "800px", margin: "0 auto 35px auto" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "120px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
        <h1 style={{ color: theme.gold, marginBottom: "8px", fontSize: "2rem", fontWeight: 700, letterSpacing: "1.5px" }}>
          {t("fabricacion.title")}
        </h1>
        <div style={{ display: "inline-block", padding: "4px 16px", backgroundColor: theme.goldSoft, borderRadius: "20px", border: `1px solid ${theme.borderGold}` }}>
          <p style={{ color: theme.textLight, fontSize: "0.95rem", letterSpacing: "3px", margin: 0, fontWeight: 500 }}>{t("fabricacion.subtitle")}</p>
        </div>
      </div>

      <div className="container-fiber" style={{ maxWidth: "1050px", width: "100%", margin: "0 auto 30px auto", boxSizing: "border-box" }}>
      <Card style={{
        border: `1px solid ${theme.borderGold}`,
        borderRadius: "24px",
        padding: "30px",
        margin: 0,
        boxSizing: "border-box"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>

          <div className="card-hover" style={{ backgroundColor: theme.inputBg, borderRadius: "18px", padding: "20px", textAlign: "center", border: `1px solid ${theme.borderGoldLight}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: `1px solid ${theme.borderGold}`, marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/ASU.png" alt="Cable ASU" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <Heading style={{ fontSize: "1.3rem", margin: "0 0 6px 0", textAlign: "center" }}>ASU</Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.72rem", margin: "0 0 15px 0" }}>{t("fabricacion.asuDesc")}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.hilos")}</label>
                  <select id="asuHilos" style={controlStyle}>
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="24">24</option>
                    <option value="48">48</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.vano")}</label>
                  <select id="asuVano" style={controlStyle}>
                    <option value="100">100 m</option>
                    <option value="120">120 m</option>
                    <option value="150">150 m</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.carrete")}</label>
                  <select id="asuCarrete" style={controlStyle}>
                    <option value="3">3 km</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.cantidad")}</label>
                  <input
                    id="asuCantidad"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={controlStyle}
                  />
                </div>
              </div>
            </div>

            <Button
              variant="gold"
              style={{ width: "100%", padding: "10px", borderRadius: theme.radiusMd, fontSize: "0.9rem" }}
              onClick={() => {
                const hilos = parseInt((document.getElementById("asuHilos") as HTMLSelectElement).value);
                const carrete = parseInt((document.getElementById("asuCarrete") as HTMLSelectElement).value);
                const cantidad = parseInt((document.getElementById("asuCantidad") as HTMLInputElement).value);
                const vano = parseInt((document.getElementById("asuVano") as HTMLSelectElement)?.value || "100");
                agregarItem("ASU", hilos, carrete, cantidad, vano, false);
              }}
            >
              {t("fabricacion.btnAgregar")}
            </Button>
          </div>

          <div className="card-hover" style={{ backgroundColor: theme.inputBg, borderRadius: "18px", padding: "20px", textAlign: "center", border: `1px solid ${theme.borderGoldLight}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: `1px solid ${theme.borderGold}`, marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/ADSS.png" alt="Cable ADSS" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <Heading style={{ fontSize: "1.3rem", margin: "0 0 6px 0", textAlign: "center" }}>ADSS</Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.72rem", margin: "0 0 15px 0" }}>{t("fabricacion.adssDesc")}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.hilos")}</label>
                  <select id="adssHilos" style={controlStyle}>
                    <option value="72">72</option>
                    <option value="96">96</option>
                    <option value="144">144</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.vano")}</label>
                  <select id="adssVano" style={controlStyle}>
                    <option value="100">100 m</option>
                    <option value="120">120 m</option>
                    <option value="150">150 m</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.carrete")}</label>
                  <select id="adssCarrete" style={controlStyle}>
                    <option value="3">3 km</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.cantidad")}</label>
                  <input
                    id="adssCantidad"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={controlStyle}
                  />
                </div>
              </div>
            </div>

            <Button
              variant="gold"
              style={{ width: "100%", padding: "10px", borderRadius: theme.radiusMd, fontSize: "0.9rem" }}
              onClick={() => {
                const hilos = parseInt((document.getElementById("adssHilos") as HTMLSelectElement)?.value || "0");
                const carrete = parseInt((document.getElementById("adssCarrete") as HTMLSelectElement)?.value || "0");
                const cantidad = parseInt((document.getElementById("adssCantidad") as HTMLInputElement)?.value || "0");
                const vano = parseInt((document.getElementById("adssVano") as HTMLSelectElement)?.value || "100");
                agregarItem("ADSS", hilos, carrete, cantidad, vano, false);
              }}
            >
              {t("fabricacion.btnAgregar")}
            </Button>
          </div>

          <div className="card-hover" style={{ backgroundColor: theme.inputBg, borderRadius: "18px", padding: "20px", textAlign: "center", border: `1px solid ${theme.borderGoldLight}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: `1px solid ${theme.borderGold}`, marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/FTTX.png" alt="Cable FTTX" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <Heading style={{ fontSize: "1.3rem", margin: "0 0 6px 0", textAlign: "center" }}>FTTX</Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.72rem", margin: "0 0 15px 0" }}>{t("fabricacion.fttxDesc")}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.hilos")}</label>
                  <select id="fttxHilos" style={controlStyle}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.mensajero")}</label>
                  <select id="fttxMensajero" style={controlStyle}>
                    <option value="no">{t("fabricacion.sinMensajero")}</option>
                    <option value="si">{t("fabricacion.conMensajero")}</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.carrete")}</label>
                  <select id="fttxCarrete" style={controlStyle}>
                    <option value="1">1 km</option>
                    <option value="2">2 km</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>{t("fabricacion.cantidad")}</label>
                  <input
                    id="fttxCantidad"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={controlStyle}
                  />
                </div>
              </div>
            </div>

            <Button
              variant="gold"
              style={{ width: "100%", padding: "10px", borderRadius: theme.radiusMd, fontSize: "0.9rem" }}
              onClick={() => {
                const hilos = parseInt((document.getElementById("fttxHilos") as HTMLSelectElement)?.value || "0");
                const carrete = parseInt((document.getElementById("fttxCarrete") as HTMLSelectElement)?.value || "0");
                const cantidad = parseInt((document.getElementById("fttxCantidad") as HTMLInputElement)?.value || "0");
                const mensajero = (document.getElementById("fttxMensajero") as HTMLSelectElement)?.value === "si";
                agregarItem("FTTX", hilos, carrete, cantidad, null, mensajero);
              }}
            >
              {t("fabricacion.btnAgregar")}
            </Button>
          </div>

        </div>
      </Card>
      </div>

      <div className="container-fiber" style={{ maxWidth: "1050px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <Card style={{
        border: `1px solid ${theme.borderGold}`,
        borderRadius: "24px",
        padding: "30px",
        margin: 0,
        boxSizing: "border-box"
      }}>
        <Heading style={{ textAlign: "center", marginBottom: "25px", fontSize: "1.5rem" }}>
          {t("fabricacion.cotizacionTitle")} <span style={{ color: theme.textLight, fontWeight: 400 }}>({referenciaActual})</span>
        </Heading>

        {cotizacion.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", backgroundColor: "rgba(15,15,15,0.5)", borderRadius: theme.radiusLg, border: `1px dashed ${theme.borderGold}` }}>
            <p style={{ color: theme.textMuted, fontSize: "0.95rem", margin: 0 }}>{t("fabricacion.emptyItems")}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: theme.radiusLg, border: `1px solid ${theme.borderGold}` }}>
            <table style={{ margin: "0 auto", borderCollapse: "collapse", color: theme.gold, width: "100%", fontSize: "0.9rem", textAlign: "center" }}>
              <thead>
                <tr style={{ backgroundColor: "#111111", borderBottom: `1px solid ${theme.borderGold}` }}>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colDesc")}</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colHilos")}</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colCant")}</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colPUnit")}</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colPCarr")}</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colTotal")}</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>{t("fabricacion.colAccion")}</th>
                </tr>
              </thead>
              <tbody>
                {cotizacion.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? theme.inputBg : "#0d0d0d", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "12px 15px", color: theme.textLight, fontWeight: 500, textAlign: "left" }}>
                      {item.tipo}
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: "3px" }}>
                        {detalleConfig(item)}
                      </div>
                    </td>
                    <td style={{ padding: "12px 15px", color: theme.textMuted }}>{item.hilos}</td>
                    <td style={{ padding: "12px 15px", color: theme.textMuted }}>{item.cantidad}</td>
                    <td style={{ padding: "12px 15px", color: theme.textMuted }}>${item.precioMetro.toFixed(2)}</td>
                    <td style={{ padding: "12px 15px", color: theme.textMuted }}>${item.precioCarrete.toFixed(2)}</td>
                    <td style={{ padding: "12px 15px", color: theme.gold, fontWeight: 600 }}>${(item.precioCarrete * item.cantidad).toFixed(2)}</td>
                    <td style={{ padding: "12px 15px" }}>
                      <Button variant="outline-red" style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: theme.radiusSm }} onClick={() => eliminarItem(index)}>
                        {t("fabricacion.btnEliminar")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "25px", color: theme.textMuted, fontSize: "0.85rem", borderTop: `1px dashed ${theme.borderGold}`, paddingTop: "15px", lineHeight: "1.6" }}>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>{t("fabricacion.precios")}</strong> {t("fabricacion.preciosVal")}</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>{t("fabricacion.nota")}</strong> {t("fabricacion.notaVal")}</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>{t("fabricacion.formaPago")}</strong> {t("fabricacion.formaPagoVal")}</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>{t("fabricacion.metodosPago")}</strong> {t("fabricacion.metodosPagoVal")}</p>
        </div>

        <div style={{ marginTop: "25px", padding: "15px", backgroundColor: theme.goldSoft, borderRadius: theme.radiusLg, border: `1px solid ${theme.borderGold}`, textAlign: "center" }}>
          <Heading style={{ margin: 0, fontSize: "1.5rem", textAlign: "center" }}>
            {t("fabricacion.totalGeneral")} ${granTotal.toFixed(2)}
          </Heading>
        </div>

        <div style={{ textAlign: "center", marginTop: "30px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          {cargandoSesion && (
            <p style={{ color: theme.gold, fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>
              {t("fabricacion.loadingClient")}
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
            <Button
              variant="gold"
              onClick={generarPDF}
              disabled={cargandoSesion}
              style={{ padding: "12px 28px", borderRadius: theme.radiusLg, fontSize: "0.95rem" }}
            >
              {t("fabricacion.btnGuardarPdf")}
            </Button>
            <Button
              variant="outline-gold"
              onClick={procesarPago}
              disabled={cargandoSesion}
              style={{ padding: "12px 28px", borderRadius: theme.radiusLg, fontSize: "0.95rem" }}
            >
              {t("fabricacion.btnProcederPago")}
            </Button>
          </div>
        </div>
      </Card>
      </div>

      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.gold, opacity: 0.7, textAlign: "center", letterSpacing: "0.5px" }}>
        {t("common.companyFooter")}
      </p>
    </div>
  );
}
