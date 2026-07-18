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
    
    // Extracción de todos los campos con select('*')
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) {
      console.error("Error cargando datos:", error);
    } else {
      setDataList(data || []);
    }
  };

  const abrirArchivo = (ruta: string | null, bucket: string) => {
    if (!ruta || ruta === "EMPTY") return alert("No hay archivo");
    if (!supabase) return;
    
    const nombreCodificado = encodeURIComponent(ruta.split('/').pop() || "");
    const { data } = supabase.storage.from(bucket).getPublicUrl(nombreCodificado);
    window.open(data.publicUrl, "_blank");
  };

  const ejecutarAccion = (accion: string, item: any) => {
    alert(`Acción: ${accion} sobre ID: ${item.id}`);
  };

  const btnEstilo = { 
    padding: "12px 25px", borderRadius: "50px", cursor: "pointer", border: "2px solid #DAA520", 
    background: "transparent", color: "#DAA520", fontWeight: "bold", margin: "5px" 
  };
  
  const crudBtn = { 
    border: "none", padding: "10px 15px", borderRadius: "50px", cursor: "pointer", 
    color: "#fff", fontWeight: "bold", margin: "0 5px" 
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      {/* MENÚ LATERAL */}
      <div style={{ width: "300px", borderRight: "2px solid #DAA520", padding: "30px", display: "flex", flexDirection: "column", gap: "25px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button className="btn-corp" onClick={() => setSeccion("VALIDAR")} style={btnEstilo}>VALIDAR INSCRIPCIONES</button>
        <button className="btn-corp" onClick={() => setSeccion("COTIZACIONES")} style={btnEstilo}>COTIZACIONES GENERADAS</button>
        <button className="btn-corp" onClick={() => setSeccion("PRODUCTOS")} style={btnEstilo}>PRODUCTOS</button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "30px", padding: "20px", border: "1px solid #DAA520", borderRadius: "20px" }}>
            <label style={{ marginRight: "15px" }}>BASE DE DATOS ACTIVA:</label>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", padding: "10px", borderRadius: "20px" }}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {dataList.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "20px", borderBottom: "1px solid #333", alignItems: "center" }}>
            <span style={{ fontSize: "14px", maxWidth: "60%" }}>{JSON.stringify(item)}</span>
            
            <div style={{ display: "flex" }}>
              {seccion === "PRODUCTOS" ? (
                <>
                  <button onClick={() => ejecutarAccion("CREAR", item)} style={{ ...crudBtn, backgroundColor: "green" }}>CREAR</button>
                  <button onClick={() => ejecutarAccion("EDITAR", item)} style={{ ...crudBtn, backgroundColor: "#DAA520", color: "#000" }}>EDITAR</button>
                  <button onClick={() => ejecutarAccion("ELIMINAR", item)} style={{ ...crudBtn, backgroundColor: "red" }}>ELIMINAR</button>
                  <button onClick={() => ejecutarAccion("INACTIVAR", item)} style={{ ...crudBtn, backgroundColor: "gray" }}>INACTIVAR</button>
                  <button onClick={() => ejecutarAccion("VISUALIZAR", item)} style={{ ...crudBtn, backgroundColor: "blue" }}>VISUALIZAR</button>
                </>
              ) : (
                <button className="btn-corp" onClick={() => abrirArchivo(seccion === "VALIDAR" ? item.documento_url : item.pdf_url, seccion === "VALIDAR" ? "registros" : "documentos")} style={btnEstilo}>VER ARCHIVO</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
