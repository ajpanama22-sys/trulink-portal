import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [dataList, setDataList] = useState<any[]>([]);
  const [modo, setModo] = useState<string | null>(null);
  const [itemSeleccionado, setItemSeleccionado] = useState<any>(null);

  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;
    let tabla = seccion === "VALIDAR" ? "solicitudes_acceso" : seccion === "COTIZACIONES" ? "quotes" : db;
    
    // select('*') asegura traer absolutamente todos los campos de la tabla
    const { data, error } = await supabase.from(tabla).select("*");
    if (!error) setDataList(data || []);
  };

  const abrirArchivo = (ruta: string | null, bucket: string) => {
    if (!ruta || ruta === "EMPTY") return alert("No hay archivo");
    if (!supabase) return;
    const nombreCodificado = encodeURIComponent(ruta.split('/').pop() || "");
    const { data } = supabase.storage.from(bucket).getPublicUrl(nombreCodificado);
    window.open(data.publicUrl, "_blank");
  };

  const confirmarEliminar = async (item: any) => {
    const confirmacion = window.confirm("¿SEGURO QUE DESEA ELIMINAR EL ITEM?");
    if (confirmacion && supabase) {
      await supabase.from(db).delete().eq('id', item.id);
      cargarDatos();
    }
  };

  const btnEstilo = {
    padding: "12px 25px", borderRadius: "50px", cursor: "pointer", border: "2px solid #DAA520",
    background: "transparent", color: "#DAA520", transition: "all 0.3s ease",
    fontWeight: "bold", fontSize: "14px", textTransform: "uppercase" as const
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <style>{`
        .btn-corp:hover { transform: scale(1.05); box-shadow: 0 0 20px #DAA520; background: #1a1a1a; }
        .crud-btn { border: none; padding: 10px 20px; border-radius: 50px; cursor: pointer; color: #fff; font-weight: bold; margin: 0 5px; transition: 0.3s; }
        .crud-btn:hover { transform: scale(1.1); box-shadow: 0 0 10px #fff; }
      `}</style>

      {/* Menú Lateral */}
      <div style={{ width: "320px", borderRight: "2px solid #DAA520", padding: "30px", display: "flex", flexDirection: "column", gap: "25px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button className="btn-corp" onClick={() => { setSeccion("VALIDAR"); setModo(null); }} style={btnEstilo}>VALIDAR INSCRIPCIONES</button>
        <button className="btn-corp" onClick={() => { setSeccion("COTIZACIONES"); setModo(null); }} style={btnEstilo}>COTIZACIONES GENERADAS</button>
        <button className="btn-corp" onClick={() => { setSeccion("PRODUCTOS"); setModo(null); }} style={btnEstilo}>PRODUCTOS</button>
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "30px", padding: "20px", border: "1px solid #DAA520", borderRadius: "20px" }}>
            <label style={{ marginRight: "15px" }}>BASE DE DATOS ACTIVA:</label>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", padding: "10px", borderRadius: "20px", border: "1px solid #DAA520" }}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {!modo ? (
          dataList.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "20px", borderBottom: "1px solid #333", alignItems: "center" }}>
              <span>{item.razon_social || item.sku || item.id}</span>
              <div style={{ display: "flex" }}>
                {seccion === "PRODUCTOS" ? (
                  <>
                    <button className="crud-btn" onClick={() => { setModo("CREAR"); }} style={{ backgroundColor: "#006400" }}>CREAR</button>
                    <button className="crud-btn" onClick={() => { setModo("EDITAR"); setItemSeleccionado(item); }} style={{ backgroundColor: "#DAA520", color: "#000" }}>EDITAR</button>
                    <button className="crud-btn" onClick={() => confirmarEliminar(item)} style={{ backgroundColor: "#8B0000" }}>ELIMINAR</button>
                    <button className="crud-btn" onClick={() => { setModo("INACTIVAR"); setItemSeleccionado(item); }} style={{ backgroundColor: "#404040" }}>INACTIVAR</button>
                    <button className="crud-btn" onClick={() => { setModo("VISUALIZAR"); setItemSeleccionado(item); }} style={{ backgroundColor: "#00008B" }}>VISUALIZAR</button>
                  </>
                ) : (
                  <button className="btn-corp" onClick={() => abrirArchivo(seccion === "VALIDAR" ? item.documento_url : item.pdf_url, seccion === "VALIDAR" ? "registros" : "documentos")} style={btnEstilo}>VER ARCHIVO</button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ border: "1px solid #DAA520", padding: "20px", borderRadius: "20px" }}>
            <h3>MODO: {modo}</h3>
            {modo === "VISUALIZAR" && (
              <div style={{ color: "#DAA520" }}>
                <pre>{JSON.stringify(itemSeleccionado, null, 2)}</pre>
              </div>
            )}
            <button onClick={() => setModo(null)} style={btnEstilo}>VOLVER A LISTADO</button>
          </div>
        )}
      </div>
    </div>
  );
}
