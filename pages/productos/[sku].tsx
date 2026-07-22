import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type ProductoDetalle = {
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

export default function DetalleProducto() {
  const router = useRouter();
  const { sku } = router.query;
  const [producto, setProducto] = useState<ProductoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!sku) return;

    const buscarProducto = async () => {
      setCargando(true);
      // Buscamos en las tres tablas posibles de inventario
      const tablas = ["accesoriosdb", "cablesdb", "herrajesdb"];
      
      for (const tabla of tablas) {
        const { data, error } = await supabase
          .from(tabla)
          .select("*")
          .eq("SKU", sku)
          .single();

        if (data && !error) {
          setProducto(data);
          setCargando(false);
          return;
        }
      }

      setCargando(false);
    };

    buscarProducto();
  }, [sku]);

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      <button 
        onClick={() => router.back()} 
        style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer", marginBottom: "30px" }}
      >
        ⬅ Volver al Catálogo
      </button>

      {cargando ? (
        <div style={{ textAlign: "center", marginTop: "100px", fontSize: "1.2rem" }}>Cargando detalles del producto...</div>
      ) : !producto ? (
        <div style={{ textAlign: "center", marginTop: "100px", fontSize: "1.2rem", color: "#FFF" }}>No se encontró el producto con SKU: {sku}</div>
      ) : (
        <div style={{ maxWidth: "900px", margin: "0 auto", backgroundColor: "#050505", border: "2px solid #DAA520", borderRadius: "20px", padding: "40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "center" }}>
          <div>
            <img 
              src={producto.image_url || "/placeholder.png"} 
              alt={producto.Ítem} 
              style={{ width: "100%", maxHeight: "400px", objectFit: "contain", borderRadius: "15px", backgroundColor: "#111", border: "1px solid #DAA520", padding: "10px" }} 
            />
          </div>
          <div>
            <span style={{ backgroundColor: "#DAA520", color: "#000", padding: "5px 10px", borderRadius: "5px", fontWeight: "bold", fontSize: "0.85rem" }}>{producto.SKU}</span>
            <h1 style={{ color: "#DAA520", fontSize: "1.8rem", margin: "15px 0 10px 0" }}>{producto.Ítem}</h1>
            <p style={{ color: "#FFF", fontSize: "1rem", lineHeight: "1.6", marginBottom: "20px" }}>{producto.Descripción || "Sin descripción detallada."}</p>
            <div style={{ borderTop: "1px dashed #DAA520", paddingTop: "15px", marginBottom: "20px" }}>
              <p style={{ color: "#DAA520", fontSize: "1.4rem", fontWeight: "bold", margin: "0" }}>Precio: ${producto.precio_a?.toFixed(2) || "0.00"}</p>
              <p style={{ color: "#AAA", fontSize: "0.9rem", margin: "5px 0 0 0" }}>Estado: {producto.estado_inventario || "Disponible"}</p>
            </div>
            <button 
              onClick={() => {
                alert(`Producto ${producto.SKU} listo para cotizar.`);
                router.push("/productos");
              }} 
              style={{ backgroundColor: "#DAA520", color: "#000", fontWeight: "bold", padding: "12px 25px", borderRadius: "10px", border: "none", cursor: "pointer", width: "100%" }}
            >
              Ir al Catálogo / Comprar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}