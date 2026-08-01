import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import { theme } from "../../lib/theme";
import { Card, Button } from "../../lib/ui";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DetalleProductoDinamico() {
  const router = useRouter();
  const { SKU } = router.query;
  const [producto, setProducto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tablaOrigen, setTablaOrigen] = useState<string>("");

  // Normaliza el SKU si Next.js lo recibe como un arreglo debido a las barras diagonales (/)
  const skuString = Array.isArray(SKU) ? SKU.join('/') : SKU;

  useEffect(() => {
    if (!skuString) return;

    const buscarEnTablas = async () => {
      setLoading(true);
      const tablas = ['cablesdb', 'herrajesdb', 'accesoriosdb'];

      let encontrado = null;
      let tablaEncontrada = "";

      for (const tabla of tablas) {
        const { data, error } = await supabase
          .from(tabla)
          .select('*')
          .eq('SKU', skuString);

        if (data && data.length > 0 && !error) {
          encontrado = data[0];
          tablaEncontrada = tabla;
          break;
        }
      }

      setProducto(encontrado);
      setTablaOrigen(tablaEncontrada);
      setLoading(false);
    };

    buscarEnTablas();
  }, [skuString]);

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
      minHeight: "100vh",
      padding: "40px 20px",
      fontFamily: theme.fontFamily,
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>

      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: "900px", display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center" }}>
        <span style={{ color: theme.textLight, fontSize: "1rem" }}>SKU: <strong style={{ color: theme.gold }}>{skuString}</strong></span>
      </div>

      <Card
        style={{
          background: "#080808",
          border: `2px solid ${theme.gold}`,
          borderRadius: "20px",
          padding: "40px",
          maxWidth: "900px",
          width: "100%",
          margin: 0,
          boxShadow: "0 0 30px rgba(218, 165, 32, 0.2)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "100px", marginBottom: "15px" }} />
          <h2 style={{ color: theme.gold, letterSpacing: "2px", margin: 0, fontSize: "1.2rem" }}>TRULINK FIBER LLC</h2>
        </div>

        {loading ? (
          <p style={{ color: theme.textLight, fontSize: "1.3rem", textAlign: "center", padding: "60px 0" }}>Cargando especificaciones técnicas...</p>
        ) : producto ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {producto.image_url && (
              <div style={{ textAlign: "center" }}>
                <img src={producto.image_url} alt={skuString} style={{ maxWidth: "300px", maxHeight: "300px", borderRadius: "15px", border: `1px solid ${theme.gold}`, objectFit: "contain" }} />
              </div>
            )}

            <div style={{ borderBottom: "1px solid #333", paddingBottom: "20px" }}>
              <span style={{ backgroundColor: theme.gold, color: "#000", padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold" }}>
                {producto.Familia || tablaOrigen.toUpperCase()}
              </span>
              <h1 style={{ color: theme.gold, fontSize: "2.2rem", margin: "15px 0 10px 0" }}>{producto.Ítem || producto.item || producto.SKU}</h1>
              <p style={{ color: theme.textLight, fontSize: "1.2rem", lineHeight: "1.6", margin: 0 }}>{producto.Descripción || producto.descripcion || "Sin descripción detallada disponible."}</p>
            </div>

            <Card style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", background: theme.panelBg, padding: "20px", borderRadius: "12px", border: `1px solid ${theme.borderGoldLight}`, margin: 0 }}>
              <div>
                <p style={{ color: theme.textMuted, margin: "0 0 5px 0", fontSize: "0.9rem" }}>Especificaciones Técnicas</p>
                <p style={{ color: theme.textLight, margin: 0, fontSize: "1.1rem" }}>{producto.Especificaciones || producto.especificaciones || "Estándar Trulink"}</p>
              </div>
              <div>
                <p style={{ color: theme.textMuted, margin: "0 0 5px 0", fontSize: "0.9rem" }}>Estado de Inventario</p>
                <p style={{ color: theme.gold, margin: 0, fontSize: "1.1rem", fontWeight: "bold" }}>{producto.estado_inventario || "Disponible para Fabricación"}</p>
              </div>
            </Card>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", borderTop: "1px solid #333", paddingTop: "20px" }}>
              <div>
                <span style={{ color: theme.textMuted, fontSize: "0.9rem", display: "block" }}>Precio de Referencia Unitario</span>
                <span style={{ color: theme.gold, fontSize: "2rem", fontWeight: "bold" }}>${producto.precio_a ?? producto.precio ?? "1.00"}</span>
              </div>
              <Button
                variant="gold"
                onClick={() => router.push('/productos')}
                style={{ borderRadius: "12px", padding: "15px 30px", fontSize: "1.1rem" }}
              >
                Volver al Listado
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "50px 0" }}>
            <h2 style={{ color: theme.gold, marginBottom: "15px" }}>Producto no encontrado</h2>
            <p style={{ color: theme.textLight, fontSize: "1.1rem" }}>El código SKU <strong>{skuString}</strong> no registra datos activos en el sistema.</p>
          </div>
        )}
      </Card>

      <p style={{ marginTop: "40px", fontSize: "11px", color: theme.textMuted, textAlign: "center" }}>
        Trulink Fiber LLC – Portal de Fabricación y Suministros © 2026
      </p>
    </div>
  );
}