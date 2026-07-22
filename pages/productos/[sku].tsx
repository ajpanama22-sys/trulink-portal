import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DetalleProducto() {
  const router = useRouter();
  const { sku } = router.query;
  const [producto, setProducto] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sku) return;
    const fetchProducto = async () => {
      // Buscamos en las tablas principales de inventario
      for (const tabla of ["accesoriosdb", "cablesdb", "herrajesdb"]) {
        const { data, error } = await supabase
          .from(tabla)
          .select("*")
          .eq("SKU", sku)
          .single();
        if (data) {
          setProducto(data);
          break;
        }
      }
      setLoading(false);
    };
    fetchProducto();
  }, [sku]);

  if (loading) return <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", textAlign: "center" }}>Cargando detalle...</div>;
  if (!producto) return <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", textAlign: "center" }}>Producto no encontrado.</div>;

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      <button 
        onClick={() => router.back()} 
        style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer", marginBottom: "30px" }}
      >
        ⬅ Volver
      </button>

      <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "#050505", border: "2px solid #DAA520", borderRadius: "20px", padding: "40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", alignItems: "center" }}>
        <div>
          <img 
            src={producto.image_url || "/placeholder.png"} 
            alt={producto.Ítem} 
            style={{ width: "100%", maxHeight: "350px", objectFit: "contain", borderRadius: "15px", border: "1px solid #333", backgroundColor: "#111", padding: "10px" }} 
          />
        </div>
        <div>
          <span style={{ fontSize: "0.9rem", color: "#888" }}>SKU: {producto.SKU}</span>
          <h1 style={{ color: "#DAA520", fontSize: "1.8rem", margin: "10px 0" }}>{producto.Ítem}</h1>
          <p style={{ color: "#FFF", fontSize: "1rem", lineHeight: "1.5", marginBottom: "20px" }}>{producto.Descripción}</p>
          <p style={{ color: "#DAA520", fontSize: "1.4rem", fontWeight: "bold", marginBottom: "20px" }}>
            Precio: ${producto.precio_a?.toFixed(2) || "0.00"}
          </p>
          <button 
            onClick={() => router.back()} 
            style={{ backgroundColor: "#DAA520", color: "#000", padding: "12px 25px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer", width: "100%" }}
          >
            Regresar al Catálogo
          </button>
        </div>
      </div>
    </div>
  );
}