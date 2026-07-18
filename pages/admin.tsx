import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
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
    cargarDatos(seccion); 
  }, [seccion]);

  const cargarDatos = async (seccionActual: string) => {
    if (!supabase) return;
    setDataList([]);
    let query;
    if (seccionActual === "COTIZACIONES") query = supabase.from("quotes").select("*");
    else if (seccionActual === "VALIDAR") query = supabase.from("solicitudes_acceso").select("*");
    else if (seccionActual === "PRODUCTOS") query = supabase.from(db).select("*");

    if (query) {
      const { data, error } = await query;
      if (error) console.error("Error al cargar datos:", error);
      else setDataList(data || []);
    }
  };

  const procesarSolicitud = async (id: string, tipo: 'ACTIVAR' | 'RECHAZAR') => {
    if (!supabase) return;
    if (tipo === 'ACTIVAR') {
      await supabase.from("solicitudes_acceso").update({ status: 'active' }).eq('id', id);
    } else {
      await supabase.from("solicitudes_acceso").delete().eq('id', id);
    }
    cargarDatos(seccion);
  };

  const ejecutarAccion = async () => {
    if (!supabase) return;
    let query;
    if (accion === "CREAR") {
      query = supabase.from(db).insert([formData]);
    } else if (accion === "EDITAR") {
      query = supabase.from(db).update(formData).eq("SKU", skuTarget);
    } else if (accion === "ELIMINAR") {
      query = supabase.from(db).delete().eq("SKU", skuTarget);
    } else if (accion === "INACTIVAR") {
      query = supabase.from(db).update({ estado_inventario: 'inactivo' }).eq("SKU", skuTarget);
    } else if (accion === "VISUALIZAR") {
      query = supabase.from(db).select("*").eq("SKU", skuTarget);
    }
    
    const { data, error } = await (query as any);
    if (error) {
      alert("Error al ejecutar la acción: " + error.message);
    } else { 
      if (accion === "VISUALIZAR") {
        setDataList(data || []);
      } else { 
        alert("Operación exitosa"); 
        setAccion(""); 
        setPaso(0); 
        setFormData({
          SKU: "",
          Item: "",
          Familia: "",
          Descripción: "",
          Especificaciones: "",
          precio: 0,
          estado_inventario: "disponible"
        }); 
        setSkuTarget("");
        cargarDatos(seccion); 
      }
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
      <input placeholder="Estado Inventario (ej: disponible / inactivo)" onChange={(e) => setFormData({...formData, estado_inventario: e.target.value})} style={inputEstilo} value={formData.estado_inventario}/>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "30px" }}>ADMIN PANEL</h2>
        <button onClick={() => {setSeccion("VALIDAR"); setPaso(0); setAccion("");}} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => {setSeccion("COTIZACIONES"); setPaso(0); setAccion("");}} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setPaso(0); setAccion("");}} style={btnNav}>PRODUCTOS</button>
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "VALIDAR" && dataList.map((item: any) => (
          <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontWeight: "bold" }}>RAZON SOCIAL: <span style={{color: "#DAA520"}}>{item.razon_social}</span> | EMAIL: <span style={{color: "#DAA520"}}>{item.email}</span></div>
              <a href={item.documentos_url || item.url || "#"} target="_blank" rel="noreferrer" style={{...btnAccion, background: "blue", color: "#fff", width: "fit-content", textAlign: "center"}}>VER DOCUMENTOS</a>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => procesarSolicitud(item.id, 'ACTIVAR')} style={{...btnAccion, background: "green", color: "#000"}}>ACTIVAR</button>
              <button onClick={() => procesarSolicitud(item.id, 'RECHAZAR')} style={{...btnAccion, background: "red", color: "#000"}}>RECHAZAR</button>
            </div>
          </div>
        ))}

        {seccion === "COTIZACIONES" && dataList.map((item: any) => (
          <div key={item.id} style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px", borderRadius: "10px" }}>
            <p><strong>ID:</strong> {item.id} | <strong>USUARIO:</strong> {item.user_email || item.user_id}</p>
            <p><strong>TOTAL:</strong> ${item.total}</p>
            <table style={{ width: "100%", color: "#fff", borderCollapse: "collapse", marginTop: "10px" }}>
              <thead><tr style={{ borderBottom: "1px solid #DAA520" }}><th>Prod</th><th>Km</th><th>Hilos</th><th>Cant</th><th>Total</th></tr></thead>
              <tbody>
                {item.items?.map((it: any, i: number) => (
                  <tr key={i} style={{ textAlign: "center" }}><td>{it.product}</td><td>{it.km}</td><td>{it.hilos}</td><td>{it.cantidad}</td><td>{it.lineTotal}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {seccion === "PRODUCTOS" && (
          <>
            <div style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px" }}>
              {paso === 0 && (
                <>
                  <button onClick={() => {setAccion("CREAR"); setPaso(1);}} style={{...btnAccion, background: "green", color: "#fff"}}>CREAR</button>
                  <button onClick={() => {setAccion("EDITAR"); setPaso(2);}} style={{...btnAccion, background: "#DAA520", color: "#000"}}>EDITAR</button>
                  <button onClick={() => {setAccion("ELIMINAR"); setPaso(2);}} style={{...btnAccion, background: "red", color: "#fff"}}>ELIMINAR</button>
                  <button onClick={() => {setAccion("INACTIVAR"); setPaso(2);}} style={{...btnAccion, background: "orange", color: "#000"}}>INACTIVAR</button>
                  <button onClick={() => {setAccion("VISUALIZAR"); setPaso(2);}} style={{...btnAccion, background: "blue", color: "#fff"}}>VISUALIZAR</button>
                </>
              )}
              {paso === 1 && (
                <>
                  <select onChange={(e) => setDb(e.target.value)} style={selectEstilo} value={db}>
                    <option value="cabledb">Cable DB</option>
                    <option value="herrajesdb">Herrajes DB</option>
                    <option value="accesoriosdb">Accesorios DB</option>
                  </select>
                  {renderInputs()}
                  <div style={{ marginTop: "15px" }}>
                    <button onClick={ejecutarAccion} style={{...btnAccion, background: "green", color: "#fff"}}>GUARDAR</button>
                    <button onClick={() => {setPaso(0); setAccion("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </div>
                </>
              )}
              {paso === 2 && (
                <>
                  <select onChange={(e) => setDb(e.target.value)} style={selectEstilo} value={db}>
                    <option value="cabledb">Cable DB</option>
                    <option value="herrajesdb">Herrajes DB</option>
                    <option value="accesoriosdb">Accesorios DB</option>
                  </select>
                  <input placeholder="Ingresa el SKU a procesar" onChange={(e) => setSkuTarget(e.target.value)} style={inputEstilo} value={skuTarget} />
                  {accion === "EDITAR" && renderInputs()}
                  <div style={{ marginTop: "15px" }}>
                    <button onClick={ejecutarAccion} style={{...btnAccion, background: "green", color: "#fff"}}>EJECUTAR</button>
                    <button onClick={() => {setPaso(0); setAccion(""); setSkuTarget("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </div>
                </>
              )}
            </div>
            
            <div style={{ marginTop: "20px" }}>
              <h3>Listado de {db}</h3>
              {dataList.map((item: any, idx: number) => (
                <div key={idx} style={{ border: "1px solid #333", padding: "12px", marginBottom: "5px", background: "#111", borderRadius: "4px" }}>
                  {Object.entries(item).map(([k, v]) => (
                    <span key={k} style={{ marginRight: "15px", display: "inline-block" }}>
                      <strong>{k}:</strong> <span style={{ color: "#fff" }}>{String(v)}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", width: "100%", marginBottom: "10px", cursor: "pointer", fontWeight: "bold", textAlign: "left" as const };
const btnAccion = { padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "5px", fontWeight: "bold", marginRight: "10px", display: "inline-block", textDecoration: "none" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
const inputEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
