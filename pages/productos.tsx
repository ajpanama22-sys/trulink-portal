import { useState } from "react";

// Definimos el tipo de los productos del carrito
type ItemCarrito = {
  nombre: string;
  cantidad: number;
};

export default function Productos() {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);

  // ➕ Agregar producto al carrito
  const agregarAlCarrito = (nombre: string, cantidad: number) => {
    setCarrito([...carrito, { nombre, cantidad }]);
  };

  // ❌ Eliminar producto por índice
  const eliminarDelCarrito = (index: number) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  // 🗑 Vaciar todo el carrito
  const vaciarCarrito = () => {
    setCarrito([]);
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
        <h1 style={{ color: "#DAA520", fontSize: "2.5rem" }}>PRODUCTOS TERMINADOS</h1>
        <p style={{ color: "#FFF", fontSize: "1.2rem" }}>Accesorios – Cables – Herrajes</p>
      </div>

      {/* Opciones principales */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
        gap: "30px", 
        maxWidth: "1000px", 
        margin: "0 auto 40px auto" 
      }}>
        {[
          { name: "Accesorio NAP", img: "/images/nap.png", title: "Accesorios" },
          { name: "Cable Patch", img: "/images/patch.png", title: "Cables" },
          { name: "Herraje D-Type", img: "/images/dtype.png", title: "Herrajes" }
        ].map((prod, idx) => (
          <div key={idx} className="opcion-card container-fiber" onClick={() => agregarAlCarrito(prod.name, 1)} style={{ 
            backgroundColor: "#050505", 
            padding: "20px", 
            borderRadius: "20px", 
            border: "2px solid #DAA520", 
            textAlign: "center",
            transition: "0.3s"
          }}>
            <img src={prod.img} alt={prod.title} style={{ width: "100%", borderRadius: "10px" }} />
            <h2 style={{ color: "#DAA520", marginTop: "15px" }}>{prod.title}</h2>
          </div>
        ))}
      </div>

      {/* Carrito global */}
      <div className="container-fiber" style={{ 
        maxWidth: "800px", 
        margin: "0 auto", 
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
                  {item.nombre} – Cantidad: {item.cantidad}
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

      {/* Sello Premium */}
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <img src="/images/premium.png" alt="Premium Seal" style={{ width: "100px" }} />
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}