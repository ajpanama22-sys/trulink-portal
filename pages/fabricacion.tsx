import { useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Definimos el tipo de cada ítem de cotización
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
  // useState tipado con Item[]
  const [cotizacion, setCotizacion] = useState<Item[]>([]);

  const precios: Record<string, number> = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

  // Tipamos los parámetros y el retorno
  const agregarItem = (tipo: string, hilos: number, longitudKm: number, cantidad: number): void => {
    const precioMetro = precios[tipo];
    const precioCarrete = precioMetro * (longitudKm * 1000);
    const nuevoItem: Item = { tipo, hilos, longitudKm, cantidad, precioMetro, precioCarrete };
    setCotizacion([...cotizacion, nuevoItem]);
  };

  // Tipamos el índice como number
  const eliminarItem = (index: number): void => {
    const nuevaCotizacion = cotizacion.filter((_, i) => i !== index);
    setCotizacion(nuevaCotizacion);
  };

  // Tipamos el acumulador y el item
  const granTotal = cotizacion.reduce((acc: number, item: Item) => acc + (item.precioCarrete * item.cantidad), 0);

  const procesarPago = async () => {
    const { data, error } = await supabase
      .from('orders')
      .insert([{ 
        total_amount: granTotal, 
        items: cotizacion,
        status: 'pending' 
      }])
      .select()
      .single();

    if (error) {
      alert("Error al iniciar el proceso de pago. Intenta de nuevo.");
      console.error(error);
    } else {
      router.push(`/checkout?id=${data.id}`);
    }
  };

  const generarPDF = (): void => {
    const doc = new jsPDF();

    // Logo arriba
    doc.addImage("/images/logo.png", "PNG", 14, 10, 40, 20);

    // Número de cotización, fecha y hora (lado derecho)
    doc.setFontSize(10);
    doc.text(`Cotización Nº: QT-${Math.floor(Math.random() * 100000)}`, 150, 20);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 26);
    doc.text(`Hora: ${new Date().toLocaleTimeString()}`, 150, 32);

    // Encabezado empresa debajo del logo
    doc.setFontSize(16);
    doc.text("TRULINK FIBER LLC", 14, 40);
    doc.setFontSize(10);
    doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 46);
    doc.text("Tel: +507 6640 3720", 14, 52);
    doc.text("www.trulinkfiber.com", 14, 58);

    // Tabla de cotización
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
      startY: 70,
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [218, 165, 32] }
    });

    // Total cotización (lado derecho)
    doc.setFontSize(12);
    doc.text(`TOTAL : $${granTotal.toFixed(2)}`, 150, (doc as any).lastAutoTable.finalY + 10);

    // Precios y nota
    doc.setFontSize(10);
    doc.text("Precios: EXW PANAMÁ", 14, (doc as any).lastAutoTable.finalY + 20);
    doc.text("NOTA: Esta cotización es válida por 15 días a partir de la fecha de emisión.", 14, (doc as any).lastAutoTable.finalY + 26);

    // Métodos de pago centrados
    doc.text("MÉTODOS DE PAGO: YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES", 105, (doc as any).lastAutoTable.finalY + 40, { align: "center" });

    // Firma con proporción correcta
    const firma = "/images/firmaco.png";
    const props = doc.getImageProperties(firma);
    const firmaWidth = 40; // ancho en mm
    const firmaHeight = (props.height * firmaWidth) / props.width;

    doc.addImage(firma, "PNG", 150, (doc as any).lastAutoTable.finalY + 55, firmaWidth, firmaHeight);

    // Guardar PDF
    doc.save("Cotizacion_TrulinkFiber.pdf");
  };

  // Estilos reutilizables para inputs y selects
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
      
      {/* Estilos globales para forzar fondo negro y animación de fibra óptica */}
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

      {/* Header e Identidad Visual - Compactado */}
      <div style={{ textAlign: "center", marginBottom: "20px", maxWidth: "800px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "100px", marginBottom: "10px" }} />
        <h1 style={{ color: "#DAA520", marginBottom: "5px", fontSize: "1.8rem", fontWeight: "bold" }}>
          LÍNEA DE PRODUCCIÓN DE CABLES DE FIBRA
        </h1>
        <p style={{ color: "#FFF", fontSize: "1rem", letterSpacing: "1px" }}>ADSS – ASU – FTTX</p>
      </div>

      {/* Catálogo en tarjetas - Anchos reducidos */}
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
          
          {/* Tarjeta ASU */}
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

          {/* Tarjeta ADSS */}
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

          {/* Tarjeta FTTX */}
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

      {/* Contenedor de la Cotización - Centrado y Compacto */}
      <div className="container-fiber" style={{
        backgroundColor: "#050505",
        border: "2px solid #DAA520",
        borderRadius: "20px",
        padding: "20px",
        maxWidth: "1000px",
        width: "100%",
        margin: "0 auto"
      }}>
        <h2 style={{ color: "#DAA520", textAlign: "center", marginBottom: "15px" }}>Mi Cotización</h2>
        
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

        <h2 style={{ marginTop: "15px", color: "#DAA520", textAlign: "center", fontSize: "1.2rem" }}>
          TOTAL GENERAL: ${granTotal.toFixed(2)}
        </h2>

        {/* Botones de acción */}
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
