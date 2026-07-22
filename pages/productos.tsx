import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Producto = {
  SKU: string;
  Ítem: string;
  Familia: string;
  Descripción: string;
  Especificaciones: string;
  precio_a: number;
  precio_b: number;
  precio_c: number;
  precio_d: number;
  estado_inventario: string;
  image_url?: string;
};

type ItemCarrito = {
  SKU: string;
  nombre: string;
  cantidad: number;
  precio: number;
  descripcion?: string;
};

export default function Productos() {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Estados para los datos del cliente automatizados
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [representante, setRepresentante] = useState("");
  const [mailCliente, setMailCliente] = useState("");

  useEffect(() => {
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

  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCotizacion = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  const handleCantidadChange = (sku: string, valor: number) => {
    setCantidades({ ...cantidades, [sku]: valor });
  };

  const agregarAlCarrito = (prod: Producto) => {
    const qty = cantidades[prod.SKU] || 1;
    const precioSeleccionado = prod.precio_a || 0;
    setCarrito([...carrito, { SKU: prod.SKU, nombre: prod.Descripción || prod.Ítem, cantidad: qty, precio: precioSeleccionado, descripcion: prod.Descripción }]);
    setCantidades({ ...cantidades, [prod.SKU]: 1 });
  };

  const eliminarDelCarrito = (index: number) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const calcularFechaEntrega = () => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 3); // 3 días por defecto para productos terminados
    return hoy.toISOString().split('T')[0];
  };

  const guardarCotizacionEnSupabase = async (referenciaUnica: string, pdfPublicUrl: string) => {
    const itemsFormateados = carrito.map(item => ({
      SKU: item.SKU,
      descripcion: item.nombre || item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precio,
      total: item.precio * item.cantidad
    }));

    const { data, error } = await supabase
      .from('quotes')
      .insert([{ 
        referencia: referenciaUnica,
        total: totalCotizacion, 
        items: itemsFormateados,
        status: 'pending',
        type: 'producto',
        pdf_url: pdfPublicUrl,
        empresa: nombreEmpresa,
        representante: representante,
        email: mailCliente,
        fecha_estimada_entrega: calcularFechaEntrega()
      }])
      .select()
      .single();

    if (error) {
      console.error("ERROR DETALLADO DE SUPABASE:", error);
      throw new Error(error.message);
    }
    return data;
  };

  const procesarPago = async () => {
    if (carrito.length === 0) {
      alert("La cotización está vacía. Por favor, agregue artículos.");
      return;
    }

    try {
      const referenciaUnica = `QT-${Date.now().toString().slice(-6)}`;
      const fechaActual = new Date().toLocaleDateString();
      const horaActual = new Date().toLocaleTimeString();

      const doc = new jsPDF();
      doc.addImage("/images/logo.png", "PNG", 14, 10, 40, 20);
      
      doc.setFontSize(10);
      doc.text(`Referencia: ${referenciaUnica}`, 150, 20);
      doc.text(`Fecha: ${fechaActual}`, 150, 26);
      doc.text(`Hora: ${horaActual}`, 150, 32);

      // Datos del Cliente (Exactamente en el recuadro superior izquierdo)
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
      
      const rows = carrito.map(item => [
        item.SKU, 
        item.nombre, 
        item.cantidad.toString(), 
        `$${item.precio.toFixed(2)}`, 
        `$${(item.precio * item.cantidad).toFixed(2)}`
      ]);
      
      (doc as any).autoTable({
        head: [["SKU", "Descripción", "Cant", "P. Unitario", "Total"]],
        body: rows,
        startY: 92,
        styles: { fontSize: 10, halign: "center" },
        headStyles: { fillColor: [218, 165, 32] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text(`TOTAL : $${totalCotizacion.toFixed(2)}`, 150, finalY);

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

      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaUnica}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      const data = await guardarCotizacionEnSupabase(referenciaUnica, pdfPublicUrl);
      router.push(`/checkout?id=${data.id}`);

    } catch (err: any) {
      console.error("ERROR INESPERADO:", err);
      alert(`Ocurrió un error al procesar la solicitud: ${err.message || err}`);
    }
  };

  const generarPDF = async () => {
    if (carrito.length === 0) {
      alert("La cotización está vacía.");
      return;
    }

    const referenciaUnica = `QT-${Date.now().toString().slice(-6)}`;
    const fechaActual = new Date().toLocaleDateString();
    const horaActual = new Date().toLocaleTimeString();

    const doc = new jsPDF();
    doc.addImage("/images/logo.png", "PNG", 14, 10, 40, 20);
    
    doc.setFontSize(10);
    doc.text(`Referencia: ${referenciaUnica}`, 150, 20);
    doc.text(`Fecha: ${fechaActual}`, 150, 26);
    doc.text(`Hora: ${horaActual}`, 150, 32);

    // Datos del Cliente
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
    
    const rows = carrito.map(item => [
      item.SKU, 
      item.nombre, 
      item.cantidad.toString(), 
      `$${item.precio.toFixed(2)}`, 
      `$${(item.precio * item.cantidad).toFixed(2)}`
    ]);
    
    (doc as any).autoTable({
      head: [["SKU", "Descripción", "Cant", "P. Unitario", "Total"]],
      body: rows,
      startY: 92,
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [218, 165, 32] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`TOTAL : $${totalCotizacion.toFixed(2)}`, 150, finalY);

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

    try {
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaUnica}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      await guardarCotizacionEnSupabase(referenciaUnica, pdfPublicUrl);
      doc.save(`${referenciaUnica}_TrulinkFiber.pdf`);
    } catch (err) {
      doc.save(`${referenciaUnica}_TrulinkFiber.pdf`);
    }
  };

  const seleccionarCategoria = async (tabla: string) => {
    const { data, error } = await supabase.from(tabla).select("*");
    if (!error) {
      setProductos(data || []);
      setCategoria(tabla);
    }
  };

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        .image-zoom { transition: transform 0.3s, box-shadow 0.3s; }
        .image-zoom:hover { transform: scale(1.08); box-shadow: 0 0 20px 5px #DAA520; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #DAA520; padding: 12px; text-align: center; color: #FFF; }
        th { background-color: #DAA520; color: #000; }
      `}</style>

      {/* Botón superior de Volver y Carrito */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button 
          onClick={() => router.back()} 
          style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}
        >
          ⬅ Volver
        </button>
        <button 
          onClick={() => document.getElementById('carrito-seccion')?.scrollIntoView({ behavior: 'smooth' })} 
          style={{ backgroundColor: "#DAA520", color: "#000", padding: "15px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}
        >
          🛒 Carrito ({totalItems})
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px" }} />
        <h1>{categoria ? categoria.toUpperCase() : "PRODUCTOS TERMINADOS"}</h1>
      </div>

      {!categoria ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "30px", maxWidth: "1000px", margin: "0 auto" }}>
          {[
            { name: "Accesorios", img: "/images/nap.png", tabla: "accesoriosdb" },
            { name: "Cables", img: "/images/patch.png", tabla: "cablesdb" },
            { name: "Herrajes", img: "/images/dtype.png", tabla: "herrajesdb" }
          ].map((cat, idx) => (
            <div key={idx} onClick={() => seleccionarCategoria(cat.tabla)} style={{ backgroundColor: "#050505", padding: "20px", borderRadius: "20px", border: "2px solid #DAA520", textAlign: "center", cursor: "pointer" }}>
              <img src={cat.img} alt={cat.name} style={{ width: "100%", borderRadius: "10px" }} />
              <h2>{cat.name}</h2>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <button onClick={() => setCategoria(null)} style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "20px" }}>⬅ Volver</button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            {productos.map((prod) => (
              <div key={prod.SKU} style={{ backgroundColor: "#050505", padding: "15px", borderRadius: "15px", border: "1px solid #DAA520", textAlign: "center" }}>
                <img src={prod.image_url || "/placeholder.png"} alt={prod.Ítem} className="image-zoom" onClick={() => setProductoSeleccionado(prod)} style={{ width: "100%", height: "150px", objectFit: "contain", borderRadius: "10px", marginBottom: "10px" }} />
                <h3>{prod.SKU}</h3>
                <p><strong>{prod.Ítem}</strong></p>
                <p style={{ fontSize: "0.9rem", color: "#DAA520", margin: "5px 0" }}>Precio: ${prod.precio_a?.toFixed(2) || "0.00"}</p>
                <input type="number" min="1" value={cantidades[prod.SKU] || 1} onChange={(e) => handleCantidadChange(prod.SKU, parseInt(e.target.value) || 1)} style={{ width: "50px", marginBottom: "5px", backgroundColor: "#111", color: "#DAA520" }} />
                <button onClick={() => agregarAlCarrito(prod)} style={{ backgroundColor: "#DAA520", border: "none", padding: "8px", borderRadius: "5px", cursor: "pointer", display: "block", margin: "0 auto" }}>Agregar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div id="carrito-seccion" style={{ maxWidth: "900px", margin: "60px auto", padding: "30px", borderRadius: "20px", border: "2px solid #DAA520", backgroundColor: "#050505" }}>
        <h2 style={{ textAlign: "center", color: "#DAA520" }}>Mi Cotización</h2>
        {carrito.length === 0 ? (
          <p style={{ textAlign: "center", color: "#FFF" }}>El carrito está vacío.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Descripción</th>
                  <th>Cant</th>
                  <th>P. Unitario</th>
                  <th>Total</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {carrito.map((item, index) => (
                  <tr key={index}>
                    <td>{item.SKU}</td>
                    <td>{item.nombre}</td>
                    <td>{item.cantidad}</td>
                    <td>${item.precio.toFixed(2)}</td>
                    <td>${(item.precio * item.cantidad).toFixed(2)}</td>
                    <td><button onClick={() => eliminarDelCarrito(index)} style={{ backgroundColor: "#b30000", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", paddingRight: "15px" }}>
              <h2 style={{ color: "#DAA520", margin: 0, fontSize: "1.2rem" }}>TOTAL : ${totalCotizacion.toFixed(2)}</h2>
            </div>

            <div style={{ marginTop: "15px", color: "#FFF", fontSize: "0.85rem", borderTop: "1px dashed #DAA520", paddingTop: "10px" }}>
              <p style={{ margin: "4px 0" }}><strong>Precios:</strong> EXW PANAMÁ</p>
              <p style={{ margin: "4px 0" }}><strong>NOTA:</strong> Esta cotización es válida por 15 días a partir de la fecha de emisión.</p>
              <p style={{ margin: "4px 0" }}><strong>Forma de pago:</strong> 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.</p>
              <p style={{ margin: "4px 0" }}><strong>MÉTODOS DE PAGO:</strong> YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES</p>
            </div>
            
            <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "20px" }}>
              <button onClick={generarPDF} style={{ backgroundColor: "#DAA520", color: "#000", fontWeight: "bold", padding: "15px 30px", borderRadius: "10px", border: "none", cursor: "pointer" }}>GUARDAR PDF</button>
              <button onClick={procesarPago} style={{ backgroundColor: "#DAA520", color: "#000", fontWeight: "bold", padding: "15px 30px", borderRadius: "10px", border: "none", cursor: "pointer" }}>Proceder con Pago</button>
            </div>
            <button onClick={vaciarCarrito} style={{ marginTop: "10px", width: "100%", backgroundColor: "#333", color: "#FFF", border: "none", padding: "5px", cursor: "pointer" }}>Vaciar carrito</button>
          </>
        )}
      </div>
    </div>
  );
}