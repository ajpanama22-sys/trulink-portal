import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>(""); 
  const [accion, setAccion] = useState<string>(""); 
  const [skuTarget, setSkuTarget] = useState<string>(""); 
  const [formData, setFormData] = useState({
    SKU: "",
    Item: "",
    Familia: "",
    Descripción: "",
    Especificaciones: "",
    precio: 0,
    estado_inventario: "disponible"
  });
  const [dataList, setDataList] = useState<any[]>([]);
  const [paso, setPaso] = useState<number>(0); 

  useEffect(() => { 
    if (seccion !== "PRODUCTOS") cargarDatos(seccion);
    else setDataList([]); 
  }, [seccion]);

  const cargarDatos = async (seccionActual: string, targetDb?: string) => {
    if (!supabase) return;
    setDataList([]);
    let query;
    if (seccionActual === "COTIZACIONES") query = supabase.from("quotes").select("*");
    else if (seccionActual === "VALIDAR") query = supabase.from("solicitudes_acceso").select("*");
    else if (seccionActual === "PRODUCTOS" && targetDb) query = supabase.from(targetDb).select("*");

    if (query) {
      const { data, error } = await query;
      if (error) console.error("Error:", error);
      else setDataList(data || []);
    }
  };

  const ejecutarAccion = async () => {
    if (!supabase || !db) return;
    let query;
    if (accion === "CREAR") query = supabase.from(db).insert([formData]);
    else if (accion === "EDITAR") query = supabase.from(db).update(formData).eq("SKU", skuTarget);
    else if (accion === "ELIMINAR") query = supabase.from(db).delete().eq("SKU", skuTarget);
    else if (accion === "INACTIVAR") query = supabase.from(db).update({ estado_inventario: 'inactivo' }).eq("SKU", skuTarget);
    else if (accion === "VISUALIZAR") { query = supabase.from(db).select("*"); if(skuTarget) query = query.eq("SKU", skuTarget); }
    
    const { data, error } = await (query as any);
    if (error) alert("Error: " + error.message);
    else { 
      if (accion === "VISUALIZAR") setDataList(data || []);
      else { alert("Operación exitosa"); setAccion(""); setPaso(0); setDb(""); cargarDatos(seccion); }
    }
  };

  const renderInputs = () => (
    <div style={{ display: "grid", gap: "10px", marginTop: "15px" }}>
      <input placeholder="SKU" onChange={(e) => setFormData({...formData, SKU: e.target.value})} style={inputEstilo} value={formData.SKU}/>
      <input placeholder="Item" onChange={(e) => setFormData({...formData, Item: e.target.value})} style={inputEstilo} value={formData.Item}/>
      <input placeholder="Familia" onChange={(e) => setFormData({...formData, Familia: e.target.value})} style={inputEstilo} value={formData.Familia}/>
      <input placeholder="Descripción" onChange={(e) => setFormData({...formData, Descripción: e.target.value})} style={inputEstilo} value={formData.Descripción}/>
      <input placeholder="Especificaciones" onChange={(e) => setFormData({...formData, Especificaciones: e.target.value})} style={inputEstilo} value={formData.Especificaciones}/>
      <input type="number" placeholder="Precio" onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value) || 0})} style={inputEstilo} value={formData.precio}/>
      <input placeholder="Estado Inventario" onChange={(e) => setFormData({...formData, estado_inventario: e.target.value})} style={inputEstilo} value={formData.estado_inventario}/>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "30px" }}>ADMIN PANEL</h2>
        <button onClick={() => setSeccion("VALIDAR")} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => setSeccion("COTIZACIONES")} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setDataList([]);}} style={btnNav}>PRODUCTOS</button>
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "VALIDAR" && dataList.map((item: any) => (
          <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontWeight: "bold" }}>RAZON SOCIAL: {item.razon_social} | EMAIL: {item.email}</div>
              <a href={item.documentos_url} target="_blank" rel="noreferrer" style={{color: "blue"}}>VER DOCUMENTOS</a>
            </div>
          </div>
        ))}

        {seccion === "COTIZACIONES" && dataList.map((item: any) => (
          <div key={item.id} style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px" }}>
            <p><strong>ID:</strong> {item.id} | <strong>EMAIL:</strong> {item.user_email} | <strong>TELÉFONO:</strong> {item.user_telefono}</p>
            <p><strong>TOTAL:</strong> ${item.total}</p>
          </div>
        ))}

        {seccion === "PRODUCTOS" && (
          <div style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px" }}>
            {paso === 0 ? (
              <div style={{ display: "flex", gap: "10px" }}>
                {["CREAR", "EDITAR", "ELIMINAR", "INACTIVAR", "VISUALIZAR"].map(a => (
                  <button key={a} onClick={() => {setAccion(a); setPaso(1);}} style={btnAccion}>{a}</button>
                ))}
              </div>
            ) : (
              <>
                <select onChange={(e) => setDb(e.target.value)} style={selectEstilo} value={db}>
                  <option value="">Selecciona Base de Datos</option>
                  <option value="cabledb">Cable DB</option>
                  <option value="herrajesdb">Herrajes DB</option>
                  <option value="accesoriosdb">Accesorios DB</option>
                </select>
                {db && (
                  <>
                    {(accion === "EDITAR" || accion === "CREAR") && renderInputs()}
                    {(accion === "EDITAR" || accion === "ELIMINAR" || accion === "INACTIVAR" || accion === "VISUALIZAR") && (
                      <input placeholder="SKU" onChange={(e) => setSkuTarget(e.target.value)} style={inputEstilo} value={skuTarget} />
                    )}
                    <button onClick={ejecutarAccion} style={{...btnAccion, background: "green", color: "#fff"}}>EJECUTAR</button>
                    <button onClick={() => {setPaso(0); setDb(""); setAccion("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        
        {(seccion === "PRODUCTOS" && accion === "VISUALIZAR" && dataList.length > 0) && (
          <div>
            {dataList.map((item: any, idx: number) => (
              <div key={idx} style={{ border: "1px solid #333", padding: "10px", marginBottom: "5px" }}>
                {Object.entries(item).map(([k, v]) => <span key={k} style={{marginRight: 10}}><strong>{k}:</strong> {String(v)}</span>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", width: "100%", marginBottom: "10px", cursor: "pointer", fontWeight: "bold", textAlign: "left" as const };
const btnAccion = { padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "5px", fontWeight: "bold", background: "#DAA520", color: "#000" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
const inputEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
