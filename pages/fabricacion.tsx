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

  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [representante, setRepresentante] = useState("");
  const [mailCliente, setMailCliente] = useState("");

  useEffect(() => {
    // Generar la referencia única al cargar la vista de cotización por primera vez
    setReferenciaActual(`QT-${Date.now().toString().slice(-6)}`);

    const fetchClientInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('clients')
          .select('empresa, representante, email')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setNombreEmpresa(data.empresa || '');
          setRepresentante(data.representante || '');
          setMailCliente(data.email || '');
        }
      }
    };

    fetchClientInfo();
  }, []);

  const precios: Record<string, number> = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

  const agregarItem = (tipo: string, hilos: number, longitudKm: number, cantidad: number): void => {
    const precioMetro = precios[tipo];
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

    // Verificamos si ya existe la cotización con esta referencia en la tabla quotes
    const { data: existente } = await supabase
      .from('quotes')
      .select('id')
      .eq('referencia', referenciaActual)
      .single();

    let resultado;
    if (existente) {
      resultado = await supabase
        .from('quotes')
        .update({
          total: granTotal,
          items: itemsFormateados,
          status: 'pending',
          type: 'fiber_quote',
          pdf_url: pdfPublicUrl,
          empresa: nombreEmpresa,
          representante: representante,
          email: mailCliente,
          fecha_estimada_entrega: calcularFechaEntrega()
        })
        .eq('referencia', referenciaActual)
        .select()
        .single();
    } else {
      resultado = await supabase
        .from('quotes')
        .insert([{
          referencia: referenciaActual,
          total: granTotal,
          items: itemsFormateados,
          status: 'pending',
          type: 'fiber_quote',
          pdf_url: pdfPublicUrl,
          empresa: nombreEmpresa,
          representante: representante,
          email: mailCliente,
          fecha_estimada_entrega: calcularFechaEntrega()
        }])
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

    doc.setFontSize(16);
    doc.text("TRULINK FIBER LLC", 14, 66);
    doc.setFontSize(10);
    doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 72);
    doc.text("Tel: +507 6640 3720", 14, 78);
    doc.text("www.trulinkfiber.com", 14, 84);
    
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
      startY: 92,
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
    backgroundColor: "#111",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "10px",
    padding: "6px 10px",
    outline: "none",
    textAlign: "center"
  };

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      padding: "20px",
      fontFamily: "sans-serif",
      margin: 0,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px #DAA520; }
          50% { box-shadow: 0 0 30px #DAA520; }
          100% { box-shadow: 0 0 10px #DAA520; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: "1000px", display: "flex", justifyContent: "space-between", marginBottom: "15px", alignItems: "center" }}>
        <button 
          onClick={() => router.back()} 
          style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}
        >
          ⬅ Volver
        </button>
        <span style={{ color: "#FFF", fontSize: "0.9rem" }}>Ref: <strong style={{ color: "#DAA520" }}>{referenciaActual}</strong></span>
      </div>

      <div style={{ textAlign: "center", marginBottom: "20px", maxWidth: "800px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "100px", marginBottom: "10px" }} />
        <h1 style={{ color: "#DAA520", marginBottom: "5px", fontSize: "1.8rem", fontWeight: "bold" }}>
          LÍNEA DE PRODUCCIÓN DE CABLES DE FIBRA
        </h1>
        <p style={{ color: "#FFF", fontSize: "1rem", letterSpacing: "1px" }}>ADSS – ASU – FTTX</p>
      </div>

      <div className="container-fiber" style={{
        backgroundColor: "#050505",
        border: "2px solid #DAA520",
        borderRadius: "20px",
        padding: "20px",
        maxWidth: "1000px",
        width: "100%",
        margin: "0 auto 20px auto"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          
          <div style={{ backgroundColor: "#0c0c0c", borderRadius: "15px", padding: "15px", textAlign: "center", border: "1px solid #DAA520" }}>
            <img src="/images/ASU.png" alt="Cable ASU" style={{ width: "80%", borderRadius: "10px", border: "1px solid #222" }} />
            <h3 style={{ color: "#DAA520", marginTop: "10px", fontSize: "1.2rem" }}>ASU</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Hilos:</label>
                <select id="asuHilos" style={controlStyle}><option value="6">6</option><option value="12">12</option><option value="24">24</option><option value="48">48</option></select>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Carrete:</label>
                <select id="asuCarrete" style={controlStyle}><option value="3">3 km</option></select>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Cant:</label>
                <input
                  id="asuCantidad"
                  type="number"
                  min="1"
                  defaultValue="1"
                  style={{ ...controlStyle, width: "50px" }}
                />
              </div>
            </div>

            <button onClick={() => {
              const hilos = parseInt((document.getElementById("asuHilos") as HTMLSelectElement).value);
              const carrete = parseInt((document.getElementById("asuCarrete") as HTMLSelectElement).value);
              const cantidad = parseInt((document.getElementById("asuCantidad") as HTMLInputElement).value);
              agregarItem("ASU", hilos, carrete, cantidad);
            }} style={{ marginTop: "15px", backgroundColor: "#DAA520", color: "#000", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
              Agregar
            </button>
          </div>

          <div style={{ backgroundColor: "#0c0c0c", borderRadius: "15px", padding: "15px", textAlign: "center", border: "1px solid #DAA520" }}>
            <img src="/images/ADSS.png" alt="Cable ADSS" style={{ width: "80%", borderRadius: "10px", border: "1px solid #222" }} />
            <h3 style={{ color: "#DAA520", marginTop: "10px", fontSize: "1.2rem" }}>ADSS</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Hilos:</label>
                <select id="adssHilos" style={controlStyle}><option value="72">72</option><option value="96">96</option><option value="144">144</option></select>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Carrete:</label>
                <select id="adssCarrete" style={controlStyle}><option value="3">3 km</option></select>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Cant:</label>
                <input
                  id="adssCantidad"
                  type="number"
                  min="1"
                  defaultValue="1"
                  style={{ ...controlStyle, width: "50px" }}
                />
              </div>
            </div>

            <button onClick={() => {
              const hilos = parseInt((document.getElementById("adssHilos") as HTMLSelectElement)?.value || "0");
              const carrete = parseInt((document.getElementById("adssCarrete") as HTMLSelectElement)?.value || "0");
              const cantidad = parseInt((document.getElementById("adssCantidad") as HTMLInputElement)?.value || "0");
              agregarItem("ADSS", hilos, carrete, cantidad);
            }} style={{ marginTop: "15px", backgroundColor: "#DAA520", color: "#000", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
              Agregar
            </button>
          </div>

          <div style={{ backgroundColor: "#0c0c0c", borderRadius: "15px", padding: "15px", textAlign: "center", border: "1px solid #DAA520" }}>
            <img src="/images/FTTX.png" alt="Cable FTTX" style={{ width: "80%", borderRadius: "10px", border: "1px solid #222" }} />
            <h3 style={{ color: "#DAA520", marginTop: "10px", fontSize: "1.2rem" }}>FTTX</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Hilos:</label>
                <select id="fttxHilos" style={controlStyle}><option value="1">1</option><option value="2">2</option></select>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Carrete:</label>
                <select id="fttxCarrete" style={controlStyle}><option value="1">1 km</option><option value="2">2 km</option></select>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ color: "#fff", fontSize: "0.9rem" }}>Cant:</label>
                <input
                  id="fttxCantidad"
                  type="number"
                  min="1"
                  defaultValue="1"
                  style={{ ...controlStyle, width: "50px" }}
                />
              </div>
            </div>

            <button onClick={() => {
              const hilos = parseInt((document.getElementById("fttxHilos") as HTMLSelectElement)?.value || "0");
              const carrete = parseInt((document.getElementById("fttxCarrete") as HTMLSelectElement)?.value || "0");
              const cantidad = parseInt((document.getElementById("fttxCantidad") as HTMLInputElement)?.value || "0");
              agregarItem("FTTX", hilos, carrete, cantidad);
            }} style={{ marginTop: "15px", backgroundColor: "#DAA520", color: "#000", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
              Agregar
            </button>
          </div>
        </div>
      </div>

      <div className="container-fiber" style={{
        backgroundColor: "#050505",
        border: "2px solid #DAA520",
        borderRadius: "20px",
        padding: "20px",
        maxWidth: "1000px",
        width: "100%",
        margin: "0 auto"
      }}>
        <h2 style={{ color: "#DAA520", textAlign: "center", marginBottom: "15px" }}>Mi Cotización ({referenciaActual})</h2>
        
        {cotizacion.length === 0 ? (
          <p style={{ textAlign: "center", color: "#FFF", fontSize: "0.9rem" }}>No has agregado artículos aún.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ margin: "0 auto", borderCollapse: "collapse", color: "#DAA520", width: "100%", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#111" }}>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>Desc</th>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>Hilos</th>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>Cant</th>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>P. Unit</th>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>P. Carr</th>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>Total</th>
                  <th style={{ border: "1px solid #DAA520", padding: "8px" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {cotizacion.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: "#0c0c0c" }}>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{item.tipo}</td>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{item.hilos}</td>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{item.cantidad}</td>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>${item.precioMetro.toFixed(2)}</td>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>${item.precioCarrete.toFixed(2)}</td>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>${(item.precioCarrete * item.cantidad).toFixed(2)}</td>
                    <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>
                      <button onClick={() => eliminarItem(index)} style={{ backgroundColor: "#660000", color: "#fff", border: "none", borderRadius: "5px", padding: "4px 8px", cursor: "pointer" }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "15px", color: "#FFF", fontSize: "0.85rem", borderTop: "1px dashed #DAA520", paddingTop: "10px" }}>
          <p style={{ margin: "4px 0" }}><strong>Precios:</strong> EXW PANAMÁ</p>
          <p style={{ margin: "4px 0" }}><strong>NOTA:</strong> Esta cotización es válida por 15 días a partir de la fecha de emisión.</p>
          <p style={{ margin: "4px 0" }}><strong>Forma de pago:</strong> 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.</p>
          <p style={{ margin: "4px 0" }}><strong>MÉTODOS DE PAGO:</strong> YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES</p>
        </div>

        <h2 style={{ marginTop: "15px", color: "#DAA520", textAlign: "center", fontSize: "1.2rem" }}>
          TOTAL GENERAL: ${granTotal.toFixed(2)}
        </h2>

        <div style={{ textAlign: "center", marginTop: "15px", display: "flex", justifyContent: "center", gap: "15px" }}>
          <button onClick={generarPDF} style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
            Guardar PDF
          </button>
          <button onClick={procesarPago} style={{ backgroundColor: "#222", color: "#DAA520", border: "2px solid #DAA520", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}>
            Proceder con Pago
          </button>
        </div>
      </div>

      <p style={{ marginTop: "20px", fontSize: "10px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}