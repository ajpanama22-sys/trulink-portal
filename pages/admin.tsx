import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [dataList, setDataList] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;

    if (seccion === "VALIDAR") {
      const { data, error } = await supabase
        .from("solicitudes_acceso")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error) setDataList(data || []);
    } else if (seccion === "COTIZACIONES") {
      const { data, error } = await supabase
        .from("quote")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error) setDataList(data || []);
    }
  };

  const abrirArchivo = (ruta: string | null | undefined, bucket: string) => {
    if (!ruta) {
      alert("No hay archivo registrado en la base de datos.");
      return;
    }

    if (ruta.startsWith("http")) {
      window.open(ruta, "_blank");
      return;
    }

    // Validación necesaria para que TypeScript no lance error en el build
    if (!supabase) {
      alert("Error: Supabase no está inicializado.");
      return;
    }

    const nombreArchivo = ruta.split('/').pop();
    const { data } = supabase.storage.from(bucket).getPublicUrl(nombreArchivo || ruta);
    
    if (data && data.publicUrl) {
      window.open(data.publicUrl, "_blank");
    } else {
      alert("Error al intentar obtener la URL del archivo.");
    }
  };

  const activarUsuario = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("solicitudes_acceso")
      .update({ estado: 'APROBADO' })
      .eq('id', id);
    
    if (!error) cargarDatos();
    else alert("Error al activar usuario");
  };

  const ejecutarAccionProducto = (accion: string) => {
    alert(`Acción: ${accion} en ${db}`);
  };

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", display: "flex", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        html, body { margin: 0; padding: 0; background-color: #000 !important; color: #DAA520; }
        .container-fiber { border: 1px solid #DAA520; padding: 20px; border-radius: 20px; width: 100%; max-width: 800px; }
      `}</style>

      <div style={{ width: "250px", borderRight: "2px solid #DAA520", padding: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
        <h2 style={{ fontSize: "1.2rem", textAlign: "center" }}>ADMIN PANEL</h2>
        {["VALIDAR", "COTIZACIONES", "PRODUCTOS"].map((s) => (
          <button 
            key={s} 
            onClick={() => setSeccion(s)} 
            style={{ 
              backgroundColor: seccion === s ? "#DAA520" : "transparent", 
              color: seccion === s ? "#000" : "#DAA520", 
              border: "1px solid #DAA520", 
              padding: "10px", 
              borderRadius: "10px", 
              cursor: "pointer", 
              fontWeight: "bold" 
            }}
          >
            {s === "VALIDAR" ? "VALIDAR REGISTROS" : s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        <h1>{seccion === "VALIDAR" ? "Validación de Solicitudes" : seccion === "COTIZACIONES" ? "Seguimiento de Cotizaciones" : "Gestión de Productos"}</h1>
        
        <div className="container-fiber">
          {seccion !== "PRODUCTOS" ? (
            dataList.length > 0 ? dataList.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #333" }}>
                <div>
                  <strong>{item.razon_social || item.email || `ID: ${item.id}`}</strong>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button 
                    onClick={() => abrirArchivo(seccion === "VALIDAR" ? item.documento_url : item.pdf_url, seccion === "VALIDAR" ? "registros" : "documentos")} 
                    style={{ background: "transparent", color: "#DAA520", border: "1px solid #DAA520", padding: "5px 10px", cursor: "pointer" }}
                  >
                    REVISAR
                  </button>
                  {seccion === "VALIDAR" && (
                    <button onClick={() => activarUsuario(item.id)} style={{ backgroundColor: "#DAA520", border: "none", padding: "5px 10px", cursor: "pointer", color: "#000", fontWeight: "bold" }}>
                      ACTIVAR
                    </button>
                  )}
                </div>
              </div>
            )) : <p>No hay datos disponibles.</p>
          ) : (
            <div>
              <select value={db} onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", width: "100%", padding: "10px", border: "1px solid #DAA520" }}>
                <option value="cabledb">Cable DB</option>
                <option value="herrajesdb">Herrajes DB</option>
                <option value="accesoriosdb">Accesorios DB</option>
              </select>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                {["CREAR", "EDITAR", "ELIMINAR", "INACTIVAR"].map((acc) => (
                  <button key={acc} onClick={() => ejecutarAccionProducto(acc)} style={{ padding: "10px", cursor: "pointer", background: "transparent", color: "#DAA520", border: "1px solid #DAA520" }}>{acc}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
