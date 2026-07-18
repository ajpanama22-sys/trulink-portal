import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [accion, setAccion] = useState<string>(""); 
  const [skuTarget, setSkuTarget] = useState<string>(""); 
  const [formData, setFormData] = useState({
    SKU: "", Item: "", Familia: "", Descripción: "", Especificaciones: "", precio: 0, estado_inventario: "disponible"
  });
  const [dataList, setDataList] = useState<any[]>([]);
  const [paso, setPaso] = useState<number>(0); 

  useEffect(() => { cargarDatos(seccion); }, [seccion]);

  const cargarDatos = async (seccionActual: string) => {
    if (!supabase) return;
    setDataList([]);
    let query;
    if (seccionActual === "COTIZACIONES") query = supabase.from("quotes").select("*");
    else if (seccionActual === "VALIDAR") query = supabase.from("solicitudes_acceso").select("*");
    else if (seccionActual === "PRODUCTOS") query = supabase.from(db).select("*");
    
    const { data, error } = await (query as any);
    if (!error) setDataList(data || []);
  };

  const ejecutarAccion = async () => {
    if (!supabase) return;
    let query;
    if (accion === "CREAR") query = supabase.from(db).insert([formData]);
    else if (accion === "EDITAR") query = supabase.from(db).update(formData).eq("SKU", skuTarget);
    else if (accion === "ELIMINAR") query = supabase.from(db).delete().eq("SKU", skuTarget);
    else if (accion === "INACTIVAR") query = supabase.from(db).update({ estado_inventario: 'inactivo' }).eq("SKU", skuTarget);
    else if (accion === "VISUALIZAR") query = supabase.from(db).select("*").eq("SKU", skuTarget);
    
    const { data, error } = await (query as any);
    if (error) {
      alert("Error: " + error.message);
    } else {
      if (accion === "VISUALIZAR") {
        setDataList(data || []);
      } else {
        alert("Operación exitosa");
        setAccion("");
        setPaso(0);
        cargarDatos(seccion);
      }
    }
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => setSeccion("VALIDAR")} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => setSeccion("COTIZACIONES")} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => setSeccion("PRODUCTOS")} style={btnNav}>PRODUCTOS</button>
      </div>
      
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "VALIDAR" && dataList.map((item: any) => (
          <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px", display: "flex", justifyContent: "space-between" }}>
            <div>RAZON SOCIAL: {item.razon_social} | EMAIL: {item.email}
              <a href={item.documentos_url} target="_blank" style={{...btnAccion, background: "blue", color: "#fff", marginLeft: "10px"}}>VER DOCUMENTOS</a>
            </div>
            <div>
              <button onClick={() => supabase.from("solicitudes_acceso").update({status:'active'}).eq('id',item.id)} style={{...btnAccion, background: "green"}}>ACTIVAR</button>
              <button onClick={() => supabase.from("solicitudes_acceso").delete().eq('id',item.id)} style={{...btnAccion, background: "red"}}>RECHAZAR</button>
            </div>
          </div>
        ))}

        {seccion === "COTIZACIONES" && dataList.map((item: any) => (
          <div key={item.id} style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px" }}>
            <p><strong>ID:</strong> {item.id} | <strong>EMAIL:</strong> {item.user_email} | <strong>TELÉFONO:</strong> {item.user_telefono}</p>
            <table style={{ width: "100%", color: "#fff", borderCollapse: "collapse" }}>
              <thead><tr><th>Prod</th><th>Km</th><th>Hilos</th><th>Cant</th><th>Total</th></tr></thead>
              <tbody>{item.items?.map((it:any, i:number) => <tr key={i}><td>{it.product}</td><td>{it.km}</td><td>{it.hilos}</td><td>{it.cantidad}</td><td>{it.lineTotal}</td></tr>)}</tbody>
            </table>
          </div>
        ))}

        {seccion === "PRODUCTOS" && (
          <div style={{ border: "1px solid #DAA520", padding: "20px" }}>
            {paso === 0 ? (
              <>
                <button onClick={() => {setAccion("CREAR"); setPaso(1);}} style={{...btnAccion, background: "green"}}>CREAR</button>
                <button onClick={() => {setAccion("EDITAR"); setPaso(2);}} style={{...btnAccion, background: "#DAA520", color:"#000"}}>EDITAR</button>
                <button onClick={() => {setAccion("ELIMINAR"); setPaso(2);}} style={{...btnAccion, background: "red"}}>ELIMINAR</button>
                <button onClick={() => {setAccion("INACTIVAR"); setPaso(2);}} style={{...btnAccion, background: "orange", color:"#000"}}>INACTIVAR</button>
                <button onClick={() => {setAccion("VISUALIZAR"); setPaso(2);}} style={{...btnAccion, background: "blue"}}>VISUALIZAR</button>
              </>
            ) : (
              <>
                <select onChange={(e)=>setDb(e.target.value)} style={selectEstilo} value={db}>
                  <option value="cabledb">Cable DB</option><option value="herrajesdb">Herrajes DB</option><option value="accesoriosdb">Accesorios DB</option>
                </select>
                <input placeholder="SKU" onChange={(e)=>setSkuTarget(e.target.value)} style={inputEstilo}/>
                {accion === "CREAR" || accion === "EDITAR" ? (
                  <div style={{display:"grid", gap:"10px", marginTop:"10px"}}>
                    <input placeholder="Item" onChange={(e)=>setFormData({...formData, Item: e.target.value})} style={inputEstilo}/>
                    <input placeholder="Precio" type="number" onChange={(e)=>setFormData({...formData, precio: parseFloat(e.target.value)})} style={inputEstilo}/>
                  </div>
                ) : null}
                <div style={{marginTop:"15px"}}>
                  <button onClick={ejecutarAccion} style={{...btnAccion, background:"green"}}>EJECUTAR</button>
                  <button onClick={() => {setPaso(0); setAccion("");}} style={{...btnAccion, background:"gray"}}>CANCELAR</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", width: "100%", marginBottom: "10px", cursor: "pointer" };
const btnAccion = { padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "5px", fontWeight: "bold", marginRight: "10px" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
const inputEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
