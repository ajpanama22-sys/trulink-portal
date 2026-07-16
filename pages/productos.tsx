import { useState } from "react";

// Definimos el tipo de los productos del carrito
type ItemCarrito = {
  nombre: string;
  cantidad: number;
};

export default function Productos() {
  // Estado del carrito tipado
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
    <div className="productos-container">
      {/* Logo en la parte superior */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" className="logo" />

      <h1 className="titulo">PRODUCTOS TERMINADOS</h1>
      <p className="subtitulo">Accesorios – Cables – Herrajes</p>

      {/* Opciones principales */}
      <div className="opciones">
        <div className="opcion-card" onClick={() => agregarAlCarrito("Accesorio NAP", 1)}>
          <img src="/images/nap.png" alt="Accesorios" />
          <h2>Accesorios</h2>
        </div>

        <div className="opcion-card" onClick={() => agregarAlCarrito("Cable Patch", 2)}>
          <img src="/images/patch.png" alt="Cables" />
          <h2>Cables</h2>
        </div>

        <div className="opcion-card" onClick={() => agregarAlCarrito("Herraje D-Type", 3)}>
          <img src="/images/dtype.png" alt="Herrajes" />
          <h2>Herrajes</h2>
        </div>
      </div>

      {/* Carrito global */}
      <div className="carrito">
        <h2>Mi Cotización</h2>
        {carrito.length === 0 ? (
          <p>No has agregado productos aún.</p>
        ) : (
          <>
            <ul>
              {carrito.map((item, index) => (
                <li key={index}>
                  {item.nombre} – Cantidad: {item.cantidad}
                  <button onClick={() => eliminarDelCarrito(index)} style={{ marginLeft: "10px" }}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={vaciarCarrito} style={{ marginTop: "10px" }}>
              Vaciar carrito
            </button>
          </>
        )}
      </div>

      {/* Sello Premium */}
      <img src="/images/premium.png" alt="Premium Seal" className="premium-seal" />
    </div>
  );
}
