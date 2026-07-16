import { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function Fabricacion() {
  const [cotizacion, setCotizacion] = useState([]);

  const precios = { ASU: 0.25, ADSS: 0.40, FTTX: 0.15 };

  const agregarItem = (tipo, hilos, longitudKm, cantidad) => {
    const precioMetro = precios[tipo];
    const precioCarrete = precioMetro * (longitudKm * 1000);
    const nuevoItem = { tipo, hilos, longitudKm, cantidad, precioMetro, precioCarrete };
    setCotizacion([...cotizacion, nuevoItem]);
  };

  const eliminarItem = (index) => {
    const nuevaCotizacion = cotizacion.filter((_, i) => i !== index);
    setCotizacion(nuevaCotizacion);
  };

  const granTotal = cotizacion.reduce((acc, item) => acc + (item.precioCarrete * item.cantidad), 0);

  const generarPDF = () => {
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
    item.hilos,
    item.cantidad,
    `$${item.precioMetro.toFixed(2)}`,
    `$${item.precioCarrete.toFixed(2)}`,
    `$${(item.precioCarrete * item.cantidad).toFixed(2)}`
  ]);

  doc.autoTable({
    head: [["Descripción", "Hilos", "Cant", "P. Unitario", "P. Carrete", "Total"]],
    body: rows,
    startY: 70,
    styles: { fontSize: 10, halign: "center" },
    headStyles: { fillColor: [218, 165, 32] }
  });

  // Total cotización (lado derecho)
  doc.setFontSize(12);
  doc.text(`TOTAL : $${granTotal.toFixed(2)}`, 150, doc.lastAutoTable.finalY + 10);

  // Precios y nota
  doc.setFontSize(10);
  doc.text("Precios: EXW PANAMÁ", 14, doc.lastAutoTable.finalY + 20);
  doc.text("NOTA: Esta cotización es válida por 15 días a partir de la fecha de emisión.", 14, doc.lastAutoTable.finalY + 26);

  // Métodos de pago centrados
  doc.text("MÉTODOS DE PAGO: YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES", 105, doc.lastAutoTable.finalY + 40, { align: "center" });

  // Firma con proporción correcta
  const firma = "/images/firmaco.png";
  const props = doc.getImageProperties(firma);
  const firmaWidth = 40; // ancho en mm
  const firmaHeight = (props.height * firmaWidth) / props.width;

  doc.addImage(firma, "PNG", 150, doc.lastAutoTable.finalY + 55, firmaWidth, firmaHeight);

  // Guardar PDF
  doc.save("Cotizacion_TrulinkFiber.pdf");
};

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px" }}>
      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px", display: "block", marginLeft: "auto", marginRight: "auto" }} />
      <h1 style={{ textAlign: "center", color: "#DAA520", marginBottom: "30px" }}>
        LÍNEA DE PRODUCCIÓN DE CABLES DE FIBRA <br /> ADSS – ASU – FTTX
      </h1>
      {/* Catálogo en tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "30px", marginTop: "40px" }}>
        
        {/* Tarjeta ASU */}
<div style={{ backgroundColor: "#111", borderRadius: "12px", padding: "20px", textAlign: "center", border: "1px solid #DAA520" }}>
  <img src="/images/ASU.png" alt="Cable ASU" style={{ width: "100%", borderRadius: "8px" }} />
  <h3 style={{ color: "#DAA520", marginTop: "15px" }}>ASU</h3>
  
  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "10px" }}>
    <label style={{ color: "#fff" }}>Hilos:</label>
    <select id="asuHilos"><option value="6">6</option><option value="12">12</option><option value="24">24</option><option value="48">48</option></select>
    
    <label style={{ color: "#fff" }}>Carrete:</label>
    <select id="asuCarrete"><option value="3">3 km</option></select>
    
    <label style={{ color: "#fff" }}>Cantidad:</label>
    <input id="asuCantidad" type="number" min="1" defaultValue="1" style={{ width: "50px", textAlign: "center" }} onInput={(e) => { if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3); }} />
  </div>

  <button onClick={() => {
    const hilos = parseInt(document.getElementById("asuHilos").value);
    const carrete = parseInt(document.getElementById("asuCarrete").value);
    const cantidad = parseInt(document.getElementById("asuCantidad").value);
    agregarItem("ASU", hilos, carrete, cantidad);
  }} style={{ marginTop: "15px", backgroundColor: "#DAA520", color: "#000", padding: "6px 12px", width: "120px", borderRadius: "8px", cursor: "pointer", display: "block", margin: "15px auto 0" }}>
    Agregar
  </button>
</div>

        {/* Tarjeta ADSS */}
<div style={{ backgroundColor: "#111", borderRadius: "12px", padding: "20px", textAlign: "center", border: "1px solid #DAA520" }}>
  <img src="/images/ADSS.png" alt="Cable ADSS" style={{ width: "100%", borderRadius: "8px" }} />
  <h3 style={{ color: "#DAA520", marginTop: "15px" }}>ADSS</h3>
  
  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "10px" }}>
    <label style={{ color: "#fff" }}>Hilos:</label>
    <select id="adssHilos"><option value="72">72</option><option value="96">96</option><option value="144">144</option></select>
    
    <label style={{ color: "#fff" }}>Carrete:</label>
    <select id="adssCarrete"><option value="3">3 km</option></select>
    
    <label style={{ color: "#fff" }}>Cantidad:</label>
    <input id="adssCantidad" type="number" min="1" defaultValue="1" style={{ width: "50px", textAlign: "center" }} onInput={(e) => { if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3); }} />
  </div>

  <button onClick={() => {
    const hilos = parseInt(document.getElementById("adssHilos").value);
    const carrete = parseInt(document.getElementById("adssCarrete").value);
    const cantidad = parseInt(document.getElementById("adssCantidad").value);
    agregarItem("ADSS", hilos, carrete, cantidad);
  }} style={{ marginTop: "15px", backgroundColor: "#DAA520", color: "#000", padding: "6px 12px", width: "120px", borderRadius: "8px", cursor: "pointer", display: "block", margin: "15px auto 0" }}>
    Agregar
  </button>
</div>

        {/* Tarjeta FTTX */}
<div style={{ backgroundColor: "#111", borderRadius: "12px", padding: "20px", textAlign: "center", border: "1px solid #DAA520" }}>
  <img src="/images/FTTX.png" alt="Cable FTTX" style={{ width: "100%", borderRadius: "8px" }} />
  <h3 style={{ color: "#DAA520", marginTop: "15px" }}>FTTX</h3>

  {/* Contenedor flex para alinear todo horizontalmente */}
  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "10px" }}>
    
    <label style={{ color: "#fff" }}>Hilos:</label>
    <select id="fttxHilos"><option value="1">1</option><option value="2">2</option></select>
    
    <label style={{ color: "#fff" }}>Carrete:</label>
    <select id="fttxCarrete"><option value="1">1 km</option><option value="2">2 km</option></select>
    
    <label style={{ color: "#fff" }}>Cantidad:</label>
    <input 
      id="fttxCantidad" 
      type="number" 
      min="1" 
      defaultValue="1" 
      style={{ width: "50px", textAlign: "center" }} // Tamaño pequeño y centrado
      onInput={(e) => { if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3); }} 
    />
  </div>

  <button onClick={() => {
    const hilos = parseInt(document.getElementById("fttxHilos").value);
    const carrete = parseInt(document.getElementById("fttxCarrete").value);
    const cantidad = parseInt(document.getElementById("fttxCantidad").value);
    agregarItem("FTTX", hilos, carrete, cantidad);
  }} style={{ marginTop: "15px", backgroundColor: "#DAA520", color: "#000", padding: "6px 12px", width: "120px", borderRadius: "8px", cursor: "pointer", display: "block", margin: "15px auto 0" }}>
    Agregar
  </button>
</div>
      </div>
            {/* Cotización */}
      <h2 style={{ marginTop: "40px", color: "#DAA520", textAlign: "center" }}>Mi Cotización</h2>
      {cotizacion.length === 0 ? (
        <p style={{ textAlign: "center" }}>No has agregado artículos aún.</p>
      ) : (
        <table style={{ margin: "0 auto", marginTop: "20px", borderCollapse: "collapse", color: "#DAA520", width: "90%" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>Descripción</th>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>Hilos</th>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>Cant</th>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>P. Unitario</th>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>P. Carrete</th>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>Total</th>
              <th style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {cotizacion.map((item, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>{item.tipo}</td>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>{item.hilos}</td>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>{item.cantidad}</td>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>${item.precioMetro.toFixed(2)}</td>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>${item.precioCarrete.toFixed(2)}</td>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>${(item.precioCarrete * item.cantidad).toFixed(2)}</td>
                <td style={{ border: "1px solid #DAA520", padding: "8px", textAlign: "center" }}>
                  <button onClick={() => eliminarItem(index)} style={{ backgroundColor: "red", color: "#fff", borderRadius: "8px", padding: "5px 10px" }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: "30px", color: "#DAA520", textAlign: "center" }}>
        TOTAL GENERAL: ${granTotal.toFixed(2)}
      </h2>

      {/* Botones de acción */}
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button onClick={generarPDF} style={{ backgroundColor: "#DAA520", color: "#000", padding: "12px 24px", borderRadius: "8px", cursor: "pointer", marginRight: "10px" }}>
          Guardar PDF
        </button>
        <button style={{ backgroundColor: "#444", color: "#fff", padding: "12px 24px", borderRadius: "8px", cursor: "pointer" }}>
          Proceder con Pago
        </button>
      </div>
    </div>
  );
}
