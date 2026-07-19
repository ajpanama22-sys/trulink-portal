import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Inicialización de cliente Supabase
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
  const [categoria, setCategoria] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [cantidadTemp, setCantidadTemp] = useState(1);

  const agregarAlCarrito = (prod: Producto, cant: number) => {
    setCarrito([...carrito, { SKU: prod.SKU, nombre: prod.Ítem, cantidad: cant, precio: prod.precio }]);
    setCantidadTemp(1);
  };

  const eliminarDelCarrito = (index: number) => setCarrito(carrito.filter((_, i) => i !== index));
  const vaciarCarrito = () => setCarrito([]);
  const totalCotizacion = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

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
        <button onClick={() => setProductoSeleccionado(null)} style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "20px" }}>⬅ Volver a la lista</button>
        <div style={{ maxWidth: "600px", margin: "0 auto", border: "2px solid #DAA520", padding: "30px", borderRadius: "20px", textAlign: "center", backgroundColor: "#050505" }}>
          <img src={productoSeleccionado.image_url || "/placeholder.png"} alt={productoSeleccionado.Ítem} style={{ width: "100%", borderRadius: "10px", marginBottom: "20px" }} />
          <h1 style={{ color: "#DAA520" }}>{productoSeleccionado.Ítem}</h1>
          <p style={{ color: "#FFF" }}><strong>SKU:</strong> {productoSeleccionado.SKU}</p>
          <p style={{ color: "#FFF" }}><strong>Descripción:</strong> {productoSeleccionado.Descripción}</p>
          <p style={{ color: "#FFF" }}><strong>Especificaciones:</strong> {productoSeleccionado.Especificaciones}</p>
          <p style={{ fontSize: "1.8rem", margin: "20px 0" }}><strong>Precio:</strong> ${productoSeleccionado.precio ? productoSeleccionado.precio.toFixed(2) : "0.00"}</p>
          <div style={{ margin: "20px 0" }}>
            <label>Cantidad: </label>
            <input type="number" min="1" value={cantidadTemp} onChange={(e) => setCantidadTemp(parseInt(e.target.value) || 1)} style={{ width: "60px", padding: "5px", backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520" }} />
          </div>
          <button onClick={() => agregarAlCarrito(productoSeleccionado, cantidadTemp)} style={{ backgroundColor: "#DAA520", border: "none", padding: "15px 40px", borderRadius: "10px", cursor: "pointer", fontSize: "1.1rem", fontWeight: "bold" }}>
            Agregar al Carrito
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        .image-zoom { transition: transform 0.3s, box-shadow 0.3s; }
        .image-zoom:hover { transform: scale(1.08); box-shadow: 0 0 20px 5px #DAA520; cursor: pointer; }
        .container-fiber { animation: pulse-border 2s infinite; }
        @keyframes pulse-border { 0% { box-shadow: 0 0 10px #DAA520; } 50% { box-shadow: 0 0 30px #DAA520; } 100% { box-shadow: 0 0 10px #DAA520; } }
        .float-cart { position: fixed; top: 20px; right: 20px; z-index: 1000; }
      `}</style>

      <button className="float-cart" onClick={() => setMostrarCarrito(!mostrarCarrito)} style={{ backgroundColor: "#DAA520", color: "#000", padding: "15px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
        🛒 Ver Carrito ({carrito.length})
      </button>

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
            <div key={idx} className="container-fiber" onClick={() => seleccionarCategoria(cat.tabla)} style={{ backgroundColor: "#050505", padding: "20px", borderRadius: "20px", border: "2px solid #DAA520", textAlign: "center", cursor: "pointer" }}>
              <img src={cat.img} alt={cat.name} style={{ width: "100%", borderRadius: "10px" }} />
              <h2>{cat.name}</h2>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <button onClick={() => setCategoria(null)} style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "20px" }}>⬅ Volver a Categorías</button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            {productos.map((prod) => (
              <div key={prod.SKU} style={{ backgroundColor: "#050505", padding: "15px", borderRadius: "15px", border: "1px solid #DAA520", textAlign: "center" }}>
                <img src={prod.image_url || "/placeholder.png"} alt={prod.Ítem} className="image-zoom" onClick={() => setProductoSeleccionado(prod)} style={{ width: "100%", height: "150px", objectFit: "contain", borderRadius: "10px", marginBottom: "10px" }} />
                <h3>{prod.SKU}</h3>
                <p><strong>{prod.Ítem}</strong></p>
                <p>${prod.precio ? prod.precio.toFixed(2) : "0.00"}</p>
                <button onClick={() => agregarAlCarrito(prod, 1)} style={{ backgroundColor: "#DAA520", border: "none", padding: "8px", borderRadius: "5px", cursor: "pointer" }}>Agregar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrarCarrito && (
        <div style={{ maxWidth: "600px", margin: "40px auto", padding: "30px", borderRadius: "30px", border: "2px solid #DAA520", backgroundColor: "#050505" }}>
          <h2 style={{ textAlign: "center" }}>Mi Cotización</h2>
          {carrito.map((item, index) => (
            <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #333" }}>
              {item.nombre} x {item.cantidad} - ${ (item.precio * item.cantidad).toFixed(2) }
              <button onClick={() => eliminarDelCarrito(index)} style={{ backgroundColor: "#b30000", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}>Eliminar</button>
            </div>
          ))}
          <h3 style={{ textAlign: "center", marginTop: "20px" }}>Total: ${totalCotizacion.toFixed(2)}</h3>
          <button onClick={vaciarCarrito} style={{ marginTop: "20px", backgroundColor: "#DAA520", border: "none", padding: "10px", cursor: "pointer", width: "100%" }}>Vaciar carrito</button>
        </div>
      )}
    </div>
  );
}
