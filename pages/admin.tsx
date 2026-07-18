import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [accion, setAccion] = useState<string>(""); 
  const [dataList, setDataList] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;
    let tabla = seccion === "VALIDAR" ? "solicitudes_acceso" : seccion === "COTIZACIONES" ? "quotes" : db;
    const { data, error } = await supabase.from(tabla).select("*");
    if (!error) setDataList(data || []);
  };

  const renderFila = (item: any) => {
    if (seccion === "VALIDAR") {
      // Intentamos parsear datos_completos con seguridad
      let info = {};
      try {
        info = typeof item.datos_completos === 'string' ? JSON.parse(item.datos_completos) : (item.datos_completos || {});
      } catch (e) { info = {}; }
      
      return (
        <div style={{ marginBottom: "15px" }}>
          <div><strong>RAZON SOCIAL:</strong> {item.razon_social}</div>
          <div><strong>EMAIL:</strong> {item.email}</div>
          <div><strong>WEBSITE:</strong> {info.website || "N/A"}</div>
          <div><strong>REPRESENTANTE:</strong> {info.representante || "N/A"}</div>
          <div><strong>FISCAL ID:</strong> {info.fiscal_id || "N/A"}</div>
        </div>
      );
    }
    
    if (seccion === "COTIZACIONES") {
      const { items, tipo_carrete, hilos, ...resto } = item;
      return Object.entries(resto).map(([k, v]) => (
        <div key={k}><strong>{k.toUpperCase()}:</strong> {String(v)}</div>
      ));
    }

    return Object.entries(item).map(([k, v]) => (
      <div key={k}><strong>{k.toUpperCase()}:</strong> {String(v)}</div>
    ));
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      {/* MENU LATERAL FIJO */}
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", flexShrink: 0 }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => {setSeccion("VALIDAR"); setAccion("");}} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => {setSeccion("COTIZACIONES"); setAccion("");}} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setAccion("");}} style={btnNav}>PRODUCTOS</button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && !accion && (
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h3>SELECCIONA UNA ACCIÓN</h3>
            <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
              <button onClick={() => setAccion("CREAR")} style={{...btnAccion, background: "green"}}>CREAR</button>
              <button onClick={() => setAccion("EDITAR")} style={{...btnAccion, background: "gold", color: "#000"}}>EDITAR</button>
              <button onClick={() => setAccion("ELIMINAR")} style={{...btnAccion, background: "red"}}>ELIMINAR</button>
            </div>
          </div>
        )}

        {seccion === "PRODUCTOS" && accion && (
          <div style={{ marginBottom: "30px", border: "1px solid #DAA520", padding: "20px", borderRadius: "10px" }}>
            <h3>ACCIÓN: {accion} | SELECCIONA BASE DE DATOS</h3>
            <select onChange={(e) => setDb(e.target.value)} style={selectEstilo}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
            <button onClick={() => setAccion("")} style={{ marginLeft: "15px", background: "transparent", color: "#DAA520", border: "1px solid #DAA520", padding: "8px 15px", cursor: "pointer", borderRadius: "5px" }}>CANCELAR</button>
          </div>
        )}

        {dataList.map((item) => (
          <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px 0" }}>
            {renderFila(item)}
            {seccion !== "PRODUCTOS" && (
              <button onClick={() => {
                const bucket = seccion === "VALIDAR" ? "registros" : "documentos";
                const path = seccion === "VALIDAR" ? item.documento_url : item.pdf_url;
                if (path) window.open(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl, "_blank");
              }} style={{ marginTop: "10px", padding: "10px 20px", background: "#DAA520", border: "none", cursor: "pointer", fontWeight: "bold", borderRadius: "20px" }}>
                VER DOCUMENTO
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", cursor: "pointer", fontWeight: "bold", textAlign: "left" as const };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", borderRadius: "10px", border: "1px solid #DAA520", width: "200px" };
const btnAccion = { border: "none", padding: "15px 30px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#fff" };
