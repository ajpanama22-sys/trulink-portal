import { useState } from "react";

export default function Productos() {
  const [carrito, setCarrito] = useState([]);

  return (
    <div className="productos-container">
      {/* Logo en la parte superior */}
      <img src="/images/logo.png" alt="Trulink Fiber Logo" className="logo" />

      <h1 className="titulo">PRODUCTOS TERMINADOS</h1>
      <p className="subtitulo">Accesorios – Cables – Herrajes</p>

      {/* Opciones principales */}
      <div className="opciones">
        <div className="opcion-card" onClick={() => alert("Ir a Accesorios")}>
          <img src="/images/nap.png" alt="Accesorios" />
          <h2>Accesorios</h2>
        </div>

        <div className="opcion-card" onClick={() => alert("Ir a Cables")}>
          <img src="/images/patch.png" alt="Cables" />
          <h2>Cables</h2>
        </div>

        <div className="opcion-card" onClick={() => alert("Ir a Herrajes")}>
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
          <ul>
            {carrito.map((item, index) => (
              <li key={index}>
                {item.nombre} – Cantidad: {item.cantidad}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sello Premium */}
      <img src="/images/premium.png" alt="Premium Seal" className="premium-seal" />
    </div>
  );
}
