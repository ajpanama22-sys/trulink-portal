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
    
    let tabla = seccion === "VALIDAR" ? "solicitudes_acceso" : seccion === "COTIZACIONES" ? "quotes" : db;
    const { data, error } = await supabase.from(tabla).select("*");
    
    if (error) {
      console.error("Error al cargar:", error);
      setDataList([]);
    } else {
      setDataList(data || []);
    }
  };

  const abrirArchivo = (item: any) => {
    if (!supabase) return;
    const bucket = seccion === "VALIDAR" ? "registros" : "documentos";
    const path = seccion === "VALIDAR" ? item.documento_url : item.pdf_url;
    
    if (!path) {
        alert("No hay documento disponible para este registro.");
        return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    window.open(data.publicUrl, "_blank");
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      {/* MENÚ LATERAL */}
      <div style={{ width: "300px", borderRight: "2px solid #DAA520", padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => setSeccion("VALIDAR")} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => setSeccion("COTIZACIONES")} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => setSeccion("PRODUCTOS")} style={btnNav}>PRODUCTOS</button>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "30px", border: "1px solid #DAA520", padding: "20px", borderRadius: "15px" }}>
            <label style={{ marginRight: "15px" }}>BASE DE DATOS ACTIVA:</label>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={selectEstilo}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {dataList.map((item) => (
          <div key={item.id} style={{ padding: "20px", borderBottom: "1px solid #333", marginBottom: "10px" }}>
            {/* RENDERIZADO DE TODOS LOS CAMPOS */}
            <div style={{ marginBottom: "10px", fontSize: "14px" }}>
                {Object.entries(item).map(([key, value]) => (
                    <div key={key}><strong>{key.toUpperCase()}:</strong> {JSON.stringify(value)}</div>
                ))}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              {seccion === "PRODUCTOS" ? (
                <>
                  <button style={{...btnAccion, background: "green"}}>CREAR</button>
                  <button style={{...btnAccion, background: "gold", color: "#000"}}>EDITAR</button>
                  <button style={{...btnAccion, background: "red"}}>ELIMINAR</button>
                </>
              ) : (
                <button onClick={() => abrirArchivo(item)} style={btnAccion}>VER DOCUMENTO</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", cursor: "pointer", fontWeight: "bold" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", borderRadius: "20px", border: "1px solid #DAA520" };
const btnAccion = { border: "none", padding: "10px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" };
