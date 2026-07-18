import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [accion, setAccion] = useState<string>(""); 
  const [sku, setSku] = useState<string>("");
  const [datosForm, setDatosForm] = useState<any>({});
  const [dataList, setDataList] = useState<any[]>([]);
  const [paso, setPaso] = useState<number>(0); 

  useEffect(() => { cargarDatos(); }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;
    if (seccion === "COTIZACIONES") {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("quotes").select("*").eq("user_id", user?.id || "");
      setDataList(data || []);
    } else if (seccion === "VALIDAR") {
      const { data } = await supabase.from("solicitudes_acceso").select("*");
      setDataList(data || []);
    }
  };

  const ejecutarAccion = async () => {
    if (!supabase) return;
    if (!confirm(`¿Desea realizar la acción ${accion} en la base ${db}?`)) return;
    
    let query;
    if (accion === "CREAR") query = supabase.from(db).insert([datosForm]);
    else if (accion === "EDITAR") query = supabase.from(db).update(datosForm).eq("sku", sku);
    else if (accion === "ELIMINAR") query = supabase.from(db).delete().eq("sku", sku);
    else if (accion === "INACTIVAR") query = supabase.from(db).update({ status: "inactive" }).eq("sku", sku);

    if (query) {
        const { error } = await query;
        if (error) alert("Error: " + error.message);
        else { alert("Operación exitosa"); setAccion(""); setPaso(0); setSku(""); setDatosForm({}); }
    }
  };

  const renderFila = (item: any) => {
    if (seccion === "VALIDAR") {
      let info: any = {};
      try { info = typeof item.datos_completos === 'string' ? JSON.parse(item.datos_completos) : (item.datos_completos || {}); } catch(e) {}
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
    return Object.entries(item).map(([k, v]) => <div key={k}><strong>{k.toUpperCase()}:</strong> {String(v)}</div>);
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", flexShrink: 0 }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => {setSeccion("VALIDAR"); setPaso(0);}} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => {setSeccion("COTIZACIONES"); setPaso(0);}} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setPaso(0); setAccion("");}} style={btnNav}>PRODUCTOS</button>
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ border: "1px solid #DAA520", padding: "20px", borderRadius: "10px" }}>
            {paso === 0 && (
              <>
                <h3>SELECCIONA ACCIÓN</h3>
                {["CREAR", "EDITAR", "ELIMINAR", "INACTIVAR"].map(a => (
                  <button key={a} onClick={() => {setAccion(a); setPaso(1);}} style={btnAccion}>{a}</button>
                ))}
              </>
            )}

            {paso === 1 && (
              <>
                <h3>{accion} | SELECCIONA BASE DE DATOS</h3>
                <select onChange={(e) => setDb(e.target.value)} style={selectEstilo}>
                  <option value="cabledb">Cable DB</option>
                  <option value="herrajesdb">Herrajes DB</option>
                  <option value="accesoriosdb">Accesorios DB</option>
                </select>
                <button onClick={() => setPaso(2)} style={{...btnAccion, background: "green"}}>ACEPTAR</button>
                <button onClick={() => {setAccion(""); setPaso(0);}} style={{...btnAccion, background: "red", marginLeft: "10px"}}>CANCELAR</button>
              </>
            )}

            {paso === 2 && (
              <>
                <h3>{accion} en {db.toUpperCase()}</h3>
                {(accion !== "CREAR") && <input placeholder="Buscar por SKU" onChange={(e) => setSku(e.target.value)} style={inputEstilo} />}
                {(accion === "CREAR" || accion === "EDITAR") && <input placeholder="Datos (JSON)" onChange={(e) => {try{setDatosForm(JSON.parse(e.target.value))}catch(e){}}} style={inputEstilo} />}
                <button onClick={ejecutarAccion} style={{...btnAccion, background: "green"}}>ACEPTAR Y EJECUTAR</button>
                <button onClick={() => setPaso(1)} style={{...btnAccion, background: "gray", marginLeft: "10px"}}>VOLVER</button>
              </>
            )}
          </div>
        )}

        {seccion !== "PRODUCTOS" && dataList.map((item: any) => (
          <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px 0" }}>
            {renderFila(item)}
            {seccion !== "PRODUCTOS" && (
              <button onClick={() => {
                const bucket = seccion === "VALIDAR" ? "registros" : "documentos";
                const path = seccion === "VALIDAR" ? item.documento_url : item.pdf_url;
                if (path && supabase) window.open(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl, "_blank");
              }} style={btnDoc}>VER DOCUMENTO</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", width: "100%", marginBottom: "10px", cursor: "pointer", fontWeight: "bold", textAlign: "left" as const };
const btnAccion = { padding: "10px 20px", cursor: "pointer", background: "#DAA520", border: "none", borderRadius: "5px", fontWeight: "bold", marginRight: "10px" };
const btnDoc = { marginTop: "10px", padding: "10px 20px", background: "#DAA520", border: "none", cursor: "pointer", fontWeight: "bold", borderRadius: "20px" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
const inputEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
