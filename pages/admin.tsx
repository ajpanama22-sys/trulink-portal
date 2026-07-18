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
    const { data, error } = await supabase.from(tabla).select("*").order("created_at", { ascending: false });
    if (!error) setDataList(data || []);
  };

  const ejecutarAccion = (accion: string, item: any = null) => {
    alert(`Ejecutando ${accion} sobre la tabla ${db} en el ID: ${item?.id || "NUEVO"}`);
  };

  const abrirArchivo = (ruta: string | null | undefined, bucket: string) => {
    if (!ruta || ruta === "EMPTY") return alert("No hay archivo");
    if (!supabase) return;
    const nombreCodificado = encodeURIComponent(ruta.split('/').pop() || "");
    const { data } = supabase.storage.from(bucket).getPublicUrl(nombreCodificado);
    window.open(data.publicUrl, "_blank");
  };

  // Estilos con esquinas muy redondeadas y brillo corporativo
  const btnStyle = {
    padding: "12px 25px", borderRadius: "50px", cursor: "pointer", border: "2px solid #DAA520",
    background: "transparent", color: "#DAA520", transition: "all 0.3s ease", 
    fontWeight: "bold", fontSize: "14px", textTransform: "uppercase"
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <style>{`
        .btn-corp { transition: all 0.3s ease; }
        .btn-corp:hover { transform: scale(1.1); box-shadow: 0 0 20px #DAA520; background: #1a1a1a; }
        .crud-btn { border: none; padding: 10px 15px; border-radius: 50px; cursor: pointer; color: #fff; font-weight: bold; margin-left: 5px; }
      `}</style>

      {/* Menú Lateral */}
      <div style={{ width: "320px", borderRight: "2px solid #DAA520", padding: "30px", display: "flex", flexDirection: "column", gap: "25px" }}>
        <h2 style={{ textAlign: "center", color: "#DAA520" }}>ADMIN PANEL</h2>
        <button className="btn-corp" onClick={() => setSeccion("VALIDAR")} style={btnStyle}>VALIDAR INSCRIPCIONES</button>
        <button className="btn-corp" onClick={() => setSeccion("COTIZACIONES")} style={btnStyle}>COTIZACIONES GENERADAS</button>
        <button className="btn-corp" onClick={() => setSeccion("PRODUCTOS")} style={btnStyle}>PRODUCTOS</button>
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "30px", padding: "20px", border: "1px solid #DAA520", borderRadius: "20px" }}>
            <label style={{ marginRight: "15px", fontWeight: "bold" }}>BASE DE DATOS ACTIVA:</label>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", padding: "10px", borderRadius: "20px", border: "1px solid #DAA520", width: "200px" }}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {dataList.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "20px", borderBottom: "1px solid #333", alignItems: "center" }}>
            <span style={{ fontWeight: "bold" }}>{item.razon_social || item.email || item.id}</span>
            <div style={{ display: "flex", gap: "5px" }}>
              {seccion === "PRODUCTOS" ? (
                <>
                  <button className="crud-btn" onClick={() => ejecutarAccion("CREAR", item)} style={{ backgroundColor: "#006400" }}>CREAR</button>
                  <button className="crud-btn" onClick={() => ejecutarAccion("EDITAR", item)} style={{ backgroundColor: "#DAA520", color: "#000" }}>EDITAR</button>
                  <button className="crud-btn" onClick={() => ejecutarAccion("ELIMINAR", item)} style={{ backgroundColor: "#8B0000" }}>ELIMINAR</button>
                  <button className="crud-btn" onClick={() => ejecutarAccion("INACTIVAR", item)} style={{ backgroundColor: "#404040" }}>INACTIVAR</button>
                  <button className="crud-btn" onClick={() => ejecutarAccion("VISUALIZAR", item)} style={{ backgroundColor: "#00008B" }}>VISUALIZAR</button>
                </>
              ) : (
                <button className="btn-corp" onClick={() => abrirArchivo(seccion === "VALIDAR" ? item.documento_url : item.pdf_url, seccion === "VALIDAR" ? "registros" : "documentos")} style={btnStyle}>REVISAR ARCHIVO</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
