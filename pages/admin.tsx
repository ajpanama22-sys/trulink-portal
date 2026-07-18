import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [dataList, setDataList] = useState<any[]>([]);

  // Efecto para recargar datos cuando cambia la sección o la base de datos
  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    let tabla = "";
    if (seccion === "VALIDAR") tabla = "solicitudes_acceso";
    else if (seccion === "COTIZACIONES") tabla = "quotes";
    else tabla = db;

    const { data, error } = await supabase.from(tabla).select("*");
    if (error) {
      console.error("Error al cargar:", error);
      setDataList([]);
    } else {
      setDataList(data || []);
    }
  };

  const abrirArchivo = (item: any) => {
    let bucket = seccion === "VALIDAR" ? "registros" : "documentos";
    let path = seccion === "VALIDAR" ? item.documento_url : item.pdf_url;
    
    if (!path) return alert("No hay archivo asociado");
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    window.open(data.publicUrl, "_blank");
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      {/* MENÚ LATERAL */}
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => setSeccion("VALIDAR")} style={btnEstilo}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => setSeccion("COTIZACIONES")} style={btnEstilo}>COTIZACIONES GENERADAS</button>
        <button onClick={() => setSeccion("PRODUCTOS")} style={btnEstilo}>PRODUCTOS</button>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div style={{ flex: 1, padding: "30px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "30px", padding: "20px", border: "1px solid #DAA520", borderRadius: "10px" }}>
            <label style={{ marginRight: "15px" }}>BASE DE DATOS ACTIVA:</label>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={selectEstilo}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {/* LISTADO DE DATOS */}
        {dataList.length > 0 ? (
          dataList.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #333", alignItems: "center" }}>
              <div style={{ fontSize: "14px" }}>
                <strong>{item.razon_social || item.sku || `ID: ${item.id}`}</strong>
                <div style={{ fontSize: "11px", color: "#888" }}>{JSON.stringify(item).substring(0, 80)}...</div>
              </div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                {seccion === "PRODUCTOS" ? (
                  <>
                    <button style={{...btnAccion, backgroundColor: "#DAA520", color: "#000"}}>EDITAR</button>
                    <button style={{...btnAccion, backgroundColor: "#800000", color: "#fff"}}>ELIMINAR</button>
                  </>
                ) : (
                  <button onClick={() => abrirArchivo(item)} style={btnAccion}>VER ARCHIVO</button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: "center", marginTop: "50px" }}>No hay registros disponibles.</p>
        )}
      </div>
    </div>
  );
}

// ESTILOS CENTRALIZADOS
const btnEstilo = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", cursor: "pointer", fontWeight: "bold" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", borderRadius: "20px", border: "1px solid #DAA520" };
const btnAccion = { padding: "8px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: "#DAA520", color: "#000" };
