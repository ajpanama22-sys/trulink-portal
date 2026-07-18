import { useState, useEffect } from "react";
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

  // ➕ Agregar producto al carrito
  const agregarAlCarrito = (sku: string, nombre: string, cantidad: number, precio: number) => {
    setCarrito([...carrito, { SKU: sku, nombre: nombre, cantidad: cantidad, precio: precio }]);
  };

  // ❌ Eliminar producto por índice
  const eliminarDelCarrito = (index: number) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  // 🗑 Vaciar todo el carrito
  const vaciarCarrito = () => {
    setCarrito([]);
  };

  // Cargar productos de Supabase
  const seleccionarCategoria = async (tabla: string) => {
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) {
      console.error("Error al cargar productos de la tabla:", tabla, error);
    } else {
      setProductos(data || []);
      setCategoria(tabla);
    }
  };

  return (
    <div style={{
      backgroundColor: "#000",
      color: "#DAA520",
      minHeight: "100vh",
      padding: "40px",
      fontFamily: "sans-serif"
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
        .opcion-card:hover {
          transform: scale(1.05);
          cursor: pointer;
        }
      `}</style>

      {/* Logo y Títulos */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />
        <h1 style={{ color: "#DAA520", fontSize: "2.5rem" }}>{categoria ? categoria.toUpperCase() : "PRODUCTOS TERMINADOS"}</h1>
        <p style={{ color: "#FFF", fontSize: "1.2rem" }}>Accesorios – Cables – Herrajes</p>
      </div>

      {!categoria ? (
        /* Opciones principales de navegación */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "30px",
          maxWidth: "1000px",
          margin: "0 auto 40px auto"
        }}>
          {[
            { name: "Accesorios", img: "/images/nap.png", tabla: "accesoriosdb" },
            { name: "Cables", img: "/images/patch.png", tabla: "cabledb" },
            { name: "Herrajes", img: "/images/dtype.png", tabla: "herrajesdb" }
          ].map((cat, idx) => (
            <div key={idx} className="opcion-card container-fiber" onClick={() => seleccionarCategoria(cat.tabla)} style={{
              backgroundColor: "#050505",
              padding: "20px",
              borderRadius: "20px",
              border: "2px solid #DAA520",
              textAlign: "center",
              transition: "0.3s"
            }}>
              <img src={cat.img} alt={cat.name} style={{ width: "100%", borderRadius: "10px" }} />
              <h2 style={{ color: "#DAA520", marginTop: "15px" }}>{cat.name}</h2>
            </div>
          ))}
        </div>
      ) : (
        /* Vista de Productos de la Categoría */
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <button onClick={() => setCategoria(null)} style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "20px" }}>
            ⬅ Volver a Categorías
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            {productos.map((prod) => (
              <div key={prod.SKU} style={{ backgroundColor: "#050505", padding: "15px", borderRadius: "15px", border: "1px solid #DAA520", textAlign: "center" }}>
                {prod.image_url ? (
                  <img src={prod.image_url} alt={prod.Ítem} style={{ width: "100%", height: "150px", objectFit: "contain", borderRadius: "10px", marginBottom: "10px" }} />
                ) : (
                  <div style={{ width: "100%", height: "150px", backgroundColor: "#111", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", marginBottom: "10px", color: "#333" }}>Sin imagen</div>
                )}
                <h3 style={{ color: "#DAA520", margin: "5px 0" }}>{prod.SKU}</h3>
                <p style={{ fontSize: "1rem", fontWeight: "bold", margin: "5px 0" }}>{prod.Ítem}</p>
                <p style={{ fontSize: "0.8rem", margin: "5px 0" }}>{prod.Descripción}</p>
                <p style={{ fontSize: "0.7rem", color: "#aaa", margin: "5px 0" }}>{prod.Especificaciones}</p>
                <p style={{ color: prod.estado_inventario === 'disponible' ? "#0f0" : "#f00", margin: "5px 0" }}>{prod.estado_inventario}</p>
                <button onClick={() => agregarAlCarrito(prod.SKU, prod.Ítem, 1, prod.precio)} style={{ backgroundColor: "#DAA520", border: "none", padding: "8px", borderRadius: "5px", cursor: "pointer", marginTop: "10px" }}>
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carrito global - siempre visible */}
      <div className="container-fiber" style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "30px",
        borderRadius: "30px",
        border: "2px solid #DAA520",
        backgroundColor: "#050505"
      }}>
        <h2 style={{ textAlign: "center" }}>Mi Cotización</h2>
        {carrito.length === 0 ? (
          <p style={{ textAlign: "center" }}>No has agregado productos aún.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ul style={{ width: "100%", padding: 0 }}>
              {carrito.map((item, index) => (
                <li key={index} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px",
                  borderBottom: "1px solid #333"
                }}>
                  {item.SKU} - {item.nombre} – Cantidad: {item.cantidad}
                  <button onClick={() => eliminarDelCarrito(index)} style={{
                    backgroundColor: "#b30000", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px", cursor: "pointer"
                  }}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={vaciarCarrito} style={{
              marginTop: "20px", backgroundColor: "#DAA520", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer"
            }}>
              Vaciar carrito
            </button>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <img src="/images/premium.png" alt="Premium Seal" style={{ width: "100px" }} />
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
