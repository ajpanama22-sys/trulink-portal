import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Item = {
  tipo: string;
  hilos: number;
  longitudKm: number;
  cantidad: number;
  precioMetro: number;
  precioCarrete: number;
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

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/portal-cliente");
      }, 5 * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [router]);

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/portal-cliente");
  };

  const handleVolverPortal = () => {
    router.push("/portal-cliente");
  };

  // Precios base por metro para fabricación
  const precios: Record<string, number> = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

  const agregarItem = (tipo: string, hilos: number, longitudKm: number, cantidad: number): void => {
    const precioMetro = precios[tipo] || 0;
    const precioCarrete = precioMetro * (longitudKm * 1000);
    const nuevoItem: Item = { tipo, hilos, longitudKm, cantidad, precioMetro, precioCarrete };
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

  const guardarCotizacionEnSupabase = async (pdfPublicUrl: string) => {
    const itemsFormateados = cotizacion.map(item => ({
      SKU: item.tipo,
      descripcion: `Cable ${item.tipo} - ${item.hilos} hilos (${item.longitudKm}km)`,
      cantidad: item.cantidad,
      precioUnitario: item.precioCarrete,
      total: item.precioCarrete * item.cantidad
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

    const rows = cotizacion.map(item => [
      item.tipo,
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
    backgroundColor: "#080808",
    color: "#DAA520",
    border: "1px solid rgba(218, 165, 32, 0.4)",
    borderRadius: "8px",
    padding: "8px 12px",
    outline: "none",
    textAlign: "center",
    fontSize: "0.9rem",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)"
  };

  return (
    <div style={{
      backgroundColor: "#000000",
      color: "#DAA520",
      minHeight: "100vh",
      padding: "30px 20px",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
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
          background-color: #000000 !important;
          color: #DAA520;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.35), inset 0 0 25px rgba(218, 165, 32, 0.1); }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
        }
        .container-fiber {
          animation: pulse-border 4s infinite ease-in-out;
        }
        .nav-btn {
          background: linear-gradient(135deg, #0a0a0a 0%, #161616 100%) !important;
          color: #DAA520 !important;
          border: 1px solid rgba(218, 165, 32, 0.3) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .nav-btn:hover {
          background: linear-gradient(135deg, #DAA520 0%, #B8860B 100%) !important;
          color: #000000 !important;
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
          transform: translateY(-1px);
        }
        .card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-hover:hover {
          border-color: #DAA520 !important;
          box-shadow: 0 8px 30px rgba(218, 165, 32, 0.12);
          transform: translateY(-2px);
        }
        .action-btn {
          background: linear-gradient(135deg, #DAA520 0%, #B8860B 100%) !important;
          color: #000000 !important;
          font-weight: 600;
          border: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-btn:hover {
          filter: brightness(1.15);
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
          transform: translateY(-1px);
        }
        .action-btn-alt {
          background: linear-gradient(135deg, #0a0a0a 0%, #161616 100%) !important;
          color: #DAA520 !important;
          border: 1px solid #DAA520 !important;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-btn-alt:hover {
          background: rgba(218, 165, 32, 0.1) !important;
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.2);
          transform: translateY(-1px);
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
            borderRadius: "10px",
            border: "1px solid rgba(218, 165, 32, 0.2)",
            backdropFilter: "blur(5px)"
          }}>
            <span style={{ color: "#E0E0E0", fontSize: "0.85rem", letterSpacing: "0.5px" }}>Ref: <strong style={{ color: "#DAA520", fontWeight: "600" }}>{referenciaActual}</strong></span>
          </div>

          <button
            onClick={handleVolverPortal}
            className="nav-btn"
            style={{ padding: "8px 16px", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem" }}
          >
            Volver al Portal
          </button>

          <button
            onClick={handleLogOut}
            className="nav-btn"
            style={{ padding: "8px 16px", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem" }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Title Section */}
      <div style={{ textAlign: "center", marginBottom: "35px", maxWidth: "800px", margin: "0 auto 35px auto" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "120px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
        <h1 style={{ color: "#DAA520", marginBottom: "8px", fontSize: "2rem", fontWeight: "700", letterSpacing: "1.5px" }}>
          LÍNEA DE PRODUCCIÓN DE CABLES DE FIBRA
        </h1>
        <div style={{ display: "inline-block", padding: "4px 16px", backgroundColor: "rgba(218,165,32,0.08)", borderRadius: "20px", border: "1px solid rgba(218,165,32,0.2)" }}>
          <p style={{ color: "#F5F5F5", fontSize: "0.95rem", letterSpacing: "3px", margin: 0, fontWeight: "500" }}>ADSS – ASU – FTTX</p>
        </div>
      </div>

      {/* Product Selection Container */}
      <div className="container-fiber" style={{
        backgroundColor: "#060606",
        border: "1px solid rgba(218, 165, 32, 0.3)",
        borderRadius: "24px",
        padding: "30px",
        maxWidth: "1050px",
        width: "100%",
        margin: "0 auto 30px auto",
        boxSizing: "border-box"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>

          {/* ASU Card */}
          <div className="card-hover" style={{ backgroundColor: "#0b0b0b", borderRadius: "18px", padding: "20px", textAlign: "center", border: "1px solid rgba(218, 165, 32, 0.15)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)", marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/ASU.png" alt="Cable ASU" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <h3 style={{ color: "#DAA520", margin: "0 0 15px 0", fontSize: "1.3rem", fontWeight: "700", letterSpacing: "0.5px" }}>ASU</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Hilos:</label>
                  <select id="asuHilos" style={{ ...controlStyle, width: "130px" }}>
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="24">24</option>
                    <option value="48">48</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Carrete:</label>
                  <select id="asuCarrete" style={{ ...controlStyle, width: "130px" }}>
                    <option value="3">3 km</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Cantidad:</label>
                  <input
                    id="asuCantidad"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={{ ...controlStyle, width: "130px" }}
                  />
                </div>
              </div>
            </div>

            <button onClick={() => {
              const hilos = parseInt((document.getElementById("asuHilos") as HTMLSelectElement).value);
              const carrete = parseInt((document.getElementById("asuCarrete") as HTMLSelectElement).value);
              const cantidad = parseInt((document.getElementById("asuCantidad") as HTMLInputElement).value);
              agregarItem("ASU", hilos, carrete, cantidad);
            }} className="action-btn" style={{ width: "100%", padding: "10px", borderRadius: "10px", cursor: "pointer", fontSize: "0.9rem", letterSpacing: "0.5px" }}>
              Agregar a Cotización
            </button>
          </div>

          {/* ADSS Card */}
          <div className="card-hover" style={{ backgroundColor: "#0b0b0b", borderRadius: "18px", padding: "20px", textAlign: "center", border: "1px solid rgba(218, 165, 32, 0.15)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)", marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/ADSS.png" alt="Cable ADSS" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <h3 style={{ color: "#DAA520", margin: "0 0 15px 0", fontSize: "1.3rem", fontWeight: "700", letterSpacing: "0.5px" }}>ADSS</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Hilos:</label>
                  <select id="adssHilos" style={{ ...controlStyle, width: "130px" }}>
                    <option value="72">72</option>
                    <option value="96">96</option>
                    <option value="144">144</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Carrete:</label>
                  <select id="adssCarrete" style={{ ...controlStyle, width: "130px" }}>
                    <option value="3">3 km</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Cantidad:</label>
                  <input
                    id="adssCantidad"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={{ ...controlStyle, width: "130px" }}
                  />
                </div>
              </div>
            </div>

            <button onClick={() => {
              const hilos = parseInt((document.getElementById("adssHilos") as HTMLSelectElement)?.value || "0");
              const carrete = parseInt((document.getElementById("adssCarrete") as HTMLSelectElement)?.value || "0");
              const cantidad = parseInt((document.getElementById("adssCantidad") as HTMLInputElement)?.value || "0");
              agregarItem("ADSS", hilos, carrete, cantidad);
            }} className="action-btn" style={{ width: "100%", padding: "10px", borderRadius: "10px", cursor: "pointer", fontSize: "0.9rem", letterSpacing: "0.5px" }}>
              Agregar a Cotización
            </button>
          </div>

          {/* FTTX Card */}
          <div className="card-hover" style={{ backgroundColor: "#0b0b0b", borderRadius: "18px", padding: "20px", textAlign: "center", border: "1px solid rgba(218, 165, 32, 0.15)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)", marginBottom: "15px", backgroundColor: "#000" }}>
                <img src="/images/FTTX.png" alt="Cable FTTX" style={{ width: "100%", height: "140px", objectFit: "cover", transition: "transform 0.5s ease" }} className="hover:scale-105" />
              </div>
              <h3 style={{ color: "#DAA520", margin: "0 0 15px 0", fontSize: "1.3rem", fontWeight: "700", letterSpacing: "0.5px" }}>FTTX</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Hilos:</label>
                  <select id="fttxHilos" style={{ ...controlStyle, width: "130px" }}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Carrete:</label>
                  <select id="fttxCarrete" style={{ ...controlStyle, width: "130px" }}>
                    <option value="1">1 km</option>
                    <option value="2">2 km</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                  <label style={{ color: "#CCCCCC", fontSize: "0.9rem", fontWeight: "500" }}>Cantidad:</label>
                  <input
                    id="fttxCantidad"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={{ ...controlStyle, width: "130px" }}
                  />
                </div>
              </div>
            </div>

            <button onClick={() => {
              const hilos = parseInt((document.getElementById("fttxHilos") as HTMLSelectElement)?.value || "0");
              const carrete = parseInt((document.getElementById("fttxCarrete") as HTMLSelectElement)?.value || "0");
              const cantidad = parseInt((document.getElementById("fttxCantidad") as HTMLInputElement)?.value || "0");
              agregarItem("FTTX", hilos, carrete, cantidad);
            }} className="action-btn" style={{ width: "100%", padding: "10px", borderRadius: "10px", cursor: "pointer", fontSize: "0.9rem", letterSpacing: "0.5px" }}>
              Agregar a Cotización
            </button>
          </div>

        </div>
      </div>

      {/* Quote Summary Container */}
      <div className="container-fiber" style={{
        backgroundColor: "#060606",
        border: "1px solid rgba(218, 165, 32, 0.3)",
        borderRadius: "24px",
        padding: "30px",
        maxWidth: "1050px",
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box"
      }}>
        <h2 style={{ color: "#DAA520", textAlign: "center", marginBottom: "25px", fontSize: "1.5rem", fontWeight: "700", letterSpacing: "0.5px" }}>
          Mi Cotización <span style={{ color: "#FFFFFF", fontWeight: "400" }}>({referenciaActual})</span>
        </h2>

        {cotizacion.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", backgroundColor: "rgba(15,15,15,0.5)", borderRadius: "12px", border: "1px dashed rgba(218,165,32,0.2)" }}>
            <p style={{ color: "#A0A0A0", fontSize: "0.95rem", margin: 0 }}>No has agregado artículos aún.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
            <table style={{ margin: "0 auto", borderCollapse: "collapse", color: "#DAA520", width: "100%", fontSize: "0.9rem", textAlign: "center" }}>
              <thead>
                <tr style={{ backgroundColor: "#111111", borderBottom: "1px solid rgba(218, 165, 32, 0.3)" }}>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>Desc</th>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>Hilos</th>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>Cant</th>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>P. Unit</th>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>P. Carr</th>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>Total</th>
                  <th style={{ padding: "12px 15px", fontWeight: "600", color: "#DAA520" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {cotizacion.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#080808" : "#0d0d0d", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "12px 15px", color: "#FFFFFF", fontWeight: "500" }}>{item.tipo}</td>
                    <td style={{ padding: "12px 15px", color: "#CCCCCC" }}>{item.hilos}</td>
                    <td style={{ padding: "12px 15px", color: "#CCCCCC" }}>{item.cantidad}</td>
                    <td style={{ padding: "12px 15px", color: "#CCCCCC" }}>${item.precioMetro.toFixed(2)}</td>
                    <td style={{ padding: "12px 15px", color: "#CCCCCC" }}>${item.precioCarrete.toFixed(2)}</td>
                    <td style={{ padding: "12px 15px", color: "#DAA520", fontWeight: "600" }}>${(item.precioCarrete * item.cantidad).toFixed(2)}</td>
                    <td style={{ padding: "12px 15px" }}>
                      <button onClick={() => eliminarItem(index)} style={{ backgroundColor: "rgba(139, 0, 0, 0.2)", color: "#FF5252", border: "1px solid rgba(255, 82, 82, 0.3)", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", transition: "all 0.2s" }} className="hover:bg-red-900/40">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Terms and Conditions Block */}
        <div style={{ marginTop: "25px", color: "#B0B0B0", fontSize: "0.85rem", borderTop: "1px dashed rgba(218, 165, 32, 0.3)", paddingTop: "15px", lineHeight: "1.6" }}>
          <p style={{ margin: "6px 0" }}><strong style={{ color: "#DAA520" }}>Precios:</strong> EXW PANAMÁ</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: "#DAA520" }}>NOTA:</strong> Esta cotización es válida por 15 días a partir de la fecha de emisión.</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: "#DAA520" }}>Forma de pago:</strong> 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.</p>
          <p style={{ margin: "6px 0" }}><strong style={{ color: "#DAA520" }}>MÉTODOS DE PAGO:</strong> YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES</p>
        </div>

        {/* Total Summary */}
        <div style={{ marginTop: "25px", padding: "15px", backgroundColor: "rgba(218, 165, 32, 0.05)", borderRadius: "12px", border: "1px solid rgba(218, 165, 32, 0.2)", textAlign: "center" }}>
          <h2 style={{ margin: 0, color: "#DAA520", fontSize: "1.5rem", fontWeight: "700", letterSpacing: "1px" }}>
            TOTAL GENERAL: ${granTotal.toFixed(2)}
          </h2>
        </div>

        {/* Action Buttons */}
        <div style={{ textAlign: "center", marginTop: "30px", display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
          <button onClick={generarPDF} className="action-btn" style={{ padding: "12px 28px", borderRadius: "12px", cursor: "pointer", fontSize: "0.95rem", letterSpacing: "0.5px" }}>
            Guardar PDF
          </button>
          <button onClick={procesarPago} className="action-btn-alt" style={{ padding: "12px 28px", borderRadius: "12px", cursor: "pointer", fontSize: "0.95rem", letterSpacing: "0.5px" }}>
            Proceder con Pago
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: "rgba(218, 165, 32, 0.7)", textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
