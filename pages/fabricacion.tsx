import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";

// Usamos el cliente compartido (singleton) en vez de crear una instancia
// propia con createClient(). Tener varias instancias de Supabase Auth
// compitiendo por el mismo localStorage causaba el warning "Multiple
// GoTrueClient instances detected" y comportamiento intermitente al leer
// la sesión (a veces detectaba al usuario logueado, a veces no).
const supabase = getSupabase();

type Item = {
  tipo: string;
  hilos: number;
  longitudKm: number;
  cantidad: number;
  precioMetro: number;
  precioCarrete: number;
  vano: number | null;          // 100 / 120 / 150 — solo ASU y ADSS
  conMensajero: boolean;        // solo FTTX
  configuracionCodigo: string;  // amarre con producto_configuraciones
};

/**
 * Traduce lo que eligió el cliente al código de configuración que usa la
 * planta. Es la pieza que permite que la orden de producción sepa qué
 * receta aplicar y cuánta materia prima descontar.
 *
 *   FTTX sin mensajero -> FTTH-SM
 *   FTTX con mensajero -> FTTH-CM
 *   ASU vano 120       -> ASU-120
 *   ADSS vano 150      -> ADSS-150
 */
const codigoConfiguracion = (tipo: string, vano: number | null, conMensajero: boolean): string => {
  if (tipo === "FTTX") return conMensajero ? "FTTH-CM" : "FTTH-SM";
  return `${tipo}-${vano || 100}`;
};

export default function Fabricacion() {
  const router = useRouter();
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

        // Usamos ilike (case-insensitive) para evitar que una diferencia de
        // mayúsculas/minúsculas entre Auth y la tabla clientes rompa el match.
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
      // NOTA: ya no redirigimos si no hay user de Supabase Auth, porque el
      // login del portal parece manejar su propia sesión (no Supabase Auth).
      // Hay que confirmar cómo se guarda esa sesión para hacer el chequeo real.

      setCargandoSesion(false);
    };

    fetchClientInfo();
  }, [router]);

  // NOTA: el cierre de sesión por inactividad ya no vive aquí — se
  // centralizó en components/InactivityGuard.tsx, montado globalmente
  // desde _app.tsx para todo el portal de clientes (antes solo aplicaba
  // en esta página, y páginas como productos.tsx no lo tenían).

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/portal-cliente");
  };

  const handleVolverPortal = () => {
    router.push("/portal-cliente");
  };

  // Precios base por metro para fabricación
  const precios: Record<string, number> = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

  // ------------------------------------------------------------------
  // RECARGOS POR CONFIGURACIÓN
  // Están en CERO a propósito: hay que definirlos con costos reales
  // antes de cobrarlos. Hoy un ADSS de vano 150 cuesta lo mismo que uno
  // de 100, y un FTTX con mensajero lo mismo que sin él — aunque el de
  // 150 lleva más aramida y el del mensajero agrega acero.
  // Cuando tengas los costos, cambia estos números y listo.
  // ------------------------------------------------------------------
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

  /** Texto corto de la configuración, para mostrar y para el PDF. */
  const detalleConfig = (item: Item): string => {
    const partes: string[] = [`${item.longitudKm} km/carrete`];
    if (item.vano) partes.push(`vano ${item.vano} m`);
    if (item.conMensajero) partes.push("con mensajero");
    return partes.join(" · ");
  };

  const guardarCotizacionEnSupabase = async (pdfPublicUrl: string) => {
    // Se guardan los campos ESTRUCTURADOS además de la descripción de
    // texto: hilos, km del carrete, vano, mensajero y el código de
    // configuración. Sin ellos el panel de manufactura no puede deducir
    // la receta ni calcular el consumo de materia prima — quedaría
    // adivinando a partir de una cadena de texto.
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
      // NOTA: user_id se quitó del payload. La tabla quotes tiene un foreign
      // key hacia "profiles", pero los usuarios creados vía Auth admin
      // (activar-password.ts) no generan fila en "profiles", lo que rompía
      // el guardado con error 23503. Toda la info del cliente ya se guarda
      // directamente (empresa, representante, email, telefono_celular),
      // así que no se necesita user_id para identificar al cliente aquí.
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

    // La descripción del PDF ahora incluye vano y mensajero, para que el
    // cliente vea exactamente qué configuración está cotizando.
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
      alert("La cotización está vacía. Por favor, agregue artículos.");
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
      alert(`Ocurrió un error al procesar la solicitud: ${err.message || err}`);
    }
  };

  const generarPDF = async (): Promise<void> => {
    if (cotizacion.length === 0) {
      alert("La cotización está vacía.");
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

      {/* Header Bar */}
      <div style={{ width: "100%", maxWidth: "1050px", display: "flex", justifyContent: "space-between", marginBottom: "25px", alignItems: "center" }}>
        <div />
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            backgroundColor: "rgba(15, 15, 15, 0.8)",
            padding: "8px 16px",
            borderRadius: theme.radiusMd,
            border: `1px solid ${theme.borderGold}`,
            backdropFilter: "blur(5px)"
          }}>
            <span style={{ color: theme.textLight, fontSize: "0.85rem", letterSpacing: "0.5px" }}>Ref: <strong style={{ color: theme.gold, fontWeight: 600 }}>{referenciaActual}</strong></span>
          </div>

          <Button variant="outline-gold" onClick={handleVolverPortal} style={{ padding: "8px 16px", borderRadius: theme.radiusMd, fontSize: "0.85rem" }}>
            Volver al Portal
          </Button>

          <Button variant="outline-gold" onClick={handleLogOut} style={{ padding: "8px 16px", borderRadius: theme.radiusMd, fontSize: "0.85rem" }}>
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Main Title Section */}
      <div style={{ textAlign: "center", marginBottom: "35px", maxWidth: "800px", margin: "0 auto 35px auto" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "120px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
        <h1 style={{ color: theme.gold, marginBottom: "8px", fontSize: "2rem", fontWeight: 700, letterSpacing: "1.5px" }}>
          LÍNEA DE PRODUCCIÓN DE CABLES DE FIBRA
        </h1>
        <div style={{ display: "inline-block", padding: "4px 16px", backgroundColor: theme.goldSoft, borderRadius: "20px", border: `1px solid ${theme.borderGold}` }}>
          <p style={{ color: theme.textLight, fontSize: "0.95rem", letterSpacing: "3px", margin: 0, fontWeight: 500 }}>ADSS – ASU – FTTX</p>
        </div>
      </div>

      {/* Product Selection Container */}
      <div className="container-fiber" style={{ maxWidth: "1050px", width: "100%", margin: "0 auto 30px auto", boxSizing: "border-box" }}>
      <Card style={{
        border: `1px solid ${theme.borderGold}`,
        borderRadius: "24px",
        padding: "30px",
        margin: 0,
        boxSizing: "border-box"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>

          {/* ASU Card */}
          <div className="card-hover" style={{ backgroundColor: theme.inputBg, borderRadius: "18px", padding: "20px", textAlign: "center", border: `1px solid ${theme.borderGoldLight}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: `1px solid ${theme.borderGold}`, marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/ASU.png" alt="Cable ASU" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <Heading style={{ fontSize: "1.3rem", margin: "0 0 6px 0", textAlign: "center" }}>ASU</Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.72rem", margin: "0 0 15px 0" }}>Autosoportado con varillas FRP</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={filaControl}>
                  <label style={etiquetaControl}>Hilos:</label>
                  <select id="asuHilos" style={controlStyle}>
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="24">24</option>
                    <option value="48">48</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Vano:</label>
                  <select id="asuVano" style={controlStyle}>
                    <option value="100">100 m</option>
                    <option value="120">120 m</option>
                    <option value="150">150 m</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Carrete:</label>
                  <select id="asuCarrete" style={controlStyle}>
                    <option value="3">3 km</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Cantidad:</label>
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
              Agregar a Cotización
            </Button>
          </div>

          {/* ADSS Card */}
          <div className="card-hover" style={{ backgroundColor: theme.inputBg, borderRadius: "18px", padding: "20px", textAlign: "center", border: `1px solid ${theme.borderGoldLight}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: `1px solid ${theme.borderGold}`, marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/ADSS.png" alt="Cable ADSS" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <Heading style={{ fontSize: "1.3rem", margin: "0 0 6px 0", textAlign: "center" }}>ADSS</Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.72rem", margin: "0 0 15px 0" }}>Dieléctrico autosoportado con aramida</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={filaControl}>
                  <label style={etiquetaControl}>Hilos:</label>
                  <select id="adssHilos" style={controlStyle}>
                    <option value="72">72</option>
                    <option value="96">96</option>
                    <option value="144">144</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Vano:</label>
                  <select id="adssVano" style={controlStyle}>
                    <option value="100">100 m</option>
                    <option value="120">120 m</option>
                    <option value="150">150 m</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Carrete:</label>
                  <select id="adssCarrete" style={controlStyle}>
                    <option value="3">3 km</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Cantidad:</label>
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
              Agregar a Cotización
            </Button>
          </div>

          {/* FTTX Card */}
          <div className="card-hover" style={{ backgroundColor: theme.inputBg, borderRadius: "18px", padding: "20px", textAlign: "center", border: `1px solid ${theme.borderGoldLight}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: `1px solid ${theme.borderGold}`, marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/FTTX.png" alt="Cable FTTX" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <Heading style={{ fontSize: "1.3rem", margin: "0 0 6px 0", textAlign: "center" }}>FTTX</Heading>
              <p style={{ color: theme.textMuted, fontSize: "0.72rem", margin: "0 0 15px 0" }}>Drop plano para acometidas</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={filaControl}>
                  <label style={etiquetaControl}>Hilos:</label>
                  <select id="fttxHilos" style={controlStyle}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Mensajero:</label>
                  <select id="fttxMensajero" style={controlStyle}>
                    <option value="no">Sin mensajero</option>
                    <option value="si">Con mensajero</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Carrete:</label>
                  <select id="fttxCarrete" style={controlStyle}>
                    <option value="1">1 km</option>
                    <option value="2">2 km</option>
                  </select>
                </div>

                <div style={filaControl}>
                  <label style={etiquetaControl}>Cantidad:</label>
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
              Agregar a Cotización
            </Button>
          </div>

        </div>
      </Card>
      </div>

      {/* Quote Summary Container */}
      <div className="container-fiber" style={{ maxWidth: "1050px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <Card style={{
        border: `1px solid ${theme.borderGold}`,
        borderRadius: "24px",
        padding: "30px",
        margin: 0,
        boxSizing: "border-box"
      }}>
        <Heading style={{ textAlign: "center", marginBottom: "25px", fontSize: "1.5rem" }}>
          Mi Cotización <span style={{ color: theme.textLight, fontWeight: 400 }}>({referenciaActual})</span>
        </Heading>

        {cotizacion.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", backgroundColor: "rgba(15,15,15,0.5)", borderRadius: theme.radiusLg, border: `1px dashed ${theme.borderGold}` }}>
            <p style={{ color: theme.textMuted, fontSize: "0.95rem", margin: 0 }}>No has agregado artículos aún.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: theme.radiusLg, border: `1px solid ${theme.borderGold}` }}>
            <table style={{ margin: "0 auto", borderCollapse: "collapse", color: theme.gold, width: "100%", fontSize: "0.9rem", textAlign: "center" }}>
              <thead>
                <tr style={{ backgroundColor: "#111111", borderBottom: `1px solid ${theme.borderGold}` }}>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>Desc</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>Hilos</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>Cant</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>P. Unit</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>P. Carr</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>Total</th>
                  <th style={{ padding: "12px 15px", fontWeight: 600, color: theme.gold }}>Acción</th>
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
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Terms and Conditions Block */}
        <div style={{ marginTop: "25px", color: theme.textMuted, fontSize: "0.85rem", borderTop: `1px dashed ${theme.borderGold}`, paddingTop: "15px", lineHeight: "1.6" }}>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>Precios:</strong> EXW PANAMÁ</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>NOTA:</strong> Esta cotización es válida por 15 días a partir de la fecha de emisión.</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>Forma de pago:</strong> 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: theme.gold }}>MÉTODOS DE PAGO:</strong> YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES</p>
        </div>

        {/* Total Summary */}
        <div style={{ marginTop: "25px", padding: "15px", backgroundColor: theme.goldSoft, borderRadius: theme.radiusLg, border: `1px solid ${theme.borderGold}`, textAlign: "center" }}>
          <Heading style={{ margin: 0, fontSize: "1.5rem", textAlign: "center" }}>
            TOTAL GENERAL: ${granTotal.toFixed(2)}
          </Heading>
        </div>

        {/* Action Buttons */}
        <div style={{ textAlign: "center", marginTop: "30px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          {cargandoSesion && (
            <p style={{ color: theme.gold, fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>
              Cargando datos del cliente, un momento...
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
            <Button
              variant="gold"
              onClick={generarPDF}
              disabled={cargandoSesion}
              style={{ padding: "12px 28px", borderRadius: theme.radiusLg, fontSize: "0.95rem" }}
            >
              Guardar PDF
            </Button>
            <Button
              variant="outline-gold"
              onClick={procesarPago}
              disabled={cargandoSesion}
              style={{ padding: "12px 28px", borderRadius: theme.radiusLg, fontSize: "0.95rem" }}
            >
              Proceder con Pago
            </Button>
          </div>
        </div>
      </Card>
      </div>

      {/* Footer */}
      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.gold, opacity: 0.7, textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
