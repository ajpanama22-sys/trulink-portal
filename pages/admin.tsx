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
    if (!ruta || ruta === "EMPTY" || ruta.trim() === "") {
      alert("No hay archivo registrado en la base de datos.");
      return;
    }

    if (ruta.startsWith("http")) {
      window.open(ruta, "_blank");
      return;
    }

    if (!supabase) {
      alert("Error: Supabase no inicializado.");
      return;
    }

    // Codificación para manejar espacios y caracteres especiales en nombres de archivos
    const nombreArchivoCodificado = encodeURIComponent(ruta.split('/').pop() || "");
    const { data } = supabase.storage.from(bucket).getPublicUrl(nombreArchivoCodificado);
    
    if (data && data.publicUrl) {
      window.open(data.publicUrl, "_blank");
    } else {
      alert("Error al obtener la URL del archivo.");
    }
  };

  const activarUsuario = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("solicitudes_acceso").update({ estado: 'APROBADO' }).eq('id', id);
    if (!error) cargarDatos();
    else alert("Error al activar usuario");
  };

  const ejecutarAccionProducto = (accion: string) => {
    alert(`Acción: ${accion} en base de datos: ${db}`);
  };

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "20px", fontFamily: "sans-serif" }}>
      <style jsx global>{`html, body { background-color: #000 !important; color: #DAA520; margin: 0; }`}</style>

      <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
        {["VALIDAR", "COTIZACIONES", "PRODUCTOS"].map((s) => (
          <button key={s} onClick={() => setSeccion(s)} style={{ backgroundColor: seccion === s ? "#DAA520" : "transparent", color: seccion === s ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px 20px", cursor: "pointer", fontWeight: "bold" }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ border: "1px solid #DAA520", padding: "20px", borderRadius: "10px" }}>
        {dataList.length > 0 ? dataList.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #333" }}>
            <span>{item.razon_social || item.email || `ID: ${item.id}`}</span>
            <div>
              <button 
                onClick={() => abrirArchivo(seccion === "VALIDAR" ? item.documento_url : item.pdf_url, seccion === "VALIDAR" ? "registros" : "documentos")} 
                style={{ marginRight: "10px", cursor: "pointer", background: "transparent", color: "#DAA520", border: "1px solid #DAA520", padding: "5px 10px" }}
              >
                REVISAR
              </button>
              {seccion === "VALIDAR" && (
                <button onClick={() => activarUsuario(item.id)} style={{ cursor: "pointer", backgroundColor: "#DAA520", border: "none", padding: "5px 10px", color: "#000", fontWeight: "bold" }}>
                  ACTIVAR
                </button>
              )}
            </div>
          </div>
        )) : <p>No hay datos disponibles en esta sección.</p>}
        
        {seccion === "PRODUCTOS" && (
          <div style={{ marginTop: "20px" }}>
            <select onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", padding: "10px", width: "100%" }}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
