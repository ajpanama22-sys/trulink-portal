import { useState } from "react";
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
  precio: number;
  estado_inventario: string;
  image_url?: string;
};

type ItemCarrito = {
  SKU: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

export default function Productos() {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCotizacion = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  const handleCantidadChange = (sku: string, valor: number) => {
    setCantidades({ ...cantidades, [sku]: valor });
  };

  const agregarAlCarrito = (prod: Producto) => {
    const qty = cantidades[prod.SKU] || 1;
    setCarrito([...carrito, { SKU: prod.SKU, nombre: prod.Descripción, cantidad: qty, precio: prod.precio }]);
    setCantidades({ ...cantidades, [prod.SKU]: 1 });
  };

  const eliminarDelCarrito = (index: number) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const procesarPago = async () => {
    const { data, error } = await supabase
      .from('orders')
      .insert([{ 
        total_amount: totalCotizacion, 
        items: carrito,
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

  const generarPDF = () => {
    const doc = new jsPDF();
    doc.addImage("/images/logo.png", "PNG", 14, 10, 40, 20);
    doc.setFontSize(10);
    doc.text(`Cotización Nº: QT-${Date.now().toString().slice(-5)}`, 150, 20);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 26);
    doc.setFontSize(16);
    doc.text("TRULINK FIBER LLC", 14, 40);
    
    const rows = carrito.map(item => [item.SKU, item.nombre, item.cantidad.toString(), `$${item.precio.toFixed(2)}`, `$${(item.precio * item.cantidad).toFixed(2)}`]);
    
    (doc as any).autoTable({
      head: [["SKU", "Descripción", "Cant", "P. Unitario", "Total"]],
      body: rows,
      startY: 70,
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [218, 165, 32] }
    });

    doc.text(`TOTAL GENERAL: $${totalCotizacion.toFixed(2)}`, 150, (doc as any).lastAutoTable.finalY + 10);
    doc.save("Cotizacion_TrulinkFiber.pdf");
  };

  const seleccionarCategoria = async (tabla: string) => {
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) {
      console.error("Error al cargar productos:", error);
    } else {
      setProductos(data || []);
      setCategoria(tabla);
    }
  };

  if (productoSeleccionado) {
    return (
      <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
        <button onClick={() => setProductoSeleccionado(null)} style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "20px" }}>⬅ Volver</button>
        <div style={{ maxWidth: "600px", margin: "0 auto", border: "2px solid #DAA520", padding: "30px", borderRadius: "20px", textAlign: "center", backgroundColor: "#050505" }}>
          <img src={productoSeleccionado.image_url || "/placeholder.png"} alt={productoSeleccionado.Ítem} style={{ width: "100%", borderRadius: "10px", marginBottom: "20px" }} />
          <h1 style={{ color: "#DAA520" }}>{productoSeleccionado.Ítem}</h1>
          <p style={{ color: "#FFF" }}><strong>SKU:</strong> {productoSeleccionado.SKU}</p>
          <p style={{ color: "#FFF" }}><strong>Descripción:</strong> {productoSeleccionado.Descripción}</p>
          <p style={{ color: "#FFF" }}><strong>Especificaciones:</strong> {productoSeleccionado.Especificaciones}</p>
          <p style={{ fontSize: "1.8rem", margin: "20px 0" }}><strong>Precio:</strong> ${productoSeleccionado.precio ? productoSeleccionado.precio.toFixed(2) : "0.00"}</p>
          <div style={{ margin: "20px 0" }}>
            <label>Cantidad: </label>
            <input type="number" min="1" value={cantidades[productoSeleccionado.SKU] || 1} onChange={(e) => handleCantidadChange(productoSeleccionado.SKU, parseInt(e.target.value) || 1)} style={{ width: "60px", padding: "5px", backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520" }} />
          </div>
          <button onClick={() => agregarAlCarrito(productoSeleccionado)} style={{ backgroundColor: "#DAA520", border: "none", padding: "15px 40px", borderRadius: "10px", cursor: "pointer", fontSize: "1.1rem", fontWeight: "bold" }}>Agregar al Carrito</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        .image-zoom { transition: transform 0.3s, box-shadow 0.3s; }
        .image-zoom:hover { transform: scale(1.08); box-shadow: 0 0 20px 5px #DAA520; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #DAA520; padding: 12px; text-align: center; color: #FFF; }
        th { background-color: #DAA520; color: #000; }
      `}</style>

      <div style={{ textAlign: "right", marginBottom: "20px" }}>
        <button onClick={() => document.getElementById('carrito-seccion')?.scrollIntoView({ behavior: 'smooth' })} style={{ backgroundColor: "#DAA520", color: "#000", padding: "15px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
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
            <h2 style={{ textAlign: "center", marginTop: "20px", color: "#DAA520" }}>TOTAL GENERAL: ${totalCotizacion.toFixed(2)}</h2>
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
