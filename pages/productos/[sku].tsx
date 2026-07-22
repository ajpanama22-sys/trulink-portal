import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DetalleProductoDinamico() {
  const router = useRouter();
  const { SKU } = router.query;
  const [producto, setProducto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tablaOrigen, setTablaOrigen] = useState<string>("");

  useEffect(() => {
    if (!SKU) return;

    const buscarEnTablas = async () => {
      setLoading(true);
      const tablas = ['cablesdb', 'herrajesdb', 'accesoriosdb'];

      let encontrado = null;
      let tablaEncontrada = "";

      for (const tabla of tablas) {
        const { data, error } = await supabase
          .from(tabla)
          .select('*')
          .eq('SKU', SKU)
          .single();

        if (data && !error) {
          encontrado = data;
          tablaEncontrada = tabla;
          break;
        }
      }

      setProducto(encontrado);
      setTablaOrigen(tablaEncontrada);
      setLoading(false);
    };

    buscarEnTablas();
  }, [SKU]);

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      padding: "20px",
      fontFamily: "sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: "800px", display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center" }}>
        <button 
          onClick={() => router.back()} 
          style={{ backgroundColor: "#DAA520", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}
        >
          ⬅ Volver
        </button>
        <span style={{ color: "#FFF", fontSize: "0.9rem" }}>SKU: <strong style={{ color: "#DAA520" }}>{SKU}</strong></span>
      </div>

      <div style={{
        backgroundColor: "#050505",
        border: "2px solid #DAA520",
        borderRadius: "20px",
        padding: "30px",
        maxWidth: "800px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 0 20px #DAA520"
      }}>
        <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "80px", marginBottom: "15px" }} />
        
        {loading ? (
          <p style={{ color: "#FFF", fontSize: "1.2rem", padding: "40px 0" }}>Buscando especificaciones...</p>
        ) : producto ? (
          <>
            {producto.image_url && (
              <img src={producto.image_url} alt={SKU as string} style={{ maxWidth: "200px", borderRadius: "10px", marginBottom: "15px", border: "1px solid #DAA520" }} />
            )}
            <h1 style={{ color: "#DAA520", fontSize: "1.8rem", marginBottom: "10px" }}>{producto.item || producto.SKU}</h1>
            <p style={{ color: "#FFF", fontSize: "1.1rem", marginBottom: "20px" }}>{producto.Descripción || producto.descripcion || "Sin descripción disponible."}</p>
            
            <div style={{ borderTop: "1px solid #333", paddingTop: "20px", marginTop: "20px", textAlign: "left" }}>
              <p style={{ color: "#FFF", margin: "8px 0" }}><strong>Categoría / Familia:</strong> {producto.Familia || "N/D"}</p>
              <p style={{ color: "#FFF", margin: "8px 0" }}><strong>Especificaciones:</strong> {producto.Especificaciones || "N/D"}</p>
              <p style={{ color: "#FFF", margin: "8px 0" }}><strong>Estado de Inventario:</strong> {producto.estado_inventario || "disponible"}</p>
              <p style={{ color: "#DAA520", margin: "8px 0", fontSize: "1.2rem" }}><strong>Precio A:</strong> ${producto.precio_a ?? producto.precio ?? "0.00"}</p>
              <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "10px" }}>Origen de BD: {tablaOrigen}</p>
            </div>
          </>
        ) : (
          <div style={{ padding: "30px 0" }}>
            <h2 style={{ color: "#DAA520", marginBottom: "10px" }}>Producto no encontrado</h2>
            <p style={{ color: "#FFF" }}>El código SKU <strong>{SKU}</strong> no está registrado en cablesdb, herrajesdb ni accesoriosdb.</p>
          </div>
        )}
      </div>

      <p style={{ marginTop: "30px", fontSize: "10px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Trulink Fiber LLC – Todos los derechos reservados
      </p>
    </div>
  );
}